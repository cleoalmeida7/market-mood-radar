import { NextResponse } from "next/server";

// GET /api/news — Finnhub headlines by commodity.
// TODO(phase-3): wire to src/lib/fetchers/finnhub.ts fetchNews().
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented", route: "/api/news" },
    { status: 501 },
  );
}
