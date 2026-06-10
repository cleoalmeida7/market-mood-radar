import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { computeRadar } from "@/lib/radar/engine";
import { loadRadarInputs } from "@/lib/radar/load";

// GET /api/radar — fused commodity scores + overall market mood.
// Cached for 30s (Finnhub free tier = 60 calls/min; Yahoo rate limits).
const getRadar = unstable_cache(
  async () => {
    const inputs = await loadRadarInputs();
    return computeRadar(inputs);
  },
  ["radar-v1"],
  { revalidate: 30, tags: ["radar"] },
);

export async function GET() {
  try {
    const radar = await getRadar();
    return NextResponse.json(radar, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to compute radar", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
