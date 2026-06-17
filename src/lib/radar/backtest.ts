// Backtesting engine — does the radar's read actually precede price moves?
//
// We can't replay the FULL fused score historically: news, calendar, sentiment
// and Hormuz are live-only (not stored per-day). What IS reproducible from
// `price_history` is the PRICE-DRIVEN component — the technical signal (the
// commodity's own bars) plus the market-wide signal (DXY/VIX/TNX/SPX bars). So
// the backtest reconstructs that price-model score at each past day and measures
// it against the actual forward return over the next 1 / 3 / 7 trading days.
//
// PURE: takes pre-fetched PriceHistory in, no I/O. Fully unit-testable.

import type { PriceHistory, CommodityTicker } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { scoreTechnical, TECHNICAL_WEIGHT } from "@/lib/radar/signals/technical";
import { scoreMarketwide, MARKETWIDE_WEIGHT } from "@/lib/radar/signals/marketwide";
import { labelForScore } from "@/lib/radar/engine";
import { styleForScore, type WeatherKey } from "@/lib/ui/labels";

/** Forward-return windows, in trading days. */
export const BACKTEST_HORIZONS = [1, 3, 7] as const;
export type Horizon = (typeof BACKTEST_HORIZONS)[number];

/**
 * Bars needed before we score a day: MA-50 is the hungriest indicator, so a day
 * is only scored once 50 prior bars exist (matches the live cache's MIN_CACHE_BARS).
 */
export const MIN_BARS_FOR_SCORE = 50;

/** |score| below this is "no directional call" — excluded from hit-rate / long-short. */
export const NEUTRAL_BAND = 10;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface BacktestPoint {
  date: string;
  close: number;
  /** Reconstructed price-model score, -100..+100. */
  score: number;
  /** Forward return (fraction) by horizon; null when the window runs off the end. */
  forward: Record<number, number | null>;
}

export interface HorizonStats {
  horizon: number;
  /** Days with a directional score (|score| ≥ NEUTRAL_BAND) AND a forward return. */
  n: number;
  /** Directional accuracy over those days, 0..1. null when n === 0. */
  hitRate: number | null;
  /** Pearson correlation of score vs forward return over ALL days with a return. */
  correlation: number | null;
  /** Mean forward return on bullish days / bearish days. */
  avgReturnLong: number | null;
  avgReturnShort: number | null;
  longN: number;
  shortN: number;
}

export interface ScoreBucket {
  key: WeatherKey;
  label: string;
  n: number;
  /** Mean forward return for days that landed in this band (for the chosen horizon). */
  avgReturn: number | null;
}

export interface BacktestResult {
  ticker: string;
  name: string;
  generatedAt: string;
  window: { from: string | null; to: string | null; bars: number; scoredDays: number };
  points: BacktestPoint[];
  horizons: HorizonStats[];
  /** Avg forward return per mood band, keyed by horizon. */
  buckets: Record<number, ScoreBucket[]>;
  warning?: string;
}

// ---- Pure stats helpers ----------------------------------------------------

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Pearson correlation. null when undefined (n < 2 or a series has zero variance). */
export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs.slice(0, n))!;
  const my = mean(ys.slice(0, n))!;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

// ---- Price-model score (technical + market-wide, no news) -------------------

/** Each market series truncated to bars on/before `isoDate` (for a point-in-time read). */
function marketUpTo(
  market: Record<string, PriceHistory>,
  isoDate: string,
): Record<string, PriceHistory> {
  const out: Record<string, PriceHistory> = {};
  for (const [k, h] of Object.entries(market)) {
    out[k] = { ...h, bars: h.bars.filter((b) => b.date <= isoDate) };
  }
  return out;
}

/**
 * Blend the two price-driven signals exactly as the engine does (weight ×
 * confidence, neutral-exclusion) but WITHOUT the 5-signal conviction damping —
 * that damping assumes the full scorer set and would crush a 2-signal score.
 */
export function priceModelScore(
  ticker: CommodityTicker,
  commoditySlice: PriceHistory,
  marketSlice: Record<string, PriceHistory>,
): number {
  const entries = [
    { weight: TECHNICAL_WEIGHT, result: scoreTechnical(commoditySlice) },
    { weight: MARKETWIDE_WEIGHT, result: scoreMarketwide(ticker, marketSlice) },
  ].filter((e) => e.result.score !== 0 && e.result.confidence > 0);

  if (entries.length === 0) return 0;

  let num = 0;
  let den = 0;
  for (const e of entries) {
    const eff = e.weight * e.result.confidence;
    num += e.result.score * eff;
    den += eff;
  }
  const weighted = den === 0 ? 0 : num / den; // -1..1
  return clamp(Math.round(weighted * 100), -100, 100);
}

