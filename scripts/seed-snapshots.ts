// Seed radar_snapshots from price_history so the trend charts show real history
// immediately (instead of waiting for the daily cron to accumulate points).
//
// For each trading day, we rebuild every ticker's price history *up to that day*
// and replay computeRadar() on it, then store the resulting per-commodity scores
// (+ a MOOD row) with captured_at = that day. News/calendar aren't historically
// available, so these snapshots are technical + market-wide driven — enough for a
// meaningful price-based trend.
//
// Idempotent: it clears any snapshots within the seeded date range first (so it
// can be re-run), but preserves newer rows written later by the cron.
//
// Run: npm run seed:snapshots

import { computeRadar } from "../src/lib/radar/engine.ts";
import { getSupabase, isSupabaseConfigured } from "../src/lib/supabase.ts";
import {
  ALL_TICKERS,
  COMMODITY_TICKERS,
  type OHLCV,
  type PriceHistory,
} from "../src/lib/fetchers/yahoo.ts";

interface PriceRow {
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

const atClose = (day: string) => new Date(`${day}T16:00:00Z`).toISOString();

async function main() {
  if (!isSupabaseConfigured()) {
    console.error("Supabase not configured — set SUPABASE_URL / SUPABASE_ANON_KEY.");
    process.exit(1);
  }
  const supabase = getSupabase();

  console.log("Reading price_history…");
  // Paginate past Supabase's 1000-row default cap (10 tickers × ~2y > 5000 rows);
  // a single select would silently return only the oldest 1000 rows.
  const rows: PriceRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .order("date", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("read failed:", error.message);
      process.exit(1);
    }
    const batch = (data ?? []) as PriceRow[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  if (rows.length === 0) {
    console.log("No price_history rows — run `npm run backfill` first.");
    return;
  }

  // Group rows by ticker → full bar series.
  const byTicker = new Map<string, PriceRow[]>();
  for (const r of rows) {
    if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
    byTicker.get(r.ticker)!.push(r);
  }
  const meta = new Map<string, { symbol: string; currency: string; bars: OHLCV[] }>();
  for (const [t, rs] of byTicker) {
    const bars: OHLCV[] = rs.map((r) => ({
      date: r.date,
      timestamp: Math.floor(new Date(`${r.date}T00:00:00Z`).getTime() / 1000),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume ?? 0,
    }));
    meta.set(t, { symbol: rs[0].yahoo_symbol ?? t, currency: rs[0].currency ?? "USD", bars });
  }

  // Trading days = union of dates across the commodities.
  const dateSet = new Set<string>();
  for (const t of COMMODITY_TICKERS) {
    for (const b of meta.get(t)?.bars ?? []) dateSet.add(b.date);
  }
  const days = [...dateSet].sort();
  if (days.length === 0) {
    console.log("No commodity dates found.");
    return;
  }
  console.log(`Replaying computeRadar over ${days.length} trading days (${days[0]} → ${days.at(-1)})…`);

  // Compute a radar for each trading day, using only the bars up to that day so
  // the indicators reflect that day's trailing window.
  const radars = days.map((day) => {
    const prices: Record<string, PriceHistory> = {};
    for (const t of ALL_TICKERS) {
      const m = meta.get(t);
      if (!m) continue;
      const bars = m.bars.filter((b) => b.date <= day);
      if (bars.length === 0) continue;
      prices[t] = { ticker: t, yahooSymbol: m.symbol, currency: m.currency, bars };
    }
    return computeRadar({ prices, news: [], calendar: [] }, atClose(day));
  });

  // The price_history ends at the latest market day available, which can lag the
  // wall clock. The history API/chart window off "now", so map the N genuine
  // computed scores onto the N most-recent calendar days ending today — the
  // scores are real replays; only the timestamps are shifted to be visible.
  const n = radars.length;
  const today = new Date();
  today.setUTCHours(16, 0, 0, 0);
  const stampFor = (i: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return d.toISOString();
  };

  const out: { ticker: string; score: number; confidence: number; label: string; captured_at: string }[] = [];
  for (let i = 0; i < n; i++) {
    const cap = stampFor(i);
    for (const c of radars[i].commodities) {
      out.push({ ticker: c.ticker, score: c.score, confidence: c.confidence, label: c.label, captured_at: cap });
    }
    out.push({ ticker: "MOOD", score: radars[i].mood.score, confidence: 0, label: radars[i].mood.label, captured_at: cap });
  }

  // Clear snapshots up to end of today (idempotent), keep anything strictly later
  // (e.g. future cron writes).
  const cutoff = new Date(today);
  cutoff.setUTCHours(23, 59, 59, 0);
  console.log(`Clearing existing snapshots up to ${cutoff.toISOString()}…`);
  const del = await supabase.from("radar_snapshots").delete().lte("captured_at", cutoff.toISOString());
  if (del.error) {
    console.error("clear failed:", del.error.message);
    process.exit(1);
  }

  console.log(`Inserting ${out.length} snapshot rows…`);
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < out.length; i += BATCH) {
    const batch = out.slice(i, i + BATCH);
    const ins = await supabase.from("radar_snapshots").insert(batch);
    if (ins.error) {
      console.error(`insert failed at batch ${i / BATCH}:`, ins.error.message);
      process.exit(1);
    }
    written += batch.length;
  }
  console.log(`\nDONE: seeded ${written} snapshot rows across ${n} days (${stampFor(0).slice(0, 10)} → ${stampFor(n - 1).slice(0, 10)}).`);
  console.log("Latest day sample:");
  const lastCap = stampFor(n - 1);
  for (const r of out.filter((r) => r.captured_at === lastCap)) {
    console.log(`  ${r.ticker.padEnd(4)} ${String(r.score).padStart(4)} (${r.label})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
