// Test technical indicators with synthetic OHLCV. Run: npm run test:indicators
import { computeIndicators, type IndicatorSet } from "../src/lib/radar/indicators.ts";
import type { OHLCV } from "../src/lib/fetchers/yahoo.ts";

// Build OHLCV bars from a list of closes (open/high/low derived around close).
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

// Accelerating uptrend (curvature → positive MACD momentum, like real data)
const up = Array.from({ length: N }, (_, i) => 100 + i * 0.5 + 0.015 * i * i);

// Accelerating downtrend (negative MACD momentum)
const down = Array.from({ length: N }, (_, i) => 230 - i * 0.5 - 0.015 * i * i);

// Flat then a sharp sell-off at the end (oversold dip)
const dip = Array.from({ length: N }, (_, i) =>
  i < N - 8 ? 100 + Math.sin(i / 5) * 1.5 : 100 - (i - (N - 8)) * 4,
);

function show(name: string, set: IndicatorSet) {
  console.log(`[${name}]`);
  for (const r of [set.rsi, set.macd, set.ma, set.bollinger]) {
    console.log(
      `   ${r.name.padEnd(9)} signal=${String(r.signal).padStart(2)} ` +
        `conf=${r.confidence.toFixed(2)}  ${r.reason}`,
    );
  }
  console.log("");
}

console.log("=== Indicator smoke test ===\n");
const upSet = computeIndicators(bars(up));
const downSet = computeIndicators(bars(down));
const dipSet = computeIndicators(bars(dip));
show("Uptrend", upSet);
show("Downtrend", downSet);
show("Sharp sell-off (oversold)", dipSet);

// Sanity: insufficient data path
const tiny = computeIndicators(bars([100, 101, 102]));
console.log(`[Tiny series] MA: ${tiny.ma.reason} (signal=${tiny.ma.signal})\n`);

// Assertions
if (upSet.ma.signal !== 1) throw new Error("uptrend MA should be bullish");
if (downSet.ma.signal !== -1) throw new Error("downtrend MA should be bearish");
if (upSet.macd.signal !== 1) throw new Error("uptrend MACD should be bullish");
if (downSet.macd.signal !== -1) throw new Error("downtrend MACD should be bearish");
if (dipSet.rsi.signal !== 1) throw new Error("sell-off RSI should be oversold/bullish");
if (dipSet.bollinger.signal !== 1)
  throw new Error("sell-off should break lower Bollinger band");
if (tiny.ma.signal !== 0 || tiny.ma.confidence !== 0)
  throw new Error("tiny series should be insufficient/neutral");

console.log("PASS: trends, oversold reversal, and insufficient-data paths all correct.");
