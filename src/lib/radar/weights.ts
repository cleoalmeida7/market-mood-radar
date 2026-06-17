// Single source of truth for the radar's *tunable* weights — the price-driven
// ones the backtest can measure: the technical↔market-wide source ratio and the
// 4 technical sub-indicator weights. The other signal weights (calendar, news,
// sentiment, hormuz) are NOT tunable here — they can't be backtested (no stored
// history) and keep their documented constants in the scorer modules.
//
// `ACTIVE_WEIGHTS` = the defaults, overridden by `optimized-weights.json` ONLY
// when the optimizer marked a result as validated (beat defaults out-of-sample)
// AND the payload passes a strict shape/sanity check. Anything malformed falls
// back to defaults, so the engine can never crash on a bad optimizer write.

import {
  TECHNICAL_WEIGHT,
  DEFAULT_TECHNICAL_WEIGHTS,
  type TechnicalWeights,
} from "@/lib/radar/signals/technical";
import { MARKETWIDE_WEIGHT } from "@/lib/radar/signals/marketwide";
import optimized from "@/lib/radar/optimized-weights.json";

export interface RadarWeights {
  /** Source weight of the technical signal. */
  technical: number;
  /** Source weight of the market-wide signal. */
  marketwide: number;
  /** Weights of the 4 indicators inside the technical signal. */
  technicalIndicators: TechnicalWeights;
}

export const DEFAULT_WEIGHTS: RadarWeights = {
  technical: TECHNICAL_WEIGHT,
  marketwide: MARKETWIDE_WEIGHT,
  technicalIndicators: { ...DEFAULT_TECHNICAL_WEIGHTS },
};

/** A finite number in [0, max]. */
function okNum(n: unknown, max = 5): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
}

/** Validate an unknown payload into RadarWeights, or null if it's unusable. */
export function resolveWeights(payload: unknown): RadarWeights | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const ti = p.technicalIndicators as Record<string, unknown> | undefined;
  if (!ti || typeof ti !== "object") return null;

  if (!okNum(p.technical) || !okNum(p.marketwide)) return null;
  if (!okNum(ti.rsi) || !okNum(ti.macd) || !okNum(ti.ma) || !okNum(ti.bollinger)) {
    return null;
  }
  // At least one source and one indicator must carry weight, else every score
  // collapses to neutral.
  if (p.technical === 0 && p.marketwide === 0) return null;
  if (ti.rsi === 0 && ti.macd === 0 && ti.ma === 0 && ti.bollinger === 0) return null;

  return {
    technical: p.technical,
    marketwide: p.marketwide,
    technicalIndicators: {
      rsi: ti.rsi,
      macd: ti.macd,
      ma: ti.ma,
      bollinger: ti.bollinger,
    },
  };
}

function resolveActive(): RadarWeights {
  const cfg = optimized as { validated?: unknown; weights?: unknown };
  if (cfg.validated === true) {
    const w = resolveWeights(cfg.weights);
    if (w) return w;
  }
  return DEFAULT_WEIGHTS;
}

/** The weights the production engine should use right now. */
export const ACTIVE_WEIGHTS: RadarWeights = resolveActive();

/** True when the optimizer's validated override is the one in effect. */
export const USING_OPTIMIZED_WEIGHTS: boolean = ACTIVE_WEIGHTS !== DEFAULT_WEIGHTS;
