import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { computeRadar } from "@/lib/radar/engine";
import { ACTIVE_WEIGHTS } from "@/lib/radar/weights";
import { COMMODITY_TICKERS } from "@/lib/fetchers/yahoo";
import { loadRadarInputs } from "@/lib/radar/load";
import { checkAndFireAlerts } from "@/lib/alerts";
import { decideRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";

// GET /api/radar — fused commodity scores + overall market mood.
// Cached for 30s (Finnhub free tier = 60 calls/min; Yahoo rate limits).
const getRadar = unstable_cache(
  async () => {
    const inputs = await loadRadarInputs();
    const radar = computeRadar(inputs, undefined, ACTIVE_WEIGHTS);
    // 7-day close sparklines, derived from prices already fetched (no extra calls).
    const spark = Object.fromEntries(
      COMMODITY_TICKERS.map((t) => [
        t,
        (inputs.prices[t]?.bars ?? []).slice(-7).map((b) => b.close),
      ]),
    );
    return { ...radar, spark };
  },
  ["radar-v2"],
  { revalidate: 30, tags: ["radar"] },
);

export async function GET(req: Request) {
  const rl = decideRateLimit(req, "radar");
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { ...rlHeaders, "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  try {
    const radar = await getRadar();
    // Fire any triggered threshold alerts (throttled + no-ops without creds).
    await checkAndFireAlerts(radar);
    return NextResponse.json(radar, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
        ...rlHeaders,
      },
    });
  } catch (err) {
    captureError(err, { route: "/api/radar" });
    return NextResponse.json(
      { error: "Failed to compute radar", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
