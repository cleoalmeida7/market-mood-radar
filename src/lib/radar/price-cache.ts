// Supabase-backed price cache. Stores up to 12 months of OHLCV per ticker in
// `price_history` so the radar reads from the DB instead of hitting Yahoo on
// every request (and so the indicators have 50+ bars for MA-50 / MACD).
//
// - refreshPriceCache(): fetch from Yahoo (tolerant) and upsert into Supabase.
// - readCachedPrices(): read the cache back into PriceHistory objects.
// The read path is pure-ish; rowsToPriceHistory() is a pure transform (tested).

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  ALL_TICKERS,
  fetchPriceHistory,
  type PriceHistory,
  type OHLCV,
  type Ticker,
  type YahooRange,
} from "@/lib/fetchers/yahoo";

export interface PriceRow {
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  yahoo_symbol: string | null;
  currency: string | null;
}

/** Pure: group flat price rows into PriceHistory objects (sorted by date asc). */
export function rowsToPriceHistory(rows: PriceRow[]): Record<string, PriceHistory> {
  const byTicker = new Map<string, PriceRow[]>();
  for (const r of rows) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
    byTicker.get(r.ticker)!.push(r);
  }
  const out: Record<string, PriceHistory> = {};
  for (const [t, rs] of byTicker) {
    rs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const bars: OHLCV[] = rs.map((r) => ({
      date: r.date,
      timestamp: Math.floor(new Date(`${r.date}T00:00:00Z`).getTime() / 1000),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume ?? 0,
    }));
    out[t] = {
      ticker: t as Ticker,
      yahooSymbol: rs[0].yahoo_symbol ?? t,
      currency: rs[0].currency ?? "USD",
      bars,
    };
  }
  return out;
}

/** How many most-recent bars to read per ticker (>1y of trading days). */
const READ_BARS = 300;

/**
 * Read cached prices for the given tickers. Queries PER TICKER for the most
 * recent bars — a single `.in()` query hits Supabase's 1000-row cap and would
 * return the wrong (oldest) rows once the cache holds 12 months × 10 tickers.
 * Returns {} if Supabase is unconfigured.
 */
export async function readCachedPrices(
  tickers: readonly Ticker[] = ALL_TICKERS,
): Promise<Record<string, PriceHistory>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = getSupabase();

  const perTicker = await Promise.all(
    tickers.map(async (t) => {
      const { data, error } = await supabase
        .from("price_history")
        .select("ticker, date, open, high, low, close, volume, yahoo_symbol, currency")
        .eq("ticker", t)
        .order("date", { ascending: false })
        .limit(READ_BARS);
      if (error) {
        console.warn(`[price-cache] read failed for ${t}:`, error.message);
        return [] as PriceRow[];
      }
      return (data ?? []) as PriceRow[];
    }),
  );

  // rowsToPriceHistory re-sorts each ticker's bars ascending.
  return rowsToPriceHistory(perTicker.flat());
}

/**
 * Fetch from Yahoo (tolerant) and upsert into the cache. Use range "1y" for the
 * initial fill and a shorter range (e.g. "1mo") for routine top-ups.
 */
export async function refreshPriceCache(
  range: YahooRange = "1y",
): Promise<{ written: number; failed: string[] }> {
  if (!isSupabaseConfigured()) return { written: 0, failed: ["supabase not configured"] };

  const results = await Promise.allSettled(
    ALL_TICKERS.map((t) => fetchPriceHistory(t, { range, interval: "1d" })),
  );

  const rows: PriceRow[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const h = r.value;
      for (const b of h.bars) {
        rows.push({
          ticker: h.ticker,
          date: b.date,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
          yahoo_symbol: h.yahooSymbol,
          currency: h.currency,
        });
      }
    } else {
      failed.push(ALL_TICKERS[i]);
    }
  });

  const supabase = getSupabase();
  let written = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase
      .from("price_history")
      .upsert(batch, { onConflict: "ticker,date" });
    if (error) {
      failed.push(`upsert: ${error.message}`);
      break;
    }
    written += batch.length;
  }
  return { written, failed };
}
