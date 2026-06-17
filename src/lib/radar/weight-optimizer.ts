// Weight optimizer — grid-searches the price-driven weights (technical↔market-wide
// ratio + the 4 technical sub-indicator weights) for the combination that best
// predicts forward price moves, then VALIDATES it out-of-sample before adopting.
//
// Why only these weights? The backtest can only reconstruct price-derived signals
// (see backtest.ts) — news/calendar/sentiment/Hormuz have no stored history, so
// their weights can't be measured and stay fixed.
//
// Overfitting guard: candidates are scored on a chronological TRAIN split (older
// ~70%); the single winner is then measured on a held-out TEST split (recent
// ~30%). We only "validate" weights that beat the current defaults on the test
// split — overfit weights that don't generalise are rejected and defaults kept.
//
// PURE: precompute once from price history, then re-blend cheaply per candidate
// (indicator signals don't depend on the weights — only the fusion does).

import type { PriceHistory, CommodityTicker } from "@/lib/fetchers/yahoo";
import { computeIndicators, type IndicatorSet } from "@/lib/radar/indicators";
import { blendTechnical } from "@/lib/radar/signals/technical";
import { scoreMarketwide } from "@/lib/radar/signals/marketwide";
import type { SignalResult } from "@/lib/radar/signals/types";
import {
  marketUpTo,
  blendPriceSources,
  BACKTEST_HORIZONS,
  MIN_BARS_FOR_SCORE,
  NEUTRAL_BAND,
} from "@/lib/radar/backtest";
import { DEFAULT_WEIGHTS, type RadarWeights } from "@/lib/radar/weights";

/** One precomputed day: indicator set + market-wide read + forward returns. */
export interface DaySignals {
  date: string;
  technicalSet: IndicatorSet;
  marketwide: SignalResult;
  forward: Record<number, number | null>;
}

/** Precompute every scorable day for a commodity (the expensive part, done once). */
export function precomputeDays(
  ticker: CommodityTicker,
  commodity: PriceHistory | undefined,
  market: Record<string, PriceHistory>,
): DaySignals[] {
  const bars = commodity?.bars ?? [];
  if (!commodity || bars.length < MIN_BARS_FOR_SCORE + 1) return [];

  const days: DaySignals[] = [];
  for (let t = MIN_BARS_FOR_SCORE - 1; t < bars.length; t++) {
    const bar = bars[t];
    const technicalSet = computeIndicators(bars.slice(0, t + 1));
    const marketwide = scoreMarketwide(ticker, marketUpTo(market, bar.date));
    const forward: Record<number, number | null> = {};
    for (const h of BACKTEST_HORIZONS) {
      const idx = t + h;
      forward[h] = idx < bars.length && bar.close !== 0 ? bars[idx].close / bar.close - 1 : null;
    }
    days.push({ date: bar.date, technicalSet, marketwide, forward });
  }
  return days;
}

/** Re-blend a precomputed day under a candidate weight set → -100..+100 score. */
export function scoreDay(day: DaySignals, weights: RadarWeights): number {
  const technical = blendTechnical(day.technicalSet, weights.technicalIndicators);
  return blendPriceSources(technical, day.marketwide, weights);
}

export interface HitStats {
  hits: number;
  n: number;
}
export const hitRate = (s: HitStats): number => (s.n > 0 ? s.hits / s.n : 0);

/**
 * Pooled directional hit rate over a chronological slice of each commodity's
 * days, across all horizons. Only directional days (|score| ≥ NEUTRAL_BAND)
 * with a forward return count.
 */
export function evalWeights(
  perCommodity: DaySignals[][],
  weights: RadarWeights,
  sliceFn: (days: DaySignals[]) => DaySignals[],
  horizons: readonly number[] = BACKTEST_HORIZONS,
): HitStats {
  let hits = 0;
  let n = 0;
  for (const days of perCommodity) {
    for (const day of sliceFn(days)) {
      const score = scoreDay(day, weights);
      if (Math.abs(score) < NEUTRAL_BAND) continue;
      for (const h of horizons) {
        const f = day.forward[h];
        if (f == null) continue;
        n++;
        if (Math.sign(score) === Math.sign(f)) hits++;
      }
    }
  }
  return { hits, n };
}

// ---- Search space ----------------------------------------------------------

const INDICATOR_LEVELS = [0, 1, 2];
const TECHNICAL_SOURCE = [0.7, 1.0, 1.3];
const MARKETWIDE_SOURCE = [0.4, 0.7, 1.0];

