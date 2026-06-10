import { computeRadar, labelForScore, type RadarInputs } from "@/lib/radar/engine";
import type { CommoditySignals } from "@/lib/radar/engine";
import type { PriceHistory, OHLCV, Ticker } from "@/lib/fetchers/yahoo";
import type { NewsItem, EconomicEvent } from "@/lib/fetchers/finnhub";

// ---- Mock builders ---------------------------------------------------------

function hist(t: Ticker, closes: number[]): PriceHistory {
  const bars: OHLCV[] = closes.map((c, i) => ({
    date: "2026-01-01",
    timestamp: i,
    open: c,
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
function alt(n: number, base: number, step: number): number[] {
  return Array.from({ length: n }, (_, i) => base + (i % 2 === 0 ? step : -step));
}
let nid = 0;
function news(headline: string): NewsItem {
  return {
    id: nid++,
    category: "general",
    datetime: 1_700_000_000 + nid,
    headline,
    summary: "",
    source: "Mock",
    url: "",
    image: "",
    related: "",
  };
}
function ev(e: Partial<EconomicEvent> & { event: string; country: string }): EconomicEvent {
  return {
    time: "2026-06-11 12:30:00",
    impact: "High",
    actual: null,
    estimate: null,
    prev: null,
    unit: "",
    ...e,
  };
}

const FIXED_TS = "2026-06-10T12:00:00.000Z";

/** Full mock matching the verified scenarios: risk-off macro + commodity-specific signals. */
function fullRadar() {
  const prices: Record<string, PriceHistory> = {
    DXY: hist("DXY", [100, 99.8, 99.5, 99.2, 99.0, 98.8]), // -1.2%
    VIX: hist("VIX", [16, 16.5, 17.2, 18, 18.8, 19.52]), // +22%
    TNX: hist("TNX", [4.5, 4.49, 4.48, 4.475, 4.47, 4.464]), // -0.8%
    SPX: hist("SPX", [5000, 4985, 4965, 4945, 4925, 4910]), // -1.8%
    XAU: hist("XAU", saw(80, 2000, 1.6, 2)),
    HG: hist("HG", saw(80, 5, -0.04, -0.05)),
    CL: hist("CL", saw(80, 88, 0.4, 0.5)),
    XAG: hist("XAG", alt(80, 24, 0.4)),
    XPT: hist("XPT", alt(80, 1000, 5)),
    NG: hist("NG", alt(80, 3, 0.05)),
  };
  const headlines: NewsItem[] = [
    news("Gold surges as haven demand climbs amid market turmoil"),
    news("Bullion climbs higher as the dollar retreats"),
    news("Gold gains as investors seek safety"),
    news("Copper tumbles on weak China demand"),
    news("Copper slides as global growth fears mount"),
    news("Copper pressured lower as recession worries weigh"),
    news("Oil surges as Iran threatens to close the Strait of Hormuz"),
    news("Crude jumps on oil supply disruption fears near Hormuz"),
    news("WTI jumps after an LNG tanker is seized in the Strait"),
    news("Tech stocks slip on soft earnings"),
  ];
  const calendar: EconomicEvent[] = [
    ev({ event: "CPI YoY", country: "US", impact: "High", actual: 2.8, estimate: 3.4 }),
    ev({ event: "Crude Oil Inventories", country: "US", impact: "High", actual: -3.5, estimate: 1.0 }),
  ];
  return computeRadar({ prices, news: headlines, calendar }, FIXED_TS);
}

const convictionCount = (s: CommoditySignals) =>
  [s.technical, s.calendar, s.news, s.marketwide, s.hormuz]
    .filter((r): r is NonNullable<typeof r> => r != null)
    .filter((r) => r.confidence > 0.3).length;

const byTicker = (r: ReturnType<typeof computeRadar>) =>
  Object.fromEntries(r.commodities.map((c) => [c.ticker, c]));

// ---- Tests -----------------------------------------------------------------

describe("computeRadar — scenarios", () => {
  const radar = fullRadar();
  const t = byTicker(radar);

  test("strong bull: XAU score > 70, label Strong Bull, reasons non-empty", () => {
    expect(t.XAU.score).toBeGreaterThan(70);
    expect(t.XAU.label).toBe("Strong Bull");
    expect(t.XAU.reasons.length).toBeGreaterThan(0);
  });

  test("strong bear: HG score < -70, label Strong Bear", () => {
    expect(t.HG.score).toBeLessThan(-70);
    expect(t.HG.label).toBe("Strong Bear");
  });

  test("low-confidence damped: NG has < 3 conviction signals, confidence < 0.5", () => {
    expect(convictionCount(t.NG.signals)).toBeLessThan(3);
    expect(t.NG.confidence).toBeLessThan(0.5);
    // damping keeps the magnitude muted
    expect(Math.abs(t.NG.score)).toBeLessThan(40);
  });

  test("hormuz is null for non-energy (XAU, HG)", () => {
    expect(t.XAU.signals.hormuz).toBeNull();
    expect(t.HG.signals.hormuz).toBeNull();
  });

  test("hormuz is present for energy (CL, NG)", () => {
    expect(t.CL.signals.hormuz).not.toBeNull();
    expect(t.NG.signals.hormuz).not.toBeNull();
  });

  test("market mood dominantCommodity has the highest absolute score", () => {
    const maxAbs = Math.max(...radar.commodities.map((c) => Math.abs(c.score)));
    const dom = radar.commodities.find((c) => c.ticker === radar.mood.dominantCommodity)!;
    expect(Math.abs(dom.score)).toBe(maxAbs);
    expect(radar.mood.dominantReason.length).toBeGreaterThan(0);
  });

  test("reasons are readable: non-empty, human phrases (no raw identifiers)", () => {
    for (const c of radar.commodities) {
      expect(c.reasons.length).toBeGreaterThan(0);
      for (const r of c.reasons) {
        expect(typeof r).toBe("string");
        expect(r.trim().length).toBeGreaterThan(0);
        expect(r).toContain(" "); // a phrase, not a token
        expect(r).not.toMatch(/undefined|NaN|\[object|null/);
      }
    }
  });
});

describe("label boundaries (exact README bands)", () => {
  test.each([
    [100, "Strong Bull"],
    [70, "Strong Bull"],
    [69, "Cautious Optimism"],
    [30, "Cautious Optimism"],
    [29, "Neutral / Mixed"],
    [0, "Neutral / Mixed"],
    [-29, "Neutral / Mixed"],
    [-30, "Risk-Off"],
    [-69, "Risk-Off"],
    [-70, "Strong Bear"],
    [-100, "Strong Bear"],
  ])("labelForScore(%i) === %s", (score, label) => {
    expect(labelForScore(score)).toBe(label);
  });
});

describe("neutral exclusion (score === 0 not counted in denominator)", () => {
  test("a tone-neutral news signal (score 0, confidence > 0) does not dilute the score", () => {
    // XAU with a clear bullish technical, balanced gold headlines (neutral news),
    // and NO macro/calendar so only technical is directional.
    const inputs: RadarInputs = {
      prices: { XAU: hist("XAU", saw(80, 2000, 1.6, 2)) }, // bullish technical
      news: [news("Gold rises on demand"), news("Gold falls on profit-taking")], // 1 bull + 1 bear → score 0
      calendar: [],
    };
    const radar = computeRadar(inputs, FIXED_TS);
    const xau = radar.commodities.find((c) => c.ticker === "XAU")!;

    // News is the tricky neutral: score 0 but confidence > 0.
    expect(xau.signals.news.score).toBe(0);
    expect(xau.signals.news.confidence).toBeGreaterThan(0);
    // Calendar + marketwide are also neutral (no data).
    expect(xau.signals.calendar.score).toBe(0);
    expect(xau.signals.marketwide.score).toBe(0);

    // Technical must be active for this test to be meaningful.
    expect(xau.signals.technical.score).not.toBe(0);

    // With neutrals excluded, the pre-damp weighted equals technical.score, so the
    // final score is exactly technical.score × 100 × damping. If the neutral news
    // were wrongly included in the denominator, |score| would be smaller.
    const conviction = convictionCount(xau.signals);
    const damp = Math.min(conviction / 3, 1);
    const expected = Math.max(
      -100,
      Math.min(100, Math.round(xau.signals.technical.score * 100 * damp)),
    );
    expect(xau.score).toBe(expected);
  });
});
