// Technical indicators computed from Yahoo OHLCV history.
// Each indicator returns a discrete signal (-1 bearish / 0 neutral / +1 bullish),
// a 0..1 confidence, and a plain-English reason for the explainability layer.

import type { OHLCV } from "@/lib/fetchers/yahoo";

export type Signal = -1 | 0 | 1;

export interface IndicatorResult {
  name: "RSI" | "MACD" | "MA" | "Bollinger";
  signal: Signal;
  confidence: number; // 0..1
  reason: string;
  /** Primary numeric value (for UI). null when there is not enough data. */
  value: number | null;
  /** Extra values for charts (e.g. macd/signal/hist, band edges). */
  details?: Record<string, number>;
}

export interface IndicatorSet {
  rsi: IndicatorResult;
  macd: IndicatorResult;
  ma: IndicatorResult;
  bollinger: IndicatorResult;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, d = 2) => Number(n.toFixed(d));

// ---- Primitive math --------------------------------------------------------

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** EMA series seeded with the SMA of the first `period` values. */
export function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const out = [prev];
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI. Returns the latest value, or null if insufficient data. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (ch > 0 ? ch : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (ch < 0 ? -ch : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdValue {
  macd: number;
  signal: number;
  histogram: number;
}

/** MACD line (EMA fast − EMA slow), signal line, and histogram. */
export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdValue | null {
  if (values.length < slow + signalPeriod) return null;
  const emaFast = emaSeries(values, fast); // length values-fast+1
  const emaSlow = emaSeries(values, slow); // length values-slow+1
  // Align: trim the (longer) fast series to the slow series' start.
  const offset = emaFast.length - emaSlow.length;
  const macdLine = emaSlow.map((s, i) => emaFast[i + offset] - s);
  const signalLine = emaSeries(macdLine, signalPeriod);
  if (!signalLine.length) return null;
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signalLine[signalLine.length - 1];
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}

export interface BollingerValue {
  upper: number;
  middle: number;
  lower: number;
  stddev: number;
}

export function bollingerBands(
  values: number[],
  period = 20,
  mult = 2,
): BollingerValue | null {
  if (values.length < period) return null;
  const middle = sma(values, period)!;
  const slice = values.slice(-period);
  const variance =
    slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  return {
    upper: middle + mult * sd,
    middle,
    lower: middle - mult * sd,
    stddev: sd,
  };
}

// ---- Indicator → signal wrappers ------------------------------------------

function insufficient(name: IndicatorResult["name"], have: number): IndicatorResult {
  return {
    name,
    signal: 0,
    confidence: 0,
    reason: `${name}: insufficient data (${have} bars)`,
    value: null,
  };
}

function rsiSignal(closes: number[]): IndicatorResult {
  const v = rsi(closes, 14);
  if (v == null) return insufficient("RSI", closes.length);
  if (v < 30) {
    return {
      name: "RSI",
      signal: 1,
      confidence: clamp(0.4 + (30 - v) / 30, 0, 1),
      reason: `RSI oversold at ${round(v, 1)}`,
      value: round(v, 1),
    };
  }
  if (v > 70) {
    return {
      name: "RSI",
      signal: -1,
      confidence: clamp(0.4 + (v - 70) / 30, 0, 1),
      reason: `RSI overbought at ${round(v, 1)}`,
      value: round(v, 1),
    };
  }
  return {
    name: "RSI",
    signal: 0,
    confidence: clamp(1 - Math.abs(v - 50) / 20, 0, 0.4),
    reason: `RSI neutral at ${round(v, 1)}`,
    value: round(v, 1),
  };
}

function macdSignal(closes: number[]): IndicatorResult {
  const m = macd(closes);
  if (m == null) return insufficient("MACD", closes.length);
  const lastClose = closes[closes.length - 1];
  const rel = Math.abs(m.histogram) / (lastClose || 1); // normalise by price
  const confidence = clamp(rel / 0.01, 0.2, 1); // ~1% of price → full confidence
  const details = {
    macd: round(m.macd, 4),
    signal: round(m.signal, 4),
    histogram: round(m.histogram, 4),
  };
  if (m.histogram > 0) {
    return {
      name: "MACD",
      signal: 1,
      confidence,
      reason: `MACD bullish — line above signal (hist ${round(m.histogram, 3)})`,
      value: round(m.histogram, 4),
      details,
    };
  }
  if (m.histogram < 0) {
    return {
      name: "MACD",
      signal: -1,
      confidence,
      reason: `MACD bearish — line below signal (hist ${round(m.histogram, 3)})`,
      value: round(m.histogram, 4),
      details,
    };
  }
  return {
    name: "MACD",
    signal: 0,
    confidence: 0.2,
    reason: "MACD flat",
    value: 0,
    details,
  };
}

function maSignal(closes: number[]): IndicatorResult {
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  if (s20 == null || s50 == null) return insufficient("MA", closes.length);
  const price = closes[closes.length - 1];
  const sep = Math.abs(s20 - s50) / s50; // trend separation
  const confidence = clamp(sep / 0.03, 0.2, 1); // 3% separation → full confidence
  const details = {
    price: round(price),
    sma20: round(s20),
    sma50: round(s50),
  };
  if (price > s20 && s20 > s50) {
    return {
      name: "MA",
      signal: 1,
      confidence,
      reason: "Price above 20 & 50-day MA (uptrend)",
      value: round(s20),
      details,
    };
  }
  if (price < s20 && s20 < s50) {
    return {
      name: "MA",
      signal: -1,
      confidence,
      reason: "Price below 20 & 50-day MA (downtrend)",
      value: round(s20),
      details,
    };
  }
  return {
    name: "MA",
    signal: 0,
    confidence: 0.2,
    reason: "Moving averages mixed (no clear trend)",
    value: round(s20),
    details,
  };
}

function bollingerSignal(closes: number[]): IndicatorResult {
  const b = bollingerBands(closes, 20, 2);
  if (b == null) return insufficient("Bollinger", closes.length);
  const price = closes[closes.length - 1];
  const details = {
    upper: round(b.upper),
    middle: round(b.middle),
    lower: round(b.lower),
  };
  if (price < b.lower) {
    return {
      name: "Bollinger",
      signal: 1,
      confidence: clamp((b.lower - price) / (b.stddev || 1), 0.3, 1),
      reason: "Price below lower Bollinger Band (oversold)",
      value: round(price),
      details,
    };
  }
  if (price > b.upper) {
    return {
      name: "Bollinger",
      signal: -1,
      confidence: clamp((price - b.upper) / (b.stddev || 1), 0.3, 1),
      reason: "Price above upper Bollinger Band (overbought)",
      value: round(price),
      details,
    };
  }
  return {
    name: "Bollinger",
    signal: 0,
    confidence: 0.2,
    reason: "Price within Bollinger Bands",
    value: round(price),
    details,
  };
}

/** Compute all four indicators from OHLCV bars. */
export function computeIndicators(bars: OHLCV[]): IndicatorSet {
  const closes = bars.map((b) => b.close);
  return {
    rsi: rsiSignal(closes),
    macd: macdSignal(closes),
    ma: maSignal(closes),
    bollinger: bollingerSignal(closes),
  };
}
