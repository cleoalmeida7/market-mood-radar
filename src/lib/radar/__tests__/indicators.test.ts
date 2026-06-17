import {
  computeIndicators,
  computeIndicatorSeries,
  sma,
  rsi,
  macd,
  bollingerBands,
  stdDevOfDiffs,
} from "@/lib/radar/indicators";
import type { OHLCV } from "@/lib/fetchers/yahoo";

function bars(closes: number[]): OHLCV[] {
  return closes.map((c, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    timestamp: 1_700_000_000 + i * 86400,
    open: c * 0.999,
    high: c * 1.005,
    low: c * 0.995,
    close: c,
    volume: 1000,
  }));
}

const N = 80;
const up = Array.from({ length: N }, (_, i) => 100 + i * 0.5 + 0.015 * i * i); // accelerating up
const down = Array.from({ length: N }, (_, i) => 230 - i * 0.5 - 0.015 * i * i); // accelerating down
const dip = Array.from({ length: N }, (_, i) =>
  i < N - 8 ? 100 + Math.sin(i / 5) * 1.5 : 100 - (i - (N - 8)) * 4,
); // flat then sharp sell-off

describe("indicator primitives", () => {
  test("sma: average of window; null when too short", () => {
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5);
    expect(sma([10, 20, 30], 3)).toBe(20);
    expect(sma([1], 2)).toBeNull();
  });

  test("rsi: null when insufficient; ~100 on relentless uptrend", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
    const r = rsi(up, 14);
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(70);
  });

  test("macd: null when short; correct shape otherwise", () => {
    expect(macd([1, 2, 3])).toBeNull();
    const m = macd(up);
    expect(m).not.toBeNull();
    expect(m).toMatchObject({
      macd: expect.any(Number),
      signal: expect.any(Number),
      histogram: expect.any(Number),
    });
  });

  test("bollinger: null when short; upper > middle > lower", () => {
    expect(bollingerBands([1, 2], 20)).toBeNull();
    const b = bollingerBands(up, 20, 2)!;
    expect(b.upper).toBeGreaterThan(b.middle);
    expect(b.middle).toBeGreaterThan(b.lower);
    expect(b.stddev).toBeGreaterThan(0);
  });

  test("stdDevOfDiffs: 0 for constant / single value", () => {
    expect(stdDevOfDiffs([1, 1, 1, 1])).toBe(0);
    expect(stdDevOfDiffs([5])).toBe(0);
  });
});

describe("computeIndicators — output shape", () => {
  const set = computeIndicators(bars(up));
  test("all four indicators with valid shape", () => {
    expect(set.rsi.name).toBe("RSI");
    expect(set.macd.name).toBe("MACD");
    expect(set.ma.name).toBe("MA");
    expect(set.bollinger.name).toBe("Bollinger");
    for (const r of [set.rsi, set.macd, set.ma, set.bollinger]) {
      expect([-1, 0, 1]).toContain(r.signal);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("computeIndicators — edge cases", () => {
  test("empty bars → every indicator neutral + insufficient", () => {
    const set = computeIndicators([]);
    for (const r of [set.rsi, set.macd, set.ma, set.bollinger]) {
      expect(r.signal).toBe(0);
      expect(r.confidence).toBe(0);
      expect(r.value).toBeNull();
    }
  });

  test("single data point → neutral", () => {
    const set = computeIndicators(bars([100]));
    for (const r of [set.rsi, set.macd, set.ma, set.bollinger]) {
      expect(r.signal).toBe(0);
    }
  });
});

describe("computeIndicators — direction correctness", () => {
  const upSet = computeIndicators(bars(up));
  const downSet = computeIndicators(bars(down));
  const dipSet = computeIndicators(bars(dip));

  test("uptrend → MA & MACD bullish (+1)", () => {
    expect(upSet.ma.signal).toBe(1);
    expect(upSet.macd.signal).toBe(1);
  });
  test("downtrend → MA & MACD bearish (-1)", () => {
    expect(downSet.ma.signal).toBe(-1);
    expect(downSet.macd.signal).toBe(-1);
  });
  test("sharp sell-off → RSI oversold (+1) & Bollinger breakdown (+1)", () => {
    expect(dipSet.rsi.signal).toBe(1);
    expect(dipSet.bollinger.signal).toBe(1);
  });
});

describe("computeIndicatorSeries", () => {
  test("aligned to bars; warm-up nulls; recent values present", () => {
    const series = computeIndicatorSeries(bars(up));
    expect(series.length).toBe(N);
    expect(series[0].rsi).toBeNull(); // warm-up
    const last = series.at(-1)!;
    expect(last.rsi).not.toBeNull();
    expect(last.macd).not.toBeNull();
    expect(last.bbUpper).not.toBeNull();
    expect(last.date).toBe(bars(up).at(-1)!.date);
  });

  test("empty input → empty series", () => {
    expect(computeIndicatorSeries([])).toHaveLength(0);
  });
});
