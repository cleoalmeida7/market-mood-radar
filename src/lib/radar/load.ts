// Loads the radar's inputs from live sources, tolerantly.
// Kept OUT of engine.ts so the engine stays pure. The API routes call this.

import {
  ALL_TICKERS,
  fetchPriceHistory,
  type PriceHistory,
  type YahooRange,
} from "@/lib/fetchers/yahoo";
import {
  fetchNews,
  fetchEconomicCalendar,
  type NewsItem,
  type EconomicEvent,
} from "@/lib/fetchers/finnhub";
import type { RadarInputs } from "@/lib/radar/engine";

/**
 * Fetch price history for all tickers, tolerating individual failures
 * (a single ticker erroring shouldn't sink the whole radar). 6-month range
 * gives the indicators enough bars (50-day MA, MACD warm-up).
 */
export async function loadPrices(
  range: YahooRange = "6mo",
): Promise<Record<string, PriceHistory>> {
  const results = await Promise.allSettled(
    ALL_TICKERS.map((t) => fetchPriceHistory(t, { range, interval: "1d" })),
  );
  const prices: Record<string, PriceHistory> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled") prices[ALL_TICKERS[i]] = r.value;
    else console.warn(`[radar] price fetch failed for ${ALL_TICKERS[i]}:`, r.reason);
  });
  return prices;
}

/** News, degrading to [] when Finnhub is unkeyed / unavailable. */
export async function loadNews(): Promise<NewsItem[]> {
  try {
    return await fetchNews("general");
  } catch (err) {
    console.warn("[radar] news fetch failed:", err);
    return [];
  }
}

/** Economic calendar, degrading to [] (free tier often lacks access). */
export async function loadCalendar(): Promise<EconomicEvent[]> {
  try {
    return await fetchEconomicCalendar();
  } catch (err) {
    console.warn("[radar] calendar fetch failed:", err);
    return [];
  }
}

/** Gather all radar inputs concurrently, each source failing soft. */
export async function loadRadarInputs(): Promise<RadarInputs> {
  const [prices, news, calendar] = await Promise.all([
    loadPrices("6mo"),
    loadNews(),
    loadCalendar(),
  ]);
  return { prices, news, calendar };
}
