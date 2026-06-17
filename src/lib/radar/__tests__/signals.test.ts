import { scoreTechnical } from "@/lib/radar/signals/technical";
import { scoreNews } from "@/lib/radar/signals/news";
import { scoreCalendar } from "@/lib/radar/signals/calendar";
import { scoreMarketwide } from "@/lib/radar/signals/marketwide";
import type { PriceHistory, OHLCV, Ticker } from "@/lib/fetchers/yahoo";
import type { NewsItem, EconomicEvent } from "@/lib/fetchers/finnhub";
import type { SignalResult } from "@/lib/radar/signals/types";

// ---- mock builders ---------------------------------------------------------

function hist(t: Ticker, closes: number[]): PriceHistory {
  const bars: OHLCV[] = closes.map((c, i) => ({
    date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    timestamp: 1_700_000_000 + i * 86400,
    open: c * 0.999,
    high: c * 1.004,
    low: c * 0.996,
    close: c,
    volume: 1000,
  }));
  return { ticker: t, yahooSymbol: t, currency: "USD", bars };
}
function saw(n: number, base: number, g: number, d: number, period = 3): number[] {
  const out: number[] = [];
  let p = base;
  for (let i = 0; i < n; i++) {
    p += i % period === period - 1 ? -d : g;
    out.push(p);
  }
  return out;
}
let nid = 0;
const news = (headline: string): NewsItem => ({
  id: nid++, category: "general", datetime: 1_700_000_000 + nid,
  headline, summary: "", source: "Mock", url: "", image: "", related: "",
});
const ev = (e: Partial<EconomicEvent> & { event: string; country: string }): EconomicEvent => ({
  time: "2026-06-11 12:30:00", impact: "High", actual: null, estimate: null, prev: null, unit: "", ...e,
});

function assertShape(r: SignalResult) {
  expect(r.score).toBeGreaterThanOrEqual(-1);
  expect(r.score).toBeLessThanOrEqual(1);
  expect(r.confidence).toBeGreaterThanOrEqual(0);
  expect(r.confidence).toBeLessThanOrEqual(1);
  expect(Array.isArray(r.reasons)).toBe(true);
  expect(r.reasons.length).toBeGreaterThan(0);
}

// ---- Technical (weight 1.0) ------------------------------------------------

describe("scoreTechnical", () => {
  const bull = hist("XAU", saw(80, 2000, 1.6, 2)); // gentle uptrend (RSI not pinned)
  const bear = hist("HG", saw(80, 5, -0.04, -0.05)); // low-price downtrend

  test("output shape", () => assertShape(scoreTechnical(bull)));

  test("undefined / empty history → neutral", () => {
    const a = scoreTechnical(undefined);
    expect(a.score).toBe(0);
    expect(a.confidence).toBe(0);
    expect(a.reasons.length).toBeGreaterThan(0);
    const b = scoreTechnical(hist("XAU", []));
    expect(b.score).toBe(0);
    expect(b.confidence).toBe(0);
  });

  test("single data point → neutral", () => {
    const r = scoreTechnical(hist("XAU", [2000]));
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
  });

  test("uptrend → bullish (positive)", () => {
    expect(scoreTechnical(bull).score).toBeGreaterThan(0);
  });
  test("downtrend → bearish (negative)", () => {
    expect(scoreTechnical(bear).score).toBeLessThan(0);
  });
});

// ---- News (weight 0.6) -----------------------------------------------------

describe("scoreNews", () => {
  const goldBull = [
    news("Gold surges as haven demand climbs"),
    news("Bullion climbs higher as the dollar retreats"),
    news("Gold gains as investors seek safety"),
  ];
  const copperBear = [
    news("Copper tumbles on weak China demand"),
    news("Copper slides as global growth fears mount"),
    news("Copper pressured lower as recession worries weigh"),
  ];

  test("output shape", () => assertShape(scoreNews("XAU", goldBull)));

  test("empty news → neutral", () => {
    const r = scoreNews("XAU", []);
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  test("no commodity-relevant headlines → neutral", () => {
    const r = scoreNews("XAU", [news("Apple unveils new iPhone")]);
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
  });

  test("bullish gold headlines → positive", () => {
    expect(scoreNews("XAU", goldBull).score).toBeGreaterThan(0);
  });
  test("bearish copper headlines → negative", () => {
    expect(scoreNews("HG", copperBear).score).toBeLessThan(0);
  });
});

// ---- Calendar (weight 0.8) -------------------------------------------------

describe("scoreCalendar", () => {
  const crudeBuild = [
    ev({ event: "Crude Oil Inventories", country: "US", impact: "High", actual: 5.2, estimate: 1.0 }),
  ];
  const softCpi = [
    ev({ event: "CPI YoY", country: "US", impact: "High", actual: 2.8, estimate: 3.4 }),
  ];

  test("output shape", () => assertShape(scoreCalendar("CL", crudeBuild)));

  test("empty events → neutral", () => {
    const r = scoreCalendar("CL", []);
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
  });

  test("event for another commodity → neutral", () => {
    const r = scoreCalendar("XAU", crudeBuild); // crude inventory doesn't affect gold
    expect(r.score).toBe(0);
  });

  test("crude inventory build (actual > estimate) → bearish crude", () => {
    expect(scoreCalendar("CL", crudeBuild).score).toBeLessThan(0);
  });
  test("soft CPI (actual < estimate) → bullish gold", () => {
    expect(scoreCalendar("XAU", softCpi).score).toBeGreaterThan(0);
  });
});

// ---- Market-wide (weight 0.7) ----------------------------------------------

describe("scoreMarketwide", () => {
  const riskOff: Record<string, PriceHistory> = {
    DXY: hist("DXY", [100, 99.8, 99.5, 99.2, 99.0, 98.8]), // dollar down
    VIX: hist("VIX", [16, 16.5, 17.2, 18, 18.8, 19.52]), // fear up
    TNX: hist("TNX", [4.5, 4.49, 4.48, 4.475, 4.47, 4.464]), // yields down
    SPX: hist("SPX", [5000, 4985, 4965, 4945, 4925, 4910]), // stocks down
  };

  test("output shape", () => assertShape(scoreMarketwide("XAU", riskOff)));

  test("no macro data → neutral", () => {
    const r = scoreMarketwide("XAU", {});
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
  });

  test("risk-off backdrop → gold bullish (haven)", () => {
    expect(scoreMarketwide("XAU", riskOff).score).toBeGreaterThan(0);
  });
  test("risk-off backdrop → copper bearish (growth proxy)", () => {
    expect(scoreMarketwide("HG", riskOff).score).toBeLessThan(0);
  });
});
