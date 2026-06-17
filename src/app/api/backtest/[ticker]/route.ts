import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { COMMODITY_TICKERS, type CommodityTicker } from "@/lib/fetchers/yahoo";
import { loadPrices } from "@/lib/radar/load";
import { runBacktest } from "@/lib/radar/backtest";

// GET /api/backtest/[ticker] — replay the price-model score vs forward returns.
// Reads price history (Supabase cache preferred, Yahoo fallback) and runs the
// pure backtest engine. Cached per ticker for an hour — the inputs only change
// once a day when the cache refreshes.
function getBacktest(t: CommodityTicker) {
  return unstable_cache(
    async () => {
      const prices = await loadPrices("1y");
      return runBacktest(t, prices[t], prices);
    },
    ["backtest", t],
    { revalidate: 3600, tags: ["backtest"] },
  )();
}

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

  try {
    const result = await getBacktest(upper as CommodityTicker);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to run backtest", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
