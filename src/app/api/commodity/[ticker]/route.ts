import { NextResponse } from "next/server";
import {
  fetchPriceHistory,
  COMMODITY_TICKERS,
  YAHOO_SYMBOLS,
  TICKER_LABELS,
  type CommodityTicker,
} from "@/lib/fetchers/yahoo";
import { computeIndicators, computeIndicatorSeries } from "@/lib/radar/indicators";
import { readCachedPrices } from "@/lib/radar/price-cache";

// GET /api/commodity/[ticker] — OHLCV history + computed indicators.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();

  if (!(COMMODITY_TICKERS as readonly string[]).includes(upper)) {
    return NextResponse.json(
      { error: `Unknown ticker: ${ticker}`, valid: COMMODITY_TICKERS },
      { status: 400 },
    );
  }
  const t = upper as CommodityTicker;

  try {
    // Prefer the Supabase cache (12mo of bars); fall back to Yahoo if thin/empty.
    const cached = await readCachedPrices([t]);
    const history =
      (cached[t]?.bars.length ?? 0) >= 60
        ? cached[t]
        : await fetchPriceHistory(t, { range: "2y", interval: "1d" });
    const indicators = computeIndicators(history.bars);
    const series = computeIndicatorSeries(history.bars);
    return NextResponse.json(
      {
        ticker: t,
        label: TICKER_LABELS[t],
        symbol: YAHOO_SYMBOLS[t],
        currency: history.currency,
        bars: history.bars,
        indicators,
        series,
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch price history", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
