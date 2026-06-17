import {
  candidateGrid,
  scoreDay,
  evalWeights,
  optimize,
  precomputeDays,
  type DaySignals,
} from "@/lib/radar/weight-optimizer";
import { priceModelScore } from "@/lib/radar/backtest";
import { DEFAULT_WEIGHTS } from "@/lib/radar/weights";
import type { IndicatorResult, IndicatorSet } from "@/lib/radar/indicators";
import type { SignalResult } from "@/lib/radar/signals/types";
import type { PriceHistory, OHLCV } from "@/lib/fetchers/yahoo";

// ---- Builders --------------------------------------------------------------

function ind(name: IndicatorResult["name"], signal: -1 | 0 | 1, confidence: number): IndicatorResult {
  return { name, signal, confidence, reason: `${name} ${signal}`, value: signal };
}
const NEUTRAL_IND = (name: IndicatorResult["name"]) => ind(name, 0, 0);
const NEUTRAL_SIG: SignalResult = { score: 0, confidence: 0, reasons: [] };

/** A day where MA predicts the forward move perfectly and RSI is anti-predictive. */
function maPredictiveDay(i: number): DaySignals {
  const dir = i % 2 === 0 ? 1 : -1;
  const set: IndicatorSet = {
    rsi: ind("RSI", (-dir) as -1 | 1, 0.8), // points the wrong way
    macd: NEUTRAL_IND("MACD"),
    ma: ind("MA", dir as -1 | 1, 0.8), // points the right way
    bollinger: NEUTRAL_IND("Bollinger"),
  };
  return {
    date: `2025-01-${String((i % 27) + 1).padStart(2, "0")}`,
    technicalSet: set,
    marketwide: NEUTRAL_SIG,
    forward: { 1: dir * 0.01, 3: dir * 0.02, 7: dir * 0.03 },
  };
}

// ---- Grid ------------------------------------------------------------------

describe("candidateGrid", () => {
  const grid = candidateGrid();
  test("covers indicator levels × source weights, minus the all-zero indicator case", () => {
    // (3^4 - 1) indicator combos × 3 technical × 3 market-wide.
    expect(grid).toHaveLength((81 - 1) * 9);
  });
  test("never yields an all-zero indicator set", () => {
    for (const w of grid) {
      const ti = w.technicalIndicators;
      expect(ti.rsi + ti.macd + ti.ma + ti.bollinger).toBeGreaterThan(0);
    }
  });
  test("includes the default weighting", () => {
    expect(grid).toContainEqual(DEFAULT_WEIGHTS);
  });
});

// ---- scoreDay matches priceModelScore --------------------------------------

describe("scoreDay ≡ priceModelScore (default weights)", () => {
  test("precompute + re-blend reproduces the direct score", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 0.4 + Math.sin(i / 5) * 6);
    const bars: OHLCV[] = closes.map((c, i) => ({
      date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
      timestamp: i,
      open: c,
      high: c * 1.004,
      low: c * 0.996,
      close: c,
      volume: 1000,
    }));
    const commodity: PriceHistory = { ticker: "XAU", yahooSymbol: "GC=F", currency: "USD", bars };
    const days = precomputeDays("XAU", commodity, {});

    // Re-derive the last scored day's score directly and compare.
    const t = bars.length - 1;
    const slice: PriceHistory = { ...commodity, bars: bars.slice(0, t + 1) };
    const direct = priceModelScore("XAU", slice, {}, DEFAULT_WEIGHTS);
    expect(scoreDay(days[days.length - 1], DEFAULT_WEIGHTS)).toBe(direct);
  });
});

// ---- evalWeights -----------------------------------------------------------

describe("evalWeights", () => {
  const days = Array.from({ length: 30 }, (_, i) => maPredictiveDay(i));
  const all = (d: DaySignals[]) => d;

  test("MA-only weights score every directional day correctly; default cancels to neutral", () => {
    const maOnly = { technical: 1, marketwide: 0, technicalIndicators: { rsi: 0, macd: 0, ma: 1, bollinger: 0 } };
    const ma = evalWeights([days], maOnly, all);
    expect(ma.n).toBe(30 * 3); // 3 horizons per day, all directional
    expect(ma.hits).toBe(ma.n); // perfect

    // Default weights: RSI(+0.8) and MA(−0.8) cancel → score 0 → no directional days.
    const def = evalWeights([days], DEFAULT_WEIGHTS, all);
    expect(def.n).toBe(0);
  });
});

// ---- optimize: validation + overfit guard ----------------------------------

describe("optimize", () => {
  const opts = { minTrainSamples: 30, minTestSamples: 20, minImprovement: 0.005 };

  test("adopts weights that beat defaults out-of-sample", () => {
    const days = Array.from({ length: 60 }, (_, i) => maPredictiveDay(i));
    const res = optimize([days], opts);
    expect(res.validated).toBe(true);
    // The winner should down-weight RSI relative to MA.
    expect(res.best.technicalIndicators.ma).toBeGreaterThan(res.best.technicalIndicators.rsi);
    expect(res.testHitBest).toBeGreaterThan(res.testHitDefault);
  });

  test("keeps defaults when no signal exists (all-neutral days)", () => {
    const flat: DaySignals[] = Array.from({ length: 60 }, (_, i) => ({
      date: `d${i}`,
      technicalSet: {
        rsi: NEUTRAL_IND("RSI"),
        macd: NEUTRAL_IND("MACD"),
        ma: NEUTRAL_IND("MA"),
        bollinger: NEUTRAL_IND("Bollinger"),
      },
      marketwide: NEUTRAL_SIG,
      forward: { 1: 0.01, 3: 0.01, 7: 0.01 },
    }));
    const res = optimize([flat], opts);
    expect(res.validated).toBe(false);
    expect(res.best).toEqual(DEFAULT_WEIGHTS);
  });
});
