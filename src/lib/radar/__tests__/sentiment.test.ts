import { scoreMarketSentiment } from "@/lib/radar/signals/sentiment";
import type { NewsItem } from "@/lib/fetchers/finnhub";
import type { SignalResult } from "@/lib/radar/signals/types";

let id = 0;
const mk = (headline: string): NewsItem => ({
  id: id++, category: "general", datetime: 1_700_000_000 + id,
  headline, summary: "", source: "Mock", url: "", image: "", related: "",
});

function assertShape(r: SignalResult) {
  expect(r.score).toBeGreaterThanOrEqual(-1);
  expect(r.score).toBeLessThanOrEqual(1);
  expect(r.confidence).toBeGreaterThanOrEqual(0);
  expect(r.confidence).toBeLessThanOrEqual(1);
  expect(Array.isArray(r.reasons)).toBe(true);
  expect(r.reasons.length).toBeGreaterThan(0);
}

describe("scoreMarketSentiment", () => {
  test("output shape", () =>
    assertShape(scoreMarketSentiment([mk("Stocks rally as demand surges higher")])));

  test("empty feed → neutral", () => {
    const r = scoreMarketSentiment([]);
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
  });

  test("no directional headlines → neutral", () => {
    const r = scoreMarketSentiment([mk("Company schedules its quarterly meeting")]);
    expect(r.score).toBe(0);
    expect(r.confidence).toBe(0);
  });

  test("bullish feed → positive tone", () => {
    const r = scoreMarketSentiment([
      mk("Stocks rally on strong demand"),
      mk("Markets surge higher"),
      mk("Shares jump as economy rebounds"),
    ]);
    expect(r.score).toBeGreaterThan(0);
  });

  test("bearish feed → negative tone", () => {
    const r = scoreMarketSentiment([
      mk("Stocks plunge on weak data"),
      mk("Markets tumble as recession fears mount"),
      mk("Shares slump as the selloff deepens"),
    ]);
    expect(r.score).toBeLessThan(0);
  });

  test("balanced feed → near-neutral score", () => {
    const r = scoreMarketSentiment([
      mk("Stocks rally on strong demand"),
      mk("Markets plunge on weak data"),
    ]);
    expect(Math.abs(r.score)).toBeLessThan(0.5);
  });

  test("confidence rises with the number of DISTINCT bullish stories", () => {
    const few = scoreMarketSentiment([mk("Stocks rally higher")]);
    const many = scoreMarketSentiment([
      mk("Stocks rally on strong demand"),
      mk("Markets surge to record highs"),
      mk("Shares jump as the economy rebounds"),
      mk("Equities climb on upbeat data"),
      mk("Indexes soar as confidence rises"),
      mk("Wall Street gains as the outlook brightens"),
      mk("Bonds rally, yields tighten"),
      mk("Risk appetite boosts global shares"),
      mk("Buying lifts the broader market higher"),
      mk("Optimism returns, demand strong"),
      mk("Prices climb as sentiment improves"),
      mk("Growth accelerates, stocks advance"),
    ]);
    // identical copies would dedupe to one — distinct stories build confidence
    expect(many.confidence).toBeGreaterThan(few.confidence);
  });
});
