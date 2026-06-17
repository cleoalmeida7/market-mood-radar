import {
  parseDsn,
  buildEvent,
  buildEnvelope,
  type SentryEvent,
} from "@/lib/observability";

describe("parseDsn", () => {
  test("parses a standard DSN into the envelope endpoint", () => {
    const p = parseDsn("https://abc123@o9.ingest.sentry.io/456")!;
    expect(p).not.toBeNull();
    expect(p.publicKey).toBe("abc123");
    expect(p.projectId).toBe("456");
    expect(p.endpoint).toBe("https://o9.ingest.sentry.io/api/456/envelope/");
  });

  test("returns null for missing/malformed DSNs", () => {
    expect(parseDsn(undefined)).toBeNull();
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("https://o9.ingest.sentry.io/456")).toBeNull(); // no public key
    expect(parseDsn("https://key@o9.ingest.sentry.io/")).toBeNull(); // no project id
  });
});

const meta = { eventId: "deadbeef", timestampSec: 1_000, environment: "test", release: "abc" };

describe("buildEvent", () => {
  test("maps an Error to an exception with stack in extra", () => {
    const e = buildEvent(new TypeError("boom"), { route: "/api/x", n: 3 }, meta);
    expect(e.level).toBe("error");
    expect(e.event_id).toBe("deadbeef");
    expect(e.environment).toBe("test");
    expect(e.exception?.values[0]).toMatchObject({ type: "TypeError", value: "boom" });
    expect(typeof e.extra?.stack).toBe("string");
    // context becomes string tags
    expect(e.tags).toEqual({ route: "/api/x", n: "3" });
    expect(e.message).toBeUndefined();
  });

  test("maps a string to a message event", () => {
    const e = buildEvent("heads up", undefined, meta);
    expect(e.message?.formatted).toBe("heads up");
    expect(e.exception).toBeUndefined();
  });

  test("serialises non-Error, non-string input", () => {
    const e = buildEvent({ code: 42 }, undefined, meta);
    expect(e.message?.formatted).toBe('{"code":42}');
  });
});

describe("buildEnvelope", () => {
  test("produces 3 newline-delimited JSON lines: header, item header, payload", () => {
    const event = buildEvent(new Error("x"), undefined, meta);
    const body = buildEnvelope(event, "2026-06-17T00:00:00.000Z");
    const lines = body.split("\n");
    expect(lines).toHaveLength(4); // trailing newline → empty 4th element
    expect(lines[3]).toBe("");

    const header = JSON.parse(lines[0]);
    expect(header.event_id).toBe("deadbeef");
    expect(header.sent_at).toBe("2026-06-17T00:00:00.000Z");
    expect(JSON.parse(lines[1])).toEqual({ type: "event" });
    const payload = JSON.parse(lines[2]) as SentryEvent;
    expect(payload.event_id).toBe("deadbeef");
    expect(payload.exception?.values[0].value).toBe("x");
  });
});
