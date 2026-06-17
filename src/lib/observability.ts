// Minimal error monitoring — sends events straight to Sentry's ingest API via
// the envelope protocol (the same transport the SDK uses under the hood), with
// NO @sentry/* dependency and NO build-time config. It is a complete no-op
// unless `SENTRY_DSN` is set, so it adds zero overhead/risk until you opt in.
//
// Scope (honest): this captures exceptions/messages only — no breadcrumbs,
// tracing, or session replay. Add @sentry/nextjs if you need those. The pure
// builders (parseDsn / buildEvent / buildEnvelope) are unit-tested; the actual
// network send is fire-and-forget and never throws.

export interface ParsedDsn {
  /** Envelope ingest endpoint. */
  endpoint: string;
  publicKey: string;
  projectId: string;
}

/** Parse a Sentry DSN (`https://KEY@host/PROJECT_ID`) → ingest endpoint. */
export function parseDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const publicKey = u.username;
    const projectId = u.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) return null;
    const endpoint = `${u.protocol}//${u.host}/api/${projectId}/envelope/`;
    return { endpoint, publicKey, projectId };
  } catch {
    return null;
  }
}

export interface SentryEvent {
  event_id: string;
  timestamp: number;
  platform: "node";
  level: "error" | "warning" | "info";
  logger: string;
  environment: string;
  release?: string;
  exception?: { values: { type: string; value: string }[] };
  message?: { formatted: string };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

function toStringMap(o: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!o) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return Object.keys(out).length ? out : undefined;
}

/** Build a Sentry event payload from an error or message (pure; ids injected). */
export function buildEvent(
  input: unknown,
  context: Record<string, unknown> | undefined,
  meta: { eventId: string; timestampSec: number; environment: string; release?: string },
): SentryEvent {
  const base: SentryEvent = {
    event_id: meta.eventId,
    timestamp: meta.timestampSec,
    platform: "node",
    level: "error",
    logger: "marketresearch",
    environment: meta.environment,
    release: meta.release,
    tags: toStringMap(context),
  };

  if (input instanceof Error) {
    base.exception = { values: [{ type: input.name || "Error", value: input.message || "" }] };
    base.extra = input.stack ? { stack: input.stack } : undefined;
  } else if (typeof input === "string") {
    base.message = { formatted: input };
  } else {
    base.message = { formatted: safeStringify(input) };
  }
  return base;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Build the newline-delimited Sentry envelope body for one event. */
export function buildEnvelope(event: SentryEvent, sentAtIso: string): string {
  const header = JSON.stringify({ event_id: event.event_id, sent_at: sentAtIso });
  const itemHeader = JSON.stringify({ type: "event" });
  const payload = JSON.stringify(event);
  return `${header}\n${itemHeader}\n${payload}\n`;
}

export function isMonitoringEnabled(): boolean {
  return parseDsn(process.env.SENTRY_DSN) != null;
}

function environment(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
}

/**
 * Capture an error or message. Fire-and-forget: returns immediately, never
 * throws, and is a no-op (console fallback) when SENTRY_DSN is unset.
 */
export function captureError(input: unknown, context?: Record<string, unknown>): void {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) {
    // Local/unconfigured: still surface it in logs.
    console.error("[capture]", input, context ?? "");
    return;
  }

  try {
    const eventId = randomEventId();
    const nowMs = Date.now();
    const event = buildEvent(input, context, {
      eventId,
      timestampSec: Math.floor(nowMs / 1000),
      environment: environment(),
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });
    const body = buildEnvelope(event, new Date(nowMs).toISOString());

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    void fetch(`${dsn.endpoint}?sentry_key=${dsn.publicKey}&sentry_version=7`, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
      signal: controller.signal,
      keepalive: true,
    })
      .catch(() => {
        /* swallow — monitoring must never affect the request */
      })
      .finally(() => clearTimeout(timer));
  } catch {
    /* never throw from the capture path */
  }
}

function randomEventId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    // Fallback if crypto.randomUUID is unavailable.
    let s = "";
    for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }
}