// ---- Backtest --------------------------------------------------------------

function emptyResult(
  ticker: CommodityTicker,
  generatedAt: string,
  bars: number,
  warning: string,
): BacktestResult {
  return {
    ticker,
    name: COMMODITY_META[ticker]?.name ?? ticker,
    generatedAt,
    window: { from: null, to: null, bars, scoredDays: 0 },
    points: [],
    horizons: BACKTEST_HORIZONS.map((h) => ({
      horizon: h,
      n: 0,
      hitRate: null,
      correlation: null,
      avgReturnLong: null,
      avgReturnShort: null,
      longN: 0,
      shortN: 0,
    })),
    buckets: Object.fromEntries(BACKTEST_HORIZONS.map((h) => [h, []])),
    warning,
  };
}

const BUCKET_KEYS: WeatherKey[] = ["bear", "riskoff", "neutral", "cautious", "bull"];

/**
 * Replay the price-model score across `commodity`'s history and score its
 * predictive power vs forward returns. `market` holds the macro tickers
 * (DXY/VIX/TNX/SPX) — passing the full price map is fine; only those are read.
 */
export function runBacktest(
  ticker: CommodityTicker,
  commodity: PriceHistory | undefined,
  market: Record<string, PriceHistory>,
  generatedAt: string = new Date().toISOString(),
): BacktestResult {
  const bars = commodity?.bars ?? [];
  if (!commodity || bars.length < MIN_BARS_FOR_SCORE + 1) {
    return emptyResult(
      ticker,
      generatedAt,
      bars.length,
      `Not enough price history to backtest (need ≥ ${MIN_BARS_FOR_SCORE + 1} bars, have ${bars.length}).`,
    );
  }

  // Score every day from the warm-up point to the last bar.
  const points: BacktestPoint[] = [];
  for (let t = MIN_BARS_FOR_SCORE - 1; t < bars.length; t++) {
    const bar = bars[t];
    const slice: PriceHistory = { ...commodity, bars: bars.slice(0, t + 1) };
    const score = priceModelScore(ticker, slice, marketUpTo(market, bar.date));

    const forward: Record<number, number | null> = {};
    for (const h of BACKTEST_HORIZONS) {
      const fwdIdx = t + h;
      forward[h] =
        fwdIdx < bars.length && bar.close !== 0
          ? bars[fwdIdx].close / bar.close - 1
          : null;
    }
    points.push({ date: bar.date, close: bar.close, score, forward });
  }

  // Per-horizon predictive stats.
  const horizons: HorizonStats[] = BACKTEST_HORIZONS.map((h) => {
    const withReturn = points.filter((p) => p.forward[h] != null);
    const scores = withReturn.map((p) => p.score);
    const rets = withReturn.map((p) => p.forward[h] as number);
    const correlation = pearson(scores, rets);

    const directional = withReturn.filter((p) => Math.abs(p.score) >= NEUTRAL_BAND);
    const hits = directional.filter(
      (p) => Math.sign(p.score) === Math.sign(p.forward[h] as number),
    ).length;
    const longs = directional.filter((p) => p.score >= NEUTRAL_BAND);
    const shorts = directional.filter((p) => p.score <= -NEUTRAL_BAND);

    return {
      horizon: h,
      n: directional.length,
      hitRate: directional.length ? hits / directional.length : null,
      correlation,
      avgReturnLong: mean(longs.map((p) => p.forward[h] as number)),
      avgReturnShort: mean(shorts.map((p) => p.forward[h] as number)),
      longN: longs.length,
      shortN: shorts.length,
    };
  });

  // Avg forward return per mood band, per horizon.
  const buckets: Record<number, ScoreBucket[]> = {};
  for (const h of BACKTEST_HORIZONS) {
    const withReturn = points.filter((p) => p.forward[h] != null);
    buckets[h] = BUCKET_KEYS.map((key) => {
      const inBand = withReturn.filter((p) => styleForScore(p.score).key === key);
      return {
        key,
        label: labelForScore(representativeScore(key)),
        n: inBand.length,
        avgReturn: mean(inBand.map((p) => p.forward[h] as number)),
      };
    });
  }

  return {
    ticker,
    name: COMMODITY_META[ticker]?.name ?? ticker,
    generatedAt,
    window: {
      from: points[0]?.date ?? null,
      to: points[points.length - 1]?.date ?? null,
      bars: bars.length,
      scoredDays: points.length,
    },
    points,
    horizons,
    buckets,
  };
}

/** A score that sits squarely inside each band — used to label buckets. */
function representativeScore(key: WeatherKey): number {
  switch (key) {
    case "bull":
      return 80;
    case "cautious":
      return 40;
    case "neutral":
      return 0;
    case "riskoff":
      return -40;
    case "bear":
      return -80;
  }
}
