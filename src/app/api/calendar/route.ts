import { NextResponse } from "next/server";
import { fetchEconomicCalendar } from "@/lib/fetchers/finnhub";
import { HttpError } from "@/api/http";
import { decideRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

// GET /api/calendar — upcoming economic events.
// The economic calendar is premium on Finnhub; on 403 (or missing key) we
// gracefully return an empty list with a warning rather than erroring.
export async function GET(req: Request) {
  const rl = decideRateLimit(req, "calendar");
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { ...rlHeaders, "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  try {
    const events = await fetchEconomicCalendar({ from, to });
    return NextResponse.json(
      { events },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
          ...rlHeaders,
        },
      },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : undefined;
    const warning =
      status === 403 || status === 401
        ? "Economic calendar is not available on this Finnhub plan"
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({ events: [], warning }, { headers: rlHeaders });
  }
}
