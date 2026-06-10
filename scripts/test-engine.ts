// Test the fusion engine with realistic mock data. Run: npm run test:engine
//
// Scenarios:
//   XAU — strong bull   (risk-off tailwind + bullish news + soft CPI)
//   HG  — strong bear   (risk-off headwind + bearish news + downtrend)
//   NG  — low-conviction, DAMPED (only 2 conviction signals, conflicting)
//   CL  — Hormuz-affected (escalation overlay pushes crude up vs macro headwind)

import { computeRadar, type CommoditySignals } from "../src/lib/radar/engine.ts";
import type { PriceHistory, OHLCV, Ticker } from "../src/lib/fetchers/yahoo.ts";
import type { NewsItem, EconomicEvent } from "../src/lib/fetchers/finnhub.ts";

function hist(t: Ticker, closes: number[]): PriceHistory {
  const bars: OHLCV[] = closes.map((c, i) => ({
    date: "2026-01-01", timestamp: i, open: c, high: c * 1.004, low: c * 0.996, close: c, volume: 1000,
  }));
  return { ticker: t, yahooSymbol: t, currency: "USD", bars };
}
// sawtooth: net drift with periodic pullbacks (keeps RSI off the rails)
function saw(n: number, base: number, g: number, d: number, period = 3) {
  const out: number[] = []; let p = base;
  for (let i = 0; i < n; i++) { p += i % period === period - 1 ? -d : g; out.push(p); }
  return out;
}
// strictly alternating → trendless → low-confidence/neutral technical
function alt(n: number, base: number, step: number) {
  return Array.from({ length: n }, (_, i) => base + (i % 2 === 0 ? step : -step));
}

let nid = 0;
const news = (headline: string): NewsItem => ({
  id: nid++, category: "general", datetime: 1_700_000_000 + nid,
  headline, summary: "", source: "Mock", url: "", image: "", related: "",
});
const ev = (e: Partial<EconomicEvent> & { event: string; country: string }): EconomicEvent => ({
  time: "2026-06-11 12:30:00", impact: "High", actual: null, estimate: null, prev: null, unit: "", ...e,
});

// --- Shared macro backdrop: moderate RISK-OFF + weak dollar ---
const prices: Record<string, PriceHistory> = {
  DXY: hist("DXY", [100, 99.8, 99.5, 99.2, 99.0, 98.8]), // -1.2%
  VIX: hist("VIX", [16, 16.5, 17.2, 18, 18.8, 19.52]), // +22%
  TNX: hist("TNX", [4.5, 4.49, 4.48, 4.475, 4.47, 4.464]), // -0.8%
  SPX: hist("SPX", [5000, 4985, 4965, 4945, 4925, 4910]), // -1.8%
  // commodities
  XAU: hist("XAU", saw(80, 2000, 1.6, 2)), // gentle uptrend
  HG: hist("HG", saw(80, 5, -0.04, -0.05)), // downtrend, low price → high conf
  CL: hist("CL", saw(80, 88, 0.4, 0.5)), // mild uptrend
  XAG: hist("XAG", alt(80, 24, 0.4)), // trendless
  XPT: hist("XPT", alt(80, 1000, 5)), // trendless
  NG: hist("NG", alt(80, 3, 0.05)), // trendless
};

const headlines: NewsItem[] = [
  // Gold — bullish
  news("Gold surges as haven demand climbs amid market turmoil"),
  news("Bullion climbs higher as the dollar retreats"),
  news("Gold gains as investors seek safety"),
  // Copper — bearish
  news("Copper tumbles on weak China demand"),
  news("Copper slides as global growth fears mount"),
  news("Copper pressured lower as recession worries weigh"),
  // Crude — bullish + Hormuz escalation
  news("Oil surges as Iran threatens to close the Strait of Hormuz"),
  news("Crude jumps on oil supply disruption fears near Hormuz"),
  news("WTI jumps after an LNG tanker is seized in the Strait"),
  // noise
  news("Tech stocks slip on soft earnings"),
];

const calendar: EconomicEvent[] = [
  ev({ event: "CPI YoY", country: "US", impact: "High", actual: 2.8, estimate: 3.4 }), // soft → bullish metals
  ev({ event: "Crude Oil Inventories", country: "US", impact: "High", actual: -3.5, estimate: 1.0 }), // draw → bullish CL
];

const radar = computeRadar({ prices, news: headlines, calendar }, "2026-06-10T12:00:00.000Z");

const convictionCount = (s: CommoditySignals) =>
  [s.technical, s.calendar, s.news, s.marketwide, s.hormuz]
    .filter((r): r is NonNullable<typeof r> => r != null)
    .filter((r) => r.confidence > 0.3).length;

console.log("=== Radar engine — fused output ===\n");
for (const c of radar.commodities) {
  console.log(
    `${c.ticker.padEnd(4)} score=${String(c.score).padStart(4)} conf=${c.confidence.toFixed(2)} ` +
      `[${c.label}]  conviction=${convictionCount(c.signals)}  hormuz=${c.signals.hormuz ? "yes" : "—"}`,
  );
  for (const r of c.reasons) console.log(`       - ${r}`);
}
console.log(
  `\nMARKET MOOD: ${radar.mood.score} [${radar.mood.label}] ` +
    `dominant=${radar.mood.dominantCommodity} :: ${radar.mood.dominantReason}`,
);

// ---- Assertions ----
const byTicker = Object.fromEntries(radar.commodities.map((c) => [c.ticker, c]));
const fail: string[] = [];

const xau = byTicker["XAU"];
if (xau.label !== "Strong Bull" || xau.score < 70) fail.push(`XAU expected Strong Bull (got ${xau.score} ${xau.label})`);
if (xau.signals.hormuz !== null) fail.push("XAU hormuz should be null (non-energy)");

const hg = byTicker["HG"];
if (hg.label !== "Strong Bear" || hg.score > -70) fail.push(`HG expected Strong Bear (got ${hg.score} ${hg.label})`);
if (hg.signals.hormuz !== null) fail.push("HG hormuz should be null (non-energy)");

const ng = byTicker["NG"];
if (ng.signals.hormuz === null) fail.push("NG hormuz should be present (energy)");
if (convictionCount(ng.signals) >= 3) fail.push("NG should be damped (<3 conviction signals)");
if (ng.confidence >= 0.5) fail.push(`NG should be low-confidence (got ${ng.confidence})`);
if (Math.abs(ng.score) > 30) fail.push(`NG damped score should be muted (got ${ng.score})`);

const cl = byTicker["CL"];
if (cl.signals.hormuz === null) fail.push("CL hormuz should be present");
if (!cl.signals.hormuz || cl.signals.hormuz.score <= 0.3) fail.push("CL hormuz should be bullish");
if (cl.score <= 0) fail.push(`CL should be net bullish from Hormuz overlay (got ${cl.score})`);
if (!cl.reasons.some((r) => /hormuz/i.test(r))) fail.push("CL reasons should mention Hormuz");

for (const c of radar.commodities) {
  if (c.reasons.length === 0) fail.push(`${c.ticker} has empty reasons[]`);
}
if (!radar.mood.dominantCommodity || !radar.mood.dominantReason) fail.push("mood missing dominant fields");

if (fail.length) {
  console.error("\nFAIL:\n  - " + fail.join("\n  - "));
  process.exit(1);
}
console.log("\nPASS: strong-bull, strong-bear, damped, and Hormuz cases all correct; reasons populated everywhere.");
