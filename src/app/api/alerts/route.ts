import { NextResponse } from "next/server";

// POST /api/alerts — save a score threshold + trigger notification (Resend / push).
// TODO(phase-4): persist threshold and dispatch notification.
export async function POST(_req: Request) {
  return NextResponse.json(
    { error: "Not implemented", route: "/api/alerts" },
    { status: 501 },
  );
}
