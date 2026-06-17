import { NextResponse } from "next/server";
import { computeRadar } from "@/lib/radar/engine";
import { loadRadarInputs } from "@/lib/radar/load";
import { refreshPriceCache } from "@/lib/radar/price-cache";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// POST/GET /api/cron/snapshot — compute the radar and write score snapshots to
// radar_snapshots (powers the trend charts). Run hourly (e.g. Vercel Cron).
// Secured by CRON_SECRET: send `Authorization: Bearer <CRON_SECRET>` or ?secret=.

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "your_cron_secret") return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const qs = new URL(req.url).searchParams.get("secret");
  return qs === secret;
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET === "your_cron_secret") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Top up the price cache from Yahoo (recent bars) before computing, so the
  // cached history stays current for the radar reads between cron runs.
  const cache = await refreshPriceCache("3mo");

  const radar = computeRadar(await loadRadarInputs());
  const capturedAt = new Date().toISOString();

  const rows = [
    ...radar.commodities.map((c) => ({
      ticker: c.ticker,
      score: c.score,
      confidence: c.confidence,
      label: c.label,
      captured_at: capturedAt,
    })),
    {
      ticker: "MOOD",
      score: radar.mood.score,
      confidence: 0,
      label: radar.mood.label,
      captured_at: capturedAt,
    },
  ];

  const supabase = getSupabase();
  const { error } = await supabase.from("radar_snapshots").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    written: rows.length,
    capturedAt,
    priceCache: { upserted: cache.written, failed: cache.failed },
  });
}

export const GET = handle;
export const POST = handle;
