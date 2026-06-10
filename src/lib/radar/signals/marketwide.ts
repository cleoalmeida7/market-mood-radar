// Market-wide signal scorer — DXY, VIX, 10Y Treasury (TNX), S&P 500 (SPX).
// README lists this source without an explicit weight ("—"); we assign a
// moderate contextual weight, documented here.

import type { PriceHistory, CommodityTicker } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { type SignalResult, round3, clamp } from "@/lib/radar/signals/types";

export const MARKETWIDE_WEIGHT = 0.7;

type Factor = "DXY" | "VIX" | "TNX" | "SPX";
const FACTOR_LABELS: Record<Factor, string> = {
  DXY: "US Dollar Index",
  VIX: "VIX",
  TNX: "10Y Treasury yield",
  SPX: "S&P 500",
};

/**
 * Sensitivity of each commodity to a RISE in each macro factor.
 * Positive = a rise in the factor is bullish for the commodity.
 */
const SENSITIVITY: Record<CommodityTicker, Record<Factor, number>> = {
  // Havens: hurt by strong dollar / high yields, helped by risk-off (VIX up).
  XAU: { DXY: -1.0, VIX: 0.6, TNX: -0.8, SPX: -0.2 },
  XAG: { DXY: -0.8, VIX: 0.3, TNX: -0.6, SPX: 0.2 },
  // Industrials / growth proxies: helped by risk-on (SPX up), hurt by VIX up.
  XPT: { DXY: -0.6, VIX: -0.2, TNX: -0.3, SPX: 0.5 },
  CL: { DXY: -0.4, VIX: -0.5, TNX: 0.1, SPX: 0.6 },
  NG: { DXY: -0.2, VIX: -0.2, TNX: 0.0, SPX: 0.3 },
  HG: { DXY: -0.5, VIX: -0.5, TNX: 0.1, SPX: 0.7 },
};

const LOOKBACK = 5; // ~1 trading week
const FULL_MOVE = 0.02; // a 2% move counts as a "full" factor move

/** Percent change of close over the last `lookback` bars. */
function pctChange(h: PriceHistory | undefined, lookback = LOOKBACK): number | null {
  if (!h || h.bars.length < 2) return null;
  const bars = h.bars;
  const last = bars[bars.length - 1].close;
  const idx = Math.max(0, bars.length - 1 - lookback);
  const prev = bars[idx].close;
  if (!prev) return null;
  return last / prev - 1;
}

export function scoreMarketwide(
  ticker: CommodityTicker,
  prices: Record<string, PriceHistory>,
): SignalResult {
  const sens = SENSITIVITY[ticker];
  const meta = COMMODITY_META[ticker];

  let weighted = 0; // Σ sensitivity * normalised move
  let denom = 0; // Σ |sensitivity| over available factors
  let strengthSum = 0;
  let available = 0;
  const drivers: { factor: Factor; contribution: number; ret: number }[] = [];

  for (const factor of ["DXY", "VIX", "TNX", "SPX"] as Factor[]) {
    const ret = pctChange(prices[factor]);
    if (ret == null) continue;
    available++;
    const norm = clamp(ret / FULL_MOVE, -1, 1); // normalised factor move
    const s = sens[factor];
    const contribution = s * norm;
    weighted += contribution;
    denom += Math.abs(s);
    strengthSum += Math.abs(norm);
    drivers.push({ factor, contribution, ret });
  }

  if (available === 0 || denom === 0) {
    return { score: 0, confidence: 0, reasons: ["Market-wide: no macro data"] };
  }

  const score = clamp(weighted / denom, -1, 1);
  // Confidence rises with how strongly the macro factors are actually moving
  // and how many we have data for.
  const avgStrength = strengthSum / available;
  const confidence = clamp(avgStrength * (available / 4), 0.1, 1);

  // Build reasons from the most influential drivers.
  const reasons: string[] = [];
  drivers
    .filter((d) => Math.abs(d.contribution) >= 0.15)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3)
    .forEach((d) => {
      const dir = d.ret >= 0 ? "rising" : "falling";
      const effect = d.contribution >= 0 ? "bullish" : "bearish";
      reasons.push(
        `${FACTOR_LABELS[d.factor]} ${dir} ${Math.abs(d.ret * 100).toFixed(1)}% ` +
          `(${effect} ${meta.name})`,
      );
    });

  if (reasons.length === 0) reasons.push("Market-wide: macro backdrop quiet");

  return { score: round3(score), confidence: round3(confidence), reasons };
}
