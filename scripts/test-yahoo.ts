// Manual smoke test for the Yahoo fetcher.
// Run: npm run test:yahoo
import {
  fetchPriceHistory,
  fetchAllPrices,
  ALL_TICKERS,
  YAHOO_SYMBOLS,
  TICKER_LABELS,
} from "../src/lib/fetchers/yahoo.ts";

async function main() {
  console.log("=== Yahoo fetcher smoke test ===\n");

  // 1. Single ticker, show a few bars.
  console.log("[1] Single ticker: XAU (Gold)");
  const gold = await fetchPriceHistory("XAU", { range: "1mo", interval: "1d" });
  console.log(
    `    symbol=${gold.yahooSymbol} currency=${gold.currency} bars=${gold.bars.length}`,
  );
  console.log("    last 3 bars:");
  for (const b of gold.bars.slice(-3)) {
    console.log(
      `      ${b.date}  O=${b.open.toFixed(2)} H=${b.high.toFixed(2)} ` +
        `L=${b.low.toFixed(2)} C=${b.close.toFixed(2)} V=${b.volume}`,
    );
  }

  // 2. All tickers — confirm each returns data.
  console.log("\n[2] All tickers (range=1mo):");
  const all = await fetchAllPrices({ range: "1mo", interval: "1d" });
  for (const t of ALL_TICKERS) {
    const h = all[t];
    const last = h?.bars.at(-1);
    console.log(
      `    ${t.padEnd(4)} (${YAHOO_SYMBOLS[t].padEnd(8)} ${TICKER_LABELS[t].padEnd(16)}) ` +
        `bars=${String(h?.bars.length ?? 0).padStart(3)} ` +
        `last close=${last ? last.close.toFixed(2) : "n/a"} @ ${last?.date ?? "n/a"}`,
    );
  }

  const missing = ALL_TICKERS.filter((t) => !all[t]?.bars.length);
  if (missing.length) {
    console.error(`\n  FAIL: no data for ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log("\n  PASS: all tickers returned price bars.");
}

main().catch((err) => {
  console.error("\n  ERROR:", err);
  process.exit(1);
});
