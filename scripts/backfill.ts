// Backfill 30 days of daily OHLCV into Supabase so trend charts have data
// from day one. Run: npm run backfill
//
// Prereqs:
//   1. Create the table — run scripts/schema.sql in the Supabase SQL editor.
//   2. Set SUPABASE_URL + SUPABASE_ANON_KEY in .env.local.
import { fetchAllPrices, ALL_TICKERS } from "../src/lib/fetchers/yahoo.ts";
import { getSupabase, isSupabaseConfigured } from "../src/lib/supabase.ts";

const DAYS = 30;
const BATCH = 500;

interface PriceRow {
  ticker: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  yahoo_symbol: string;
  currency: string;
}

async function main() {
  console.log(`=== Backfill: ${DAYS} days of daily prices → Supabase ===\n`);

  if (!isSupabaseConfigured()) {
    console.log(
      "  SKIPPED: Supabase is not configured.\n" +
        "  Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local, run scripts/schema.sql,\n" +
        "  then re-run `npm run backfill`.",
    );
    return;
  }

  // Fetch 3mo then trim to the last DAYS calendar days (covers weekends/holidays).
  console.log("  Fetching price history from Yahoo (range=3mo)...");
  const all = await fetchAllPrices({ range: "3mo", interval: "1d" });

  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const rows: PriceRow[] = [];
  for (const ticker of ALL_TICKERS) {
    const h = all[ticker];
    if (!h) continue;
    for (const b of h.bars) {
      if (b.date < cutoff) continue;
      rows.push({
        ticker,
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
  }
  console.log(`  Prepared ${rows.length} rows (cutoff ${cutoff}).`);

  const supabase = getSupabase();
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("price_history")
      .upsert(batch, { onConflict: "ticker,date" });
    if (error) {
      console.error(`  Upsert failed at batch ${i / BATCH}:`, error.message);
      process.exit(1);
    }
    written += batch.length;
    console.log(`  Upserted ${written}/${rows.length}...`);
  }

  console.log(`\n  DONE: backfilled ${written} price rows.`);
}

main().catch((err) => {
  console.error("\n  ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
