import { NextResponse } from "next/server";
import { fetchNews, type NewsItem } from "@/lib/fetchers/finnhub";
import { commoditiesForNews } from "@/lib/radar/signals/news";
import { COMMODITY_TICKERS, type CommodityTicker } from "@/lib/fetchers/yahoo";
import { decideRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

// GET /api/news — Finnhub headlines grouped by commodity (word-boundary match).
export async function GET(req: Request) {
  const rl = decideRateLimit(req, "news");
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { ...rlHeaders, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let news: NewsItem[];
  try {
    news = await fetchNews("general");
  } catch (err) {
    // Degrade gracefully (e.g. missing/placeholder key) — empty groups.
    return NextResponse.json(
      {
        grouped: Object.fromEntries(COMMODITY_TICKERS.map((t) => [t, []])),
        count: 0,
        warning: err instanceof Error ? err.message : String(err),
      },
      { headers: rlHeaders },
    );
  }

  const grouped = Object.fromEntries(
    COMMODITY_TICKERS.map((t) => [t, [] as NewsItem[]]),
  ) as Record<CommodityTicker, NewsItem[]>;

  for (const item of news) {
    for (const t of commoditiesForNews(item)) grouped[t].push(item);
  }

  return NextResponse.json(
    { grouped, count: news.length },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
        ...rlHeaders,
      },
    },
  );
}
