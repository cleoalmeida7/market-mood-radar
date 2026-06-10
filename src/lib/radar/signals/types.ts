// Shared shape returned by every signal scorer.
// score is normalised to [-1, +1]; the engine scales the fused result to ±100.

export interface SignalResult {
  /** -1 (bearish) .. +1 (bullish). 0 = neutral. */
  score: number;
  /** 0..1 confidence in this read. 0 = no usable signal (excluded by engine). */
  confidence: number;
  /** Plain-English explanations — a core feature, never empty for active signals. */
  reasons: string[];
}

export const NEUTRAL: SignalResult = { score: 0, confidence: 0, reasons: [] };

export const round3 = (n: number) => Number(n.toFixed(3));
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
