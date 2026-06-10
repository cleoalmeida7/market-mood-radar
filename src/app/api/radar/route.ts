import { NextResponse } from "next/server";

// GET /api/radar — fused commodity scores + overall market mood (30s cache).
// TODO(phase-3): wire to the radar engine in src/lib/radar/engine.ts.
export async function GET() {
  return NextResponse.json(
    { error: "Not implemented", route: "/api/radar" },
    { status: 501 },
  );
}
