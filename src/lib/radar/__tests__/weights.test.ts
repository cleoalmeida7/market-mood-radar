import {
  DEFAULT_WEIGHTS,
  ACTIVE_WEIGHTS,
  USING_OPTIMIZED_WEIGHTS,
  resolveWeights,
} from "@/lib/radar/weights";
import optimized from "@/lib/radar/optimized-weights.json";

const valid = {
  technical: 1.0,
  marketwide: 0.7,
  technicalIndicators: { rsi: 1, macd: 2, ma: 1, bollinger: 0 },
};

describe("resolveWeights — validation", () => {
  test("accepts a well-formed payload", () => {
    expect(resolveWeights(valid)).toEqual(valid);
  });

  test("rejects malformed / out-of-range / degenerate payloads", () => {
    expect(resolveWeights(null)).toBeNull();
    expect(resolveWeights("nope")).toBeNull();
    expect(resolveWeights({ technical: 1, marketwide: 0.7 })).toBeNull(); // no indicators
    expect(resolveWeights({ ...valid, technical: -1 })).toBeNull(); // negative
    expect(resolveWeights({ ...valid, marketwide: 999 })).toBeNull(); // > max
    expect(
      resolveWeights({ ...valid, technicalIndicators: { rsi: "x", macd: 1, ma: 1, bollinger: 1 } }),
    ).toBeNull(); // non-number
    expect(
      resolveWeights({ technical: 0, marketwide: 0, technicalIndicators: { rsi: 1, macd: 1, ma: 1, bollinger: 1 } }),
    ).toBeNull(); // both sources zero
    expect(
      resolveWeights({ technical: 1, marketwide: 0.7, technicalIndicators: { rsi: 0, macd: 0, ma: 0, bollinger: 0 } }),
    ).toBeNull(); // all indicators zero
  });
});

describe("ACTIVE_WEIGHTS — reflects the committed optimizer output", () => {
  test("uses validated optimized weights when present, else defaults", () => {
    // Robust to re-optimization: assert the resolver wiring, not specific numbers.
    if (optimized.validated === true) {
      const resolved = resolveWeights(optimized.weights);
      expect(resolved).not.toBeNull();
      expect(ACTIVE_WEIGHTS).toEqual(resolved);
      expect(USING_OPTIMIZED_WEIGHTS).toBe(true);
    } else {
      expect(ACTIVE_WEIGHTS).toEqual(DEFAULT_WEIGHTS);
      expect(USING_OPTIMIZED_WEIGHTS).toBe(false);
    }
  });

  test("ACTIVE_WEIGHTS is always a usable, in-range weight set", () => {
    expect(resolveWeights(ACTIVE_WEIGHTS)).toEqual(ACTIVE_WEIGHTS);
  });

  test("default weights match the documented source/indicator values", () => {
    expect(DEFAULT_WEIGHTS.technical).toBe(1.0);
    expect(DEFAULT_WEIGHTS.marketwide).toBe(0.7);
    expect(DEFAULT_WEIGHTS.technicalIndicators).toEqual({ rsi: 1, macd: 1, ma: 1, bollinger: 1 });
  });
});
