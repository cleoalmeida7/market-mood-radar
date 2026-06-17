// Radar fusion engine — the core scoring logic.
//
// PURE: no fetch calls live here. The caller passes pre-fetched data (Yahoo
// OHLCV incl. market-wide tickers, Finnhub news, Finnhub calendar) so the
// engine is fully deterministic and unit-testable.
//
// Fusion rules (from README — do NOT simplify):
//   - Run all 5 signal scorers per commodity, with weights:
//       technical 1.0, calendar 0.8, news 0.6, marketwide 0.7, hormuz 0.9.
//   - Blend by (sourceWeight × confidence) so low-confidence reads carry less.
//   - EXCLUDE neutral signals (score === 0) from the denominator.
//   - DAMP low-conviction reads: if fewer than ~3 scorers return confidence
//     above 0.3, scale the final score down proportionally.
//   - Clamp final score to [-100, +100]; every score carries reasons[].

import type { PriceHistory, CommodityTicker } from "@/lib/fetchers/yahoo";
import { COMMODITY_TICKERS } from "@/lib/fetchers/yahoo";
import type { NewsItem, EconomicEvent } from "@/lib/fetchers/finnhub";
import type { SignalResult } from "@/lib/radar/signals/types";
import { scoreTechnical } from "@/lib/radar/signals/technical";
import { scoreCalendar, CALENDAR_WEIGHT } from "@/lib/radar/signals/calendar";
import { scoreNews, NEWS_WEIGHT } from "@/lib/radar/signals/news";
import { scoreMarketwide } from "@/lib/radar/signals/marketwide";
import { scoreMarketSentiment, SENTIMENT_WEIGHT } from "@/lib/radar/signals/sentiment";
import { scoreHormuz } from "@/lib/radar/hormuz";
import { DEFAULT_WEIGHTS, type RadarWeights } from "@/lib/radar/weights";

// README leaves Hormuz weight as "—"; we give the focused geopolitical overlay
// a strong weight, applied to CL/NG only.
export const HORMUZ_WEIGHT = 0.9;

/** Scorers must clear this confidence to count toward conviction (anti-damping). */
export const CONVICTION_CONFIDENCE = 0.3;
/** Number of conviction-grade scorers required for an undamped score. */
export const FULL_CONVICTION_SIGNALS = 3;

export type SignalSource =
  | "technical" | "calendar" | "news" | "marketwide" | "sentiment" | "hormuz";

export interface CommoditySignals {
  technical: SignalResult;
  calendar: SignalResult;
  news: SignalResult;
  marketwide: SignalResult;
  /** Broad market-news tone — same value across all commodities. */
  sentiment: SignalResult;
  /** null for non-energy commodities (Hormuz affects CL & NG only). */
  hormuz: SignalResult | null;
}

export interface CommodityScore {
  ticker: CommodityTicker;
  /** -100 .. +100 */
  score: number;
  /** 0 .. 1 */
  confidence: number;
  /** README label band. */
  label: string;
  reasons: string[];
  signals: CommoditySignals;
}

export interface MarketMood {
  score: number;
  label: string;
  dominantCommodity: string;
  dominantReason: string;
}

export interface RadarResult {
  generatedAt: string;
  commodities: CommodityScore[];
  mood: MarketMood;
}