/**
 * All candidate weight sets. `minActiveIndicators` rejects over-concentrated
 * blends (a single-indicator technical signal is fragile/overfit-prone and
 * throws away the engine's multi-indicator corroboration) — default 1 keeps the
 * full space; the optimizer raises it to 2.
 */
export function candidateGrid(minActiveIndicators = 1): RadarWeights[] {
  const out: RadarWeights[] = [];
  for (const rsi of INDICATOR_LEVELS)
    for (const macd of INDICATOR_LEVELS)
      for (const ma of INDICATOR_LEVELS)
        for (const bollinger of INDICATOR_LEVELS) {
          const active = [rsi, macd, ma, bollinger].filter((w) => w > 0).length;
          if (active < Math.max(1, minActiveIndicators)) continue;
          for (const technical of TECHNICAL_SOURCE)
            for (const marketwide of MARKETWIDE_SOURCE) {
              out.push({ technical, marketwide, technicalIndicators: { rsi, macd, ma, bollinger } });
            }
        }
  return out;
}

// ---- Optimize with out-of-sample validation --------------------------------

export interface OptimizeResult {
  validated: boolean;
  best: RadarWeights;
  trainHitBest: number;
  trainHitDefault: number;
  testHitBest: number;
  testHitDefault: number;
  improvement: number;
  nTrain: number;
  nTest: number;
  combosTried: number;
  reason: string;
}

export interface OptimizeOptions {
  trainFraction?: number;
  minTrainSamples?: number;
  minTestSamples?: number;
  /**
   * Minimum out-of-sample hit-rate gain over defaults to adopt. Default 0.02
   * (2pp): at a ~50% hit rate the standard error is ~1.1pp for n≈2000, so a
   * smaller gain is statistically indistinguishable from noise.
   */
  minImprovement?: number;
  /** Reject technical blends with fewer than this many active indicators. */
  minActiveIndicators?: number;
}

export function optimize(
  perCommodity: DaySignals[][],
  opts: OptimizeOptions = {},
): OptimizeResult {
  const {
    trainFraction = 0.7,
    minTrainSamples = 200,
    minTestSamples = 100,
    minImprovement = 0.02,
    minActiveIndicators = 2,
  } = opts;

  const splitAt = (days: DaySignals[]) => Math.floor(days.length * trainFraction);
  const trainSlice = (days: DaySignals[]) => days.slice(0, splitAt(days));
  const testSlice = (days: DaySignals[]) => days.slice(splitAt(days));

  const grid = candidateGrid(minActiveIndicators);

  // Pick the best candidate on the TRAIN split only.
  let best = DEFAULT_WEIGHTS;
  let bestTrain = evalWeights(perCommodity, DEFAULT_WEIGHTS, trainSlice);
  let bestTrainHit = hitRate(bestTrain);
  for (const w of grid) {
    const s = evalWeights(perCommodity, w, trainSlice);
    if (s.n < minTrainSamples) continue;
    const hr = hitRate(s);
    if (hr > bestTrainHit) {
      bestTrainHit = hr;
      bestTrain = s;
      best = w;
    }
  }

  // Validate the single winner on the held-out TEST split vs defaults.
  const trainDefault = evalWeights(perCommodity, DEFAULT_WEIGHTS, trainSlice);
  const testDefault = evalWeights(perCommodity, DEFAULT_WEIGHTS, testSlice);
  const testBest = evalWeights(perCommodity, best, testSlice);
  const testHitBest = hitRate(testBest);
  const testHitDefault = hitRate(testDefault);
  const improvement = testHitBest - testHitDefault;

  let validated = true;
  let reason = "Validated: optimized weights beat defaults out-of-sample.";
  if (best === DEFAULT_WEIGHTS) {
    validated = false;
    reason = "No candidate beat the defaults on the training split — keeping defaults.";
  } else if (testBest.n < minTestSamples) {
    validated = false;
    reason = `Too few test samples (${testBest.n} < ${minTestSamples}) — keeping defaults.`;
  } else if (improvement < minImprovement) {
    validated = false;
    reason = `Out-of-sample gain ${(improvement * 100).toFixed(2)}pp below the ${(minImprovement * 100).toFixed(1)}pp bar — keeping defaults (overfit guard).`;
  }

  return {
    validated,
    best: validated ? best : DEFAULT_WEIGHTS,
    trainHitBest: bestTrainHit,
    trainHitDefault: hitRate(trainDefault),
    testHitBest,
    testHitDefault,
    improvement,
    nTrain: bestTrain.n,
    nTest: testBest.n,
    combosTried: grid.length,
    reason,
  };
}
