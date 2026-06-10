// Test the four signal scorers with mock data. Run: npm run test:signals
import { scoreTechnical } from "../src/lib/radar/signals/technical.ts";
import { scoreMarketwide } from "../src/lib/radar/signals/marketwide.ts";
import { scoreNews } from "../src/lib/radar/signals/news.ts";
import { scoreCalendar } from "../src/lib/radar/signals/calendar.ts";
import type { PriceHistory, OHLCV, Ticker } from "../src/lib/fetchers/yahoo.ts";
import type { NewsItem, EconomicEvent } from "../src/lib/fetchers/finnhub.ts";
import type { SignalResult } from "../src/lib/radar/signals/types.ts";

function history(ticker: Ticker, closes: number[]): PriceHistory {
  const bars: OHLCV[] = closes.map((c, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    timestamp: 1_700_000_000 + i * 86400,
    open: c * 0.999,
    high: c * 1.004,
    low: c * 0.996,
    close: c,
    volume: 1000,
  }));
  return { ticker, yahooSymbol: ticker, currency: "USD", bars };
}

let nid = 0;
function news(headline: string): NewsItem {
  return {
    id: nid++, category: "general", datetime: 1_700_000_000 + nid,
    headline, summary: "", source: "Mock", url: "", image: "", related: "",
  };
}
function event(
  e: Partial<EconomicEvent> & { event: string; country: string },
): EconomicEvent {
  return {
    time: "2026-06-11 12:30:00", impact: "High", actual: null,
    estimate: null, prev: null, unit: "", ...e,
  };
}

function print(label: string, r: SignalResult) {
  console.log(`[${label}]  score=${r.score}  conf=${r.confidence}`);
  for (const reason of r.reasons) console.log(`    - ${reason}`);
  console.log("");
}

console.log("=== Signal scorers smoke test ===\n");

// --- Technical: healthy uptrend (sawtooth: two up-bars then a pullback).
//     Net upward drift keeps MA & MACD bullish while the regular pullbacks
//     keep RSI ~64 (neutral, not overbought) and price inside the bands. ---
const N = 80;
const goldCloses: number[] = [];
{
  let p = 2000;
  for (let i = 0; i < N; i++) {
    p += i % 3 === 2 ? -2 : 1.6; // down every 3rd bar, up otherwise
    goldCloses.push(p);
  }
}
const goldUp = history("XAU", goldCloses);
const tech = scoreTechnical(goldUp);
print("Technical / Gold uptrend", tech);

// --- Market-wide for Gold: dollar falling, VIX rising (risk-off) => bullish gold ---
const flat = (t: Ticker, base: number) => history(t, Array.from({ length: 10 }, () => base));
const prices: Record<string, PriceHistory> = {
  DXY: history("DXY", [102, 102, 101.5, 101, 100.5, 100]), // falling ~2%
  VIX: history("VIX", [15, 15.5, 16, 17, 18, 19]), // rising (risk-off)
  TNX: flat("TNX", 4.2),
  SPX: history("SPX", [5000, 4990, 4980, 4970, 4960, 4950]), // slipping
};
const mwGold = scoreMarketwide("XAU", prices);
print("Market-wide / Gold (USD↓, VIX↑)", mwGold);

// --- Market-wide for Copper with same backdrop (risk-off hurts industrials) ---
const mwCopper = scoreMarketwide("HG", prices);
print("Market-wide / Copper (same backdrop)", mwCopper);

// --- News: bullish crude headlines ---
const crudeNews = [
  news("Oil prices surge as demand climbs and supply tightens"),
  news("Crude rally continues, WTI jumps to multi-month high"),
  news("Analysts see higher oil on robust demand"),
  news("Tech stocks fall on weak earnings"), // irrelevant
];
const newsCL = scoreNews("CL", crudeNews);
print("News / Crude (bullish)", newsCL);

// --- Calendar: bearish crude (inventory build above estimate) + pending FOMC ---
const events: EconomicEvent[] = [
  event({ event: "Crude Oil Inventories", country: "US", impact: "High", actual: 5.2, estimate: 1.0 }),
  event({ event: "FOMC Rate Decision", country: "US", impact: "High" }), // pending
];
const calCL = scoreCalendar("CL", events);
print("Calendar / Crude (inventory build + pending FOMC)", calCL);

// --- Calendar: hot CPI => bearish gold ---
const cpi: EconomicEvent[] = [
  event({ event: "CPI YoY", country: "US", impact: "High", actual: 3.8, estimate: 3.2 }),
];
const calGold = scoreCalendar("XAU", cpi);
print("Calendar / Gold (hot CPI)", calGold);

// --- Assertions ---
const fail: string[] = [];
if (!(tech.score > 0.2)) fail.push("technical gold uptrend should be bullish");
if (!(mwGold.score > 0.2)) fail.push("market-wide gold should be bullish (USD down, VIX up)");
if (!(mwCopper.score < 0)) fail.push("market-wide copper should be bearish in risk-off");
if (!(newsCL.score > 0.3)) fail.push("crude news should be bullish");
if (!(calCL.score < 0)) fail.push("crude inventory build should be bearish");
if (!(calGold.score < 0)) fail.push("hot CPI should be bearish gold");

if (fail.length) {
  console.error("FAIL:\n  - " + fail.join("\n  - "));
  process.exit(1);
}
console.log("PASS: all four scorers produce correct direction + reasons.");
