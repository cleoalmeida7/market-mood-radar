// Threshold-alert evaluation + email delivery (Resend).
// Called from the /api/radar route after scores are computed. No-ops fast when
// Supabase or Resend aren't configured.

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RadarResult } from "@/lib/radar/engine";

const FROM = process.env.ALERTS_FROM_EMAIL || "Market Radar <onboarding@resend.dev>";
const REFRACTORY_MS = 6 * 60 * 60 * 1000; // don't re-fire the same alert within 6h
const CHECK_INTERVAL_MS = 30_000; // throttle DB checks to once per 30s per instance

let lastRun = 0;

function resendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key && key !== "your_resend_key");
}

interface AlertRow {
  id: string;
  ticker: string;
  threshold: number;
  direction: "above" | "below";
  email: string;
  last_triggered_at: string | null;
}

/**
 * Check saved alerts against the latest radar scores and email any that have
 * crossed their threshold (respecting a refractory period to avoid spam).
 */
export async function checkAndFireAlerts(radar: RadarResult): Promise<void> {
  if (!isSupabaseConfigured() || !resendConfigured()) return;

  const now = Date.now();
  if (now - lastRun < CHECK_INTERVAL_MS) return;
  lastRun = now;

  const supabase = getSupabase();
  const { data: alerts, error } = await supabase.from("alerts").select("*");
  if (error || !alerts || alerts.length === 0) return;

  const byTicker = new Map(radar.commodities.map((c) => [c.ticker, c]));
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  for (const a of alerts as AlertRow[]) {
    const c = byTicker.get(a.ticker as never);
    if (!c) continue;

    const triggered =
      a.direction === "above" ? c.score >= a.threshold : c.score <= a.threshold;
    if (!triggered) continue;

    if (a.last_triggered_at && now - new Date(a.last_triggered_at).getTime() < REFRACTORY_MS) {
      continue;
    }

    try {
      await resend.emails.send({
        from: FROM,
        to: a.email,
        subject: `${a.ticker} alert: ${c.score >= 0 ? "+" : ""}${c.score} (${c.label})`,
        text:
          `${a.ticker} score is now ${c.score} (${c.label}), ` +
          `${a.direction} your threshold of ${a.threshold}.\n\n` +
          `Why:\n- ${c.reasons.join("\n- ")}\n`,
      });
      await supabase
        .from("alerts")
        .update({ last_triggered_at: new Date(now).toISOString() })
        .eq("id", a.id);
    } catch (err) {
      console.warn(`[alerts] failed to send for ${a.id}:`, err);
    }
  }
}
