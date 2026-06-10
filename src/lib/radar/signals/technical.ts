// Technical signal scorer (weight 1.0).
// Fuses the 4 indicators into one normalised signal, excluding neutral
// indicators from the denominator (matches the engine's neutral-exclusion rule).

import type { PriceHistory } from "@/lib/fetchers/yahoo";
import { computeIndicators } from "@/lib/radar/indicators";
import { type SignalResult, round3 } from "@/lib/radar/signals/types";

export const TECHNICAL_WEIGHT = 1.0;

export function scoreTechnical(history: PriceHistory | undefined): SignalResult {
  if (!history || history.bars.length === 0) {
    return { score: 0, confidence: 0, reasons: ["Technical: no price data"] };
  }

  const ind = computeIndicators(history.bars);
  const all = [ind.rsi, ind.macd, ind.ma, ind.bollinger];
  const active = all.filter((i) => i.signal !== 0 && i.confidence > 0);

  if (active.length === 0) {
    return { score: 0, confidence: 0, reasons: ["Technical: all indicators neutral"] };
  }

  // Confidence-weighted blend of the ±1 indicator signals.
  const wsum = active.reduce((a, i) => a + i.signal * i.confidence, 0);
  const csum = active.reduce((a, i) => a + i.confidence, 0);
  const score = csum === 0 ? 0 : wsum / csum;

  // Confidence = mean indicator confidence, lifted slightly when several
  // indicators corroborate (3+ active indicators is strong technical agreement).
  const meanConf = csum / active.length;
  const corroboration = Math.min(active.length / 3, 1);
  const confidence = meanConf * (0.7 + 0.3 * corroboration);

  return {
    score: round3(score),
    confidence: round3(confidence),
    reasons: active.map((i) => i.reason),
  };
}
