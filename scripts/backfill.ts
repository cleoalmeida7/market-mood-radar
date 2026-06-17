// Backfill the Supabase price cache with 12 months of daily OHLCV per ticker,
// so the radar reads from the DB (and the indicators have 50+ bars). Run once
// after setting up Supabase; the hourly cron tops it up thereafter.
//
// Prereqs:
//   1. Create the table — run scripts/schema.sql in the Supabase SQL editor.
//   2. Set SUPABASE_URL + SUPABASE_ANON_KEY in .env.local.
//
// Run: npm run backfill
import { refreshPriceCache } from "../src/lib/radar/price-cache.ts";
import { isSupabaseConfigured } from "../src/lib/supabase.ts";

async function main() {
  console.log("=== Backfill: 12 months of daily prices → Supabase cache ===\n");

  if (!isSupabaseConfigured()) {
    console.log(
      "  SKIPPED: Supabase is not configured.\n" +
        "  Add SUPABASE_URL and SUPABASE_ANON_KEY to .env.local, run scripts/schema.sql,\n" +
        "  then re-run `npm run backfill`.",
    );
    return;
  }

  console.log("  Fetching 1y of history from Yahoo and upserting...");
  const { written, failed } = await refreshPriceCache("1y");

  console.log(`\n  DONE: upserted ${written} price rows.`);
  if (failed.length) console.warn(`  WARN: ${failed.length} issue(s): ${failed.join(", ")}`);
}

main().catch((err) => {
  console.error("\n  ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
