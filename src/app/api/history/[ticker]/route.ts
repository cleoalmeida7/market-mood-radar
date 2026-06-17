import { NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { COMMODITY_TICKERS } from "@/lib/fetchers/yahoo";

// GET /api/history/[ticker] — score-snapshot history (24h + 7d) for trend charts.
// Accepts the 6 commodities plus "MOOD" (the overall market-mood series). Reads
// radar_snapshots (written by the cron route). Degrades to empty when Supabase
// isn't configured or no snapshots exist yet.
const VALID_SERIES: readonly string[] = [...COMMODITY_TICKERS, "MOOD"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  if (!VALID_SERIES.includes(upper)) {
    return NextResponse.json({ error: `Unknown ticker: ${ticker}` }, { status: 400 });
  }
  const t = upper;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ticker: t,
      snapshots: [],
      delta: null,
      warning: "Supabase not configured — score history appears once snapshots are written",
    });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("radar_snapshots")
    .select("score, confidence, label, captured_at")
    .eq("ticker", t)
    .gte("captured_at", sevenDaysAgo)
    .order("captured_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const snapshots = data ?? [];

  // Delta vs ~24h ago: closest snapshot to (now - 24h) compared with the latest.
  let delta: { from: number; to: number; capturedFrom: string; capturedTo: string } | null = null;
  if (snapshots.length >= 2) {
    const targetMs = Date.now() - 24 * 60 * 60 * 1000;
    let yesterday = snapshots[0];
    let best = Infinity;
    for (const s of snapshots) {
      const d = Math.abs(new Date(s.captured_at).getTime() - targetMs);
      if (d < best) {
        best = d;
        yesterday = s;
      }
    }
    const latest = snapshots[snapshots.length - 1];
    delta = {
      from: yesterday.score,
      to: latest.score,
      capturedFrom: yesterday.captured_at,
      capturedTo: latest.captured_at,
    };
  }

  return NextResponse.json({ ticker: t, snapshots, delta });
}
