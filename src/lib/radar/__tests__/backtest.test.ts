import {
  pearson,
  mean,
  runBacktest,
  MIN_BARS_FOR_SCORE,
  NEUTRAL_BAND,
  BACKTEST_HORIZONS,
} from "@/lib/radar/backtest";
import type { PriceHistory, OHLCV } from "@/lib/fetchers/yahoo";

// Build a commodity PriceHistory from a closes array, with sequential daily
// dates starting 2025-01-01. open/high/low track close so indicators behave.
function history(closes: number[], ticker = "XAU"): PriceHistory {
  const bars: OHLCV[] = closes.map((close, i) => {
    const d = new Date(Date.UTC(2025, 0, 1 + i));
    return {
      date: d.toISOString().slice(0, 10),
      timestamp: Math.floor(d.getTime() / 1000),
      open: close,
      high: close * 1.005,
      low: close * 0.995,
      close,
      volume: 1000,
    };
  });
  return { ticker: ticker as PriceHistory["ticker"], yahooSymbol: "GC=F", currency: "USD", bars };
}

describe("pearson / mean", () => {
  test("mean of empty is null", () => {
    expect(mean([])).toBeNull();
    expect(mean([2, 4, 6])).toBe(4);
  });

  test("perfect positive / negative correlation", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  test("null when n < 2 or a series is constant", () => {
    expect(pearson([1], [1])).toBeNull();
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe("runBacktest — guards", () => {
  test("too few bars → warning + empty points", () => {
    const res = runBacktest("XAU", history([100, 101, 102]), {}, "2026-06-17T00:00:00Z");
    expect(res.points).toHaveLength(0);
    expect(res.warning).toMatch(/Not enough price history/);
    expect(res.window.scoredDays).toBe(0);
    expect(res.horizons).toHaveLength(BACKTEST_HORIZONS.length);
    expect(res.horizons.every((h) => h.n === 0 && h.hitRate === null)).toBe(true);
  });

  test("undefined commodity → warning, no throw", () => {
    const res = runBacktest("CL", undefined, {}, "2026-06-17T00:00:00Z");
    expect(res.warning).toBeDefined();
    expect(res.points).toHaveLength(0);
  });
});

describe("runBacktest — structure & math", () => {
  // 90 bars of mild noise so scores and returns both vary.
  const closes = Array.from({ length: 90 }, (_, i) =>
    100 + i * 0.3 + Math.sin(i / 4) * 4,
  );
  const res = runBacktest("XAU", history(closes), {}, "2026-06-17T00:00:00Z");

  test("scores days from the warm-up bar to the last bar", () => {
    expect(res.points).toHaveLength(closes.length - (MIN_BARS_FOR_SCORE - 1));
    expect(res.window.bars).toBe(closes.length);
    expect(res.window.scoredDays).toBe(res.points.length);
    expect(res.window.from).toBe(res.points[0].date);
    expect(res.window.to).toBe(res.points[res.points.length - 1].date);
  });

  test("every score is an integer within [-100, 100]", () => {
    for (const p of res.points) {
      expect(Number.isInteger(p.score)).toBe(true);
      expect(p.score).toBeGreaterThanOrEqual(-100);
      expect(p.score).toBeLessThanOrEqual(100);
    }
  });

  test("forward return matches the close ratio at the right offset", () => {
    const p0 = res.points[0];
    // p0 corresponds to bar index MIN_BARS_FOR_SCORE-1 in the source closes.
    const base = MIN_BARS_FOR_SCORE - 1;
    for (const h of BACKTEST_HORIZONS) {
      const expected = closes[base + h] / closes[base] - 1;
      expect(p0.forward[h]).toBeCloseTo(expected, 10);
    }
  });

  test("the last bar has null forward returns (window runs off the end)", () => {
    const last = res.points[res.points.length - 1];
    for (const h of BACKTEST_HORIZONS) expect(last.forward[h]).toBeNull();
  });

  test("horizon n only counts directional days that have a forward return", () => {
    for (const h of BACKTEST_HORIZONS) {
      const stats = res.horizons.find((s) => s.horizon === h)!;
      const expectedN = res.points.filter(
        (p) => p.forward[h] != null && Math.abs(p.score) >= NEUTRAL_BAND,
      ).length;
      expect(stats.n).toBe(expectedN);
      expect(stats.longN + stats.shortN).toBe(stats.n);
      if (stats.hitRate != null) {
        expect(stats.hitRate).toBeGreaterThanOrEqual(0);
        expect(stats.hitRate).toBeLessThanOrEqual(1);
      }
    }
  });

  test("buckets partition the days-with-return for each horizon", () => {
    for (const h of BACKTEST_HORIZONS) {
      const withReturn = res.points.filter((p) => p.forward[h] != null).length;
      const bucketTotal = res.buckets[h].reduce((a, b) => a + b.n, 0);
      expect(bucketTotal).toBe(withReturn);
      expect(res.buckets[h]).toHaveLength(5);
    }
  });
});
