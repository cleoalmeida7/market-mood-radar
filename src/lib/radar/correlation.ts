// Cross-commodity correlation, computed from the 7-day close sparklines already
// present in the /api/radar response (no new API calls). Flags unusual
// divergences — e.g. Gold and Silver moving opposite, or Oil moving while
// Natural Gas stays flat.

import { COMMODITY_TICKERS, type CommodityTicker } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Bar-to-bar percentage returns. */
export function returns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    out.push(prev ? closes[i] / prev - 1 : 0);
  }
  return out;
}

/** Cumulative return over the window (last / first - 1). */
export function cumulativeReturn(closes: number[]): number {
  if (closes.length < 2 || !closes[0]) return 0;
  return closes[closes.length - 1] / closes[0] - 1;
}

/** Pearson correlation coefficient of two equal-length series. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ax = a.slice(0, n);
  const bx = b.slice(0, n);
  const ma = mean(ax);
  const mb = mean(bx);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = ax[i] - ma;
    const y = bx[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : clamp(num / denom, -1, 1);
}

export interface Divergence {
  a: CommodityTicker;
  b: CommodityTicker;
  corr: number;
  note: string;
}

export interface CorrelationResult {
  tickers: CommodityTicker[];
  /** matrix[i][j] = correlation of tickers[i] vs tickers[j]; diagonal = 1. */
  matrix: number[][];
  divergences: Divergence[];
}

const OPPOSITE_THRESHOLD = -0.4; // strongly negative correlation
const TREND_THRESHOLD = 0.02; // 2% cumulative move = "moving"
const FLAT_THRESHOLD = 0.005; // <0.5% = "flat"

/**
 * Build the correlation matrix + a list of notable divergences from sparklines.
 */
export function buildCorrelation(spark: Record<string, number[]>): CorrelationResult {
  const tickers = [...COMMODITY_TICKERS];
  const rets = tickers.map((t) => returns(spark[t] ?? []));
  const cum = tickers.map((t) => cumulativeReturn(spark[t] ?? []));

  const matrix = tickers.map((_, i) =>
    tickers.map((_, j) => (i === j ? 1 : Number(pearson(rets[i], rets[j]).toFixed(2)))),
  );

  const divergences: Divergence[] = [];
  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const corr = matrix[i][j];
      const a = tickers[i];
      const b = tickers[j];
      const nameA = COMMODITY_META[a].name;
      const nameB = COMMODITY_META[b].name;

      if (corr <= OPPOSITE_THRESHOLD) {
        divergences.push({
          a, b, corr,
          note: `${nameA} and ${nameB} are moving in opposite directions`,
        });
      } else if (Math.abs(cum[i]) >= TREND_THRESHOLD && Math.abs(cum[j]) < FLAT_THRESHOLD) {
        divergences.push({
          a, b, corr,
          note: `${nameA} is ${cum[i] > 0 ? "rising" : "falling"} while ${nameB} stays flat`,
        });
      } else if (Math.abs(cum[j]) >= TREND_THRESHOLD && Math.abs(cum[i]) < FLAT_THRESHOLD) {
        divergences.push({
          a, b, corr,
          note: `${nameB} is ${cum[j] > 0 ? "rising" : "falling"} while ${nameA} stays flat`,
        });
      }
    }
  }

  // Most extreme first; cap the list so the panel stays readable.
  divergences.sort((x, y) => x.corr - y.corr);
  return { tickers, matrix, divergences: divergences.slice(0, 5) };
}
