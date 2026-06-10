import { NextResponse } from "next/server";

// GET /api/commodity/[ticker] — price history + technical indicators.
// TODO(phase-3): wire to the Yahoo fetcher + indicator calc.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  return NextResponse.json(
    { error: "Not implemented", route: `/api/commodity/${ticker}` },
    { status: 501 },
  );
}
