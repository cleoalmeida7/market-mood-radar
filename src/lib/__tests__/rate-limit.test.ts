import {
  rateLimit,
  clientIp,
  rateLimitHeaders,
  decideRateLimit,
  RATE_WINDOW_MS,
} from "@/lib/rate-limit";

const req = (headers: Record<string, string> = {}) =>
  new Request("http://x.test/api", { headers });

describe("rateLimit — fixed window", () => {
  test("allows up to the limit, then blocks", () => {
    const opts = { limit: 3, windowMs: 1000 };
    const k = "t1";
    expect(rateLimit(k, opts, 0).ok).toBe(true); // 1
    expect(rateLimit(k, opts, 0).ok).toBe(true); // 2
    const third = rateLimit(k, opts, 0);
    expect(third.ok).toBe(true); // 3
    expect(third.remaining).toBe(0);
    const fourth = rateLimit(k, opts, 0);
    expect(fourth.ok).toBe(false); // 4 — over
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSec).toBe(1);
  });

  test("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: 1000 };
    const k = "t2";
    expect(rateLimit(k, opts, 0).ok).toBe(true);
    expect(rateLimit(k, opts, 500).ok).toBe(false); // same window
    expect(rateLimit(k, opts, 1000).ok).toBe(true); // window rolled over
  });

  test("keys are independent", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("a", opts, 0).ok).toBe(true);
    expect(rateLimit("b", opts, 0).ok).toBe(true);
    expect(rateLimit("a", opts, 0).ok).toBe(false);
  });
});

describe("clientIp", () => {
  test("prefers the first x-forwarded-for hop", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });
  test("falls back to x-real-ip then 'unknown'", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(req())).toBe("unknown");
  });
});

describe("rateLimitHeaders / decideRateLimit", () => {
  test("headers reflect the result", () => {
    const h = rateLimitHeaders({ ok: true, limit: 60, remaining: 59, resetAt: 60_000, retryAfterSec: 60 });
    expect(h["X-RateLimit-Limit"]).toBe("60");
    expect(h["X-RateLimit-Remaining"]).toBe("59");
    expect(h["X-RateLimit-Reset"]).toBe("60");
  });

  test("decideRateLimit namespaces by route and IP", () => {
    const r = req({ "x-forwarded-for": "10.0.0.1" });
    // Distinct routes don't share a window for the same IP.
    const a = decideRateLimit(r, "routeA", 1, 0);
    const b = decideRateLimit(r, "routeB", 1, 0);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    const a2 = decideRateLimit(r, "routeA", 1, 0);
    expect(a2.ok).toBe(false);
    expect(RATE_WINDOW_MS).toBe(60_000);
  });
});
