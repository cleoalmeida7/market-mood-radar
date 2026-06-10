import { NextResponse } from "next/server";
import { fetchEconomicCalendar } from "@/lib/fetchers/finnhub";
import { HttpError } from "@/api/http";

// GET /api/calendar — upcoming economic events.
// The economic calendar is premium on Finnhub; on 403 (or missing key) we
// gracefully return an empty list with a warning rather than erroring.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  try {
    const events = await fetchEconomicCalendar({ from, to });
    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } },
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : undefined;
    const warning =
      status === 403 || status === 401
        ? "Economic calendar is not available on this Finnhub plan"
        : err instanceof Error
          ? err.message
          : String(err);
    return NextResponse.json({ events: [], warning });
  }
}
