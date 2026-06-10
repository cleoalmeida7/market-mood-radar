import { NextResponse } from "next/server";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { COMMODITY_TICKERS } from "@/lib/fetchers/yahoo";

// GET /api/alerts — list saved threshold alerts.
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ alerts: [], warning: "Supabase not configured" });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ alerts: data ?? [] });
}

// POST /api/alerts — save a threshold alert { ticker, threshold, email, direction }.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ticker, threshold, email, direction } = (body ?? {}) as {
    ticker?: string;
    threshold?: number;
    email?: string;
    direction?: string;
  };

  const upper = ticker?.toUpperCase();
  const errors: string[] = [];
  if (!upper || !(COMMODITY_TICKERS as readonly string[]).includes(upper)) {
    errors.push(`ticker must be one of ${COMMODITY_TICKERS.join(", ")}`);
  }
  if (typeof threshold !== "number" || Number.isNaN(threshold) || threshold < -100 || threshold > 100) {
    errors.push("threshold must be a number between -100 and 100");
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errors.push("email must be a valid address");
  }
  if (direction !== "above" && direction !== "below") {
    errors.push('direction must be "above" or "below"');
  }
  if (errors.length) {
    return NextResponse.json({ error: "Invalid payload", details: errors }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("alerts")
    .insert({ ticker: upper, threshold, email, direction })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ alert: data }, { status: 201 });
}

// DELETE /api/alerts?id=<uuid> — remove a saved alert.
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id query param" }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const supabase = getSupabase();
  const { error } = await supabase.from("alerts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
