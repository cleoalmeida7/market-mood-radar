import { NextResponse } from "next/server";

// GET /api/calendar — upcoming economic events (Finnhub economic calendar).
// TODO(phase-3): wire to src/lib/fetchers/finnhub.ts fetchEconomicCalendar().
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented", route: "/api/calendar" },
    { status: 501 },
  );
}