export interface RadarInputs {
  /** Price history keyed by ticker — commodities AND market-wide tickers. */
  prices: Record<string, PriceHistory>;
  news: NewsItem[];
  calendar: EconomicEvent[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ---- Labels (exact README bands) ------------------------------------------

export function labelForScore(score: number): string {
  if (score >= 70) return "Strong Bull";
  if (score >= 30) return "Cautious Optimism";
  if (score > -30) return "Neutral / Mixed"; // -29 .. +29
  if (score > -70) return "Risk-Off"; // -69 .. -30
  return "Strong Bear";
}

// ---- Per-commodity signal gathering ---------------------------------------

function toResult(r: SignalResult): SignalResult {
  return { score: r.score, confidence: r.confidence, reasons: r.reasons };
}

function gatherSignals(
  ticker: CommodityTicker,
  inputs: RadarInputs,
  sentiment: SignalResult,
  weights: RadarWeights,
): CommoditySignals {
  const isEnergy = ticker === "CL" || ticker === "NG";
  return {
    technical: scoreTechnical(inputs.prices[ticker], weights.technicalIndicators),
    calendar: scoreCalendar(ticker, inputs.calendar),
    news: scoreNews(ticker, inputs.news),
    marketwide: scoreMarketwide(ticker, inputs.prices),
    sentiment, // market-wide — computed once, shared across commodities
    hormuz: isEnergy ? toResult(scoreHormuz(inputs.news)) : null,
  };
}

// ---- Fusion ----------------------------------------------------------------

interface WeightedSignal {
  source: SignalSource;
  weight: number;
  result: SignalResult;
}

function fuseCommodity(
  ticker: CommodityTicker,
  signals: CommoditySignals,
  weights: RadarWeights,
): CommodityScore {
  const entries: WeightedSignal[] = [
    { source: "technical", weight: weights.technical, result: signals.technical },
    { source: "calendar", weight: CALENDAR_WEIGHT, result: signals.calendar },
    { source: "news", weight: NEWS_WEIGHT, result: signals.news },
    { source: "marketwide", weight: weights.marketwide, result: signals.marketwide },
    { source: "sentiment", weight: SENTIMENT_WEIGHT, result: signals.sentiment },
  ];
  if (signals.hormuz) {
    entries.push({ source: "hormuz", weight: HORMUZ_WEIGHT, result: signals.hormuz });
  }

  // Neutral exclusion: signals with score === 0 don't enter the denominator.
  const contributing = entries.filter((e) => e.result.score !== 0);

  // Damping gate: how many scorers cleared the conviction confidence bar.
  const convictionCount = entries.filter(
    (e) => e.result.confidence > CONVICTION_CONFIDENCE,
  ).length;
  const dampFactor = clamp(convictionCount / FULL_CONVICTION_SIGNALS, 0, 1);

  if (contributing.length === 0) {
    return {
      ticker,
      score: 0,
      confidence: 0,
      label: labelForScore(0),
      reasons: ["Insufficient signal — low conviction"],
      signals,
    };
  }

  // Blend by sourceWeight × confidence.
  let numerator = 0;
  let denominator = 0;
  let confWeightSum = 0;
  let weightSum = 0;
  for (const e of contributing) {
    const eff = e.weight * e.result.confidence;
    numerator += e.result.score * eff;
    denominator += eff;
    confWeightSum += e.weight * e.result.confidence;
    weightSum += e.weight;
  }
  const weighted = denominator === 0 ? 0 : numerator / denominator; // -1..1

  const score = clamp(Math.round(weighted * 100 * dampFactor), -100, 100);

  // Confidence (0..1): weight-mean of contributing confidences, damped the same way.
  const meanConfidence = weightSum === 0 ? 0 : confWeightSum / weightSum;
  const confidence = Number(clamp(meanConfidence * dampFactor, 0, 1).toFixed(2));

  // Reasons ordered by each signal's absolute contribution to the score.
  const reasons = [...contributing]
    .sort(
      (a, b) =>
        Math.abs(b.result.score * b.weight * b.result.confidence) -
        Math.abs(a.result.score * a.weight * a.result.confidence),
    )
    .flatMap((e) => e.result.reasons)
    .slice(0, 6);

  return { ticker, score, confidence, label: labelForScore(score), reasons, signals };
}

// ---- Public API ------------------------------------------------------------

/**
 * Pure fusion: produce the full radar result from pre-fetched inputs.
 * @param generatedAt ISO timestamp (injected to keep the function pure/testable).
 */
export function computeRadar(
  inputs: RadarInputs,
  generatedAt: string = new Date().toISOString(),
  weights: RadarWeights = DEFAULT_WEIGHTS,
): RadarResult {
  // Broad market sentiment is a single market-wide read — compute once, share.
  const sentiment = scoreMarketSentiment(inputs.news);
  const commodities = COMMODITY_TICKERS.map((ticker) =>
    fuseCommodity(ticker, gatherSignals(ticker, inputs, sentiment, weights), weights),
  );

  // Overall mood = confidence-weighted average of commodity scores.
  let moodNum = 0;
  let moodDen = 0;
  for (const c of commodities) {
    moodNum += c.score * c.confidence;
    moodDen += c.confidence;
  }
  const moodScore =
    moodDen > 0
      ? Math.round(moodNum / moodDen)
      : Math.round(
          commodities.reduce((a, c) => a + c.score, 0) / (commodities.length || 1),
        );

  // Dominant commodity = largest absolute score; its top reason leads the mood.
  const dominant = commodities.reduce((best, c) =>
    Math.abs(c.score) > Math.abs(best.score) ? c : best,
  );

  return {
    generatedAt,
    commodities,
    mood: {
      score: moodScore,
      label: labelForScore(moodScore),
      dominantCommodity: dominant.ticker,
      dominantReason: dominant.reasons[0] ?? "",
    },
  };
}
