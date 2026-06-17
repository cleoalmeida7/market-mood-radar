// Grid-search the price-driven radar weights against ~2y of historical forward
// returns, validate the winner out-of-sample, and (only if it beats the current
// defaults on held-out recent data) write the optimised weights to
// src/lib/radar/optimized-weights.json — which the engine then uses live.
//
// Run: npm run optimize   (needs Supabase creds in .env.local for the 2y cache;
// falls back to a live Yahoo fetch if the cache is thin.)

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { COMMODITY_TICKERS } from "../src/lib/fetchers/yahoo.ts";
import { loadPrices } from "../src/lib/radar/load.ts";
import { precomputeDays, optimize } from "../src/lib/radar/weight-optimizer.ts";
import { DEFAULT_WEIGHTS } from "../src/lib/radar/weights.ts";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function main() {
  console.log("=== Weight optimisation (price-driven signals) ===\n");
  console.log("  Loading ~2y of price history...");
  const prices = await loadPrices("2y");

  const perCommodity = COMMODITY_TICKERS.map((t) => precomputeDays(t, prices[t], prices));
  perCommodity.forEach((days, i) =>
    console.log(`    ${COMMODITY_TICKERS[i]}: ${days.length} scored days`),
  );

  const totalDays = perCommodity.reduce((a, d) => a + d.length, 0);
  if (totalDays < 600) {
    console.warn(
      `\n  WARN: only ${totalDays} total scored days — results may be thin. ` +
        `Run \`npm run backfill\` to seed the 2y cache first.`,
    );
  }

  console.log("\n  Grid-searching (train 70% → validate on held-out 30%)...");
  const res = optimize(perCommodity);

  console.log(`\n  Combos tried:        ${res.combosTried}`);
  console.log(`  Train hit (default): ${pct(res.trainHitDefault)}`);
  console.log(`  Train hit (best):    ${pct(res.trainHitBest)}  (n=${res.nTrain})`);
  console.log(`  TEST  hit (default): ${pct(res.testHitDefault)}`);
  console.log(`  TEST  hit (best):    ${pct(res.testHitBest)}  (n=${res.nTest})`);
  console.log(`  Out-of-sample gain:  ${(res.improvement * 100).toFixed(2)}pp`);
  console.log(`\n  → ${res.reason}`);

  const weights = res.validated ? res.best : null;
  if (weights) {
    console.log("\n  Optimised weights:");
    console.log(`    technical source:  ${weights.technical}`);
    console.log(`    market-wide source:${weights.marketwide}`);
    console.log(
      `    indicators: RSI ${weights.technicalIndicators.rsi} · MACD ${weights.technicalIndicators.macd} · ` +
        `MA ${weights.technicalIndicators.ma} · Bollinger ${weights.technicalIndicators.bollinger}`,
    );
  } else {
    console.log(`\n  Keeping DEFAULT weights: ${JSON.stringify(DEFAULT_WEIGHTS)}`);
  }

  const payload = {
    version: 1,
    validated: res.validated,
    generatedAt: new Date().toISOString(),
    note: res.validated
      ? "Optimised weights validated out-of-sample and in use by the engine. Re-run `npm run optimize` to refresh."
      : "Defaults in use (optimiser found no out-of-sample improvement). Re-run `npm run optimize` after more data accrues.",
    weights,
    report: {
      combosTried: res.combosTried,
      trainHitDefault: res.trainHitDefault,
      trainHitBest: res.trainHitBest,
      testHitDefault: res.testHitDefault,
      testHitBest: res.testHitBest,
      improvement: res.improvement,
      nTrain: res.nTrain,
      nTest: res.nTest,
      horizonsDays: [1, 3, 7],
    },
  };

  const outPath = fileURLToPath(
    new URL("../src/lib/radar/optimized-weights.json", import.meta.url),
  );
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`\n  Wrote ${outPath}`);
  console.log("  (Rebuild / redeploy to apply.)\n");
}

main().catch((err) => {
  console.error("\n  ERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
