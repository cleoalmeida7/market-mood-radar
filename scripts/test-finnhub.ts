// Manual smoke test for the Finnhub fetcher.
// Run: npm run test:finnhub   (requires a real FINNHUB_API_KEY in .env.local)
import { fetchNews, fetchEconomicCalendar } from "../src/lib/fetchers/finnhub.ts";

async function main() {
  console.log("=== Finnhub fetcher smoke test ===\n");

  // 1. News
  console.log("[1] General market news:");
  const news = await fetchNews("general");
  console.log(`    received ${news.length} headlines`);
  for (const n of news.slice(0, 5)) {
    const when = new Date(n.datetime * 1000).toISOString().slice(0, 16).replace("T", " ");
    console.log(`      • [${when}] (${n.source}) ${n.headline}`);
  }
  if (!news.length) {
    console.error("    FAIL: no news returned.");
    process.exit(1);
  }

  // 2. Economic calendar (premium endpoint — may 403 on free tier).
  console.log("\n[2] Economic calendar (today → +7d):");
  try {
    const events = await fetchEconomicCalendar();
    console.log(`    received ${events.length} events`);
    for (const e of events.slice(0, 5)) {
      console.log(
        `      • ${e.time}  ${e.country.padEnd(3)} [${e.impact}] ${e.event}`,
      );
    }
  } catch (err) {
    console.warn(
      "    WARN: economic calendar failed (often premium-only on Finnhub free tier):",
      err instanceof Error ? err.message : err,
    );
  }

  console.log("\n  PASS: news fetch succeeded.");
}

main().catch((err) => {
  console.error("\n  ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
