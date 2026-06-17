// Loads the radar's inputs from live sources, tolerantly.
// Kept OUT of engine.ts so the engine stays pure. The API routes call this.

import {
  ALL_TICKERS,
  COMMODITY_TICKERS,
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
import { readCachedPrices } from "@/lib/radar/price-cache";
import type { RadarInputs } from "@/lib/radar/engine";

/** Minimum bars per commodity for the Supabase cache to be considered usable. */
const MIN_CACHE_BARS = 60;

function cacheUsable(prices: Record<string, PriceHistory>): boolean {
  return COMMODITY_TICKERS.every((t) => (prices[t]?.bars.length ?? 0) >= MIN_CACHE_BARS);
}

/** Fetch all tickers straight from Yahoo, tolerating individual failures. */
async function fetchPricesFromYahoo(
  range: YahooRange,
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

/**
 * Load price history. Prefers the Supabase cache (up to 12 months of bars, kept
 * fresh by the cron) so we don't hit Yahoo on every request; falls back to Yahoo
 * when the cache is empty/thin (e.g. before the first refresh).
 */
export async function loadPrices(
  range: YahooRange = "1y",
): Promise<Record<string, PriceHistory>> {
  const cached = await readCachedPrices();
  if (cacheUsable(cached)) return cached;
  return fetchPricesFromYahoo(range);
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
    loadPrices("1y"),
    loadNews(),
    loadCalendar(),
  ]);
  return { prices, news, calendar };
}
