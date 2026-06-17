// Verify the Sentry integration end-to-end: build an event with the SAME pure
// builders the app uses, POST it to the ingest endpoint, and await the response
// (the app's captureError is fire-and-forget, so it can't surface this). A 200
// with an `id` confirms the DSN + envelope format are accepted by Sentry.
//
// Run: npm run test:sentry

import { parseDsn, buildEvent, buildEnvelope } from "../src/lib/observability.ts";

async function main() {
  const dsn = parseDsn(process.env.SENTRY_DSN);
  if (!dsn) {
    console.error("SENTRY_DSN missing or malformed — nothing to test. (no-op in the app)");
    process.exit(1);
  }
  console.log(`DSN OK → project ${dsn.projectId} @ ${new URL(dsn.endpoint).host}`);

  const eventId = (globalThis.crypto?.randomUUID?.() ?? "manualtestid000000000000000000").replace(/-/g, "");
  const now = Date.now();
  const event = buildEvent(
    new Error("Sentry integration test from marketresearch (safe to resolve)"),
    { route: "scripts/test-sentry", kind: "manual-verification" },
    {
      eventId,
      timestampSec: Math.floor(now / 1000),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    },
  );
  const body = buildEnvelope(event, new Date(now).toISOString());

  const res = await fetch(`${dsn.endpoint}?sentry_key=${dsn.publicKey}&sentry_version=7`, {
    method: "POST",
    headers: { "Content-Type": "application/x-sentry-envelope" },
    body,
  });
  const text = await res.text();
  console.log(`\nIngest response: HTTP ${res.status}`);
  console.log(`Body: ${text}`);
  if (res.ok) {
    console.log(`\n✅ Sentry accepted the event (id ${eventId}). Check your Sentry Issues feed.`);
  } else {
    console.error("\n❌ Sentry rejected the event — check the DSN and the response above.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nERROR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
