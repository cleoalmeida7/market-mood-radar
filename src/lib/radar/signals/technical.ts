// Technical signal scorer (weight 1.0).
// Fuses the 4 indicators into one normalised signal, excluding neutral
// indicators from the denominator (matches the engine's neutral-exclusion rule).

import type { PriceHistory } from "@/lib/fetchers/yahoo";
import { computeIndicators, type IndicatorSet } from "@/lib/radar/indicators";
import { type SignalResult, round3 } from "@/lib/radar/signals/types";

export const TECHNICAL_WEIGHT = 1.0;

/** Per-indicator weights inside the technical blend. */
export interface TechnicalWeights {
  rsi: number;
  macd: number;
  ma: number;
  bollinger: number;
}

/** Equal weighting — the documented default (identical to the original blend). */
export const DEFAULT_TECHNICAL_WEIGHTS: TechnicalWeights = {
  rsi: 1,
  macd: 1,
  ma: 1,
  bollinger: 1,
};

/**
 * Pure: fuse a precomputed IndicatorSet into one technical signal, weighting
 * each indicator by `weights[name] × confidence`. With the default (all-1)
 * weights this is exactly the original confidence-weighted blend. An indicator
 * with weight 0 is dropped entirely.
 */
export function blendTechnical(
  ind: IndicatorSet,
  weights: TechnicalWeights = DEFAULT_TECHNICAL_WEIGHTS,
): SignalResult {
  const named = [
    { w: weights.rsi, i: ind.rsi },
    { w: weights.macd, i: ind.macd },
    { w: weights.ma, i: ind.ma },
    { w: weights.bollinger, i: ind.bollinger },
  ];
  const active = named.filter((n) => n.i.signal !== 0 && n.i.confidence > 0 && n.w > 0);

  if (active.length === 0) {
    return { score: 0, confidence: 0, reasons: ["Technical: all indicators neutral"] };
  }

  // Weighted blend of the ±1 indicator signals (weight × confidence).
  const wsum = active.reduce((a, n) => a + n.i.signal * n.w * n.i.confidence, 0);
  const wcsum = active.reduce((a, n) => a + n.w * n.i.confidence, 0);
  const score = wcsum === 0 ? 0 : wsum / wcsum;

  // Confidence = mean indicator confidence (independent of weights, so the
  // damping semantics are unchanged), lifted slightly when several corroborate.
  const csum = active.reduce((a, n) => a + n.i.confidence, 0);
  const meanConf = csum / active.length;
  const corroboration = Math.min(active.length / 3, 1);
  const confidence = meanConf * (0.7 + 0.3 * corroboration);

  return {
    score: round3(score),
    confidence: round3(confidence),
    reasons: active.map((n) => n.i.reason),
  };
}

export function scoreTechnical(
  history: PriceHistory | undefined,
  weights: TechnicalWeights = DEFAULT_TECHNICAL_WEIGHTS,
): SignalResult {
  if (!history || history.bars.length === 0) {
    return { score: 0, confidence: 0, reasons: ["Technical: no price data"] };
  }
  return blendTechnical(computeIndicators(history.bars), weights);
}
