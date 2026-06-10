// Finnhub fetcher — market news + economic calendar.
// Requires FINNHUB_API_KEY. Free tier: 60 calls/min (the radar layer caches 30s).

import { fetchJson } from "@/api/http";

const BASE = "https://finnhub.io/api/v1";

function requireKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key || key === "your_key_here") {
    throw new Error(
      "FINNHUB_API_KEY is not set (or still the placeholder). Add a real key to .env.local.",
    );
  }
  return key;
}

// ---- News ------------------------------------------------------------------

export type NewsCategory =
  | "general" | "forex" | "crypto" | "merger";

export interface NewsItem {
  id: number;
  category: string;
  /** Unix timestamp (seconds). */
  datetime: number;
  headline: string;
  source: string;
  summary: string;
  url: string;
  image: string;
  /** Related tickers/symbols, comma-separated per Finnhub. */
  related: string;
}

/**
 * Fetch general market news. Finnhub's free `/news` endpoint returns the
 * latest market headlines; the radar's Hormuz signal and news sentiment are
 * derived from these downstream (engine, not here).
 */
export async function fetchNews(
  category: NewsCategory = "general",
): Promise<NewsItem[]> {
  const key = requireKey();
  const url = `${BASE}/news?category=${encodeURIComponent(category)}&token=${key}`;
  return fetchJson<NewsItem[]>(url, {
    headers: { Accept: "application/json" },
  });
}

// ---- Economic calendar -----------------------------------------------------

export interface EconomicEvent {
  /** "YYYY-MM-DD HH:mm:ss" per Finnhub. */
  time: string;
  country: string;
  event: string;
  impact: string;
  actual: number | null;
  estimate: number | null;
  prev: number | null;
  unit: string;
}

interface EconomicCalendarResponse {
  economicCalendar?: EconomicEvent[];
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch upcoming economic events in [from, to] (inclusive), YYYY-MM-DD.
 * Defaults to today → +7 days.
 *
 * NOTE: `/calendar/economic` is a premium endpoint on Finnhub — the free tier
 * may return 403. The fetcher surfaces that as an HttpError for the caller.
 */
export async function fetchEconomicCalendar(
  range: { from?: string; to?: string } = {},
): Promise<EconomicEvent[]> {
  const key = requireKey();
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const from = range.from ?? ymd(now);
  const to = range.to ?? ymd(weekOut);

  const url = `${BASE}/calendar/economic?from=${from}&to=${to}&token=${key}`;
  const json = await fetchJson<EconomicCalendarResponse>(url, {
    headers: { Accept: "application/json" },
  });
  return json.economicCalendar ?? [];
}
