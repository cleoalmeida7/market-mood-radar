// Lightweight in-memory fixed-window rate limiter for the public API routes.
//
// Scope/limitation (honest): this is PER-INSTANCE. On Vercel's serverless
// runtime each function instance keeps its own counter, so the effective global
// limit is (per-instance limit × live instances). That's fine here — the goal is
// to blunt accidental hammering / cheap abuse on a Hobby deployment without
// adding a Redis dependency. For a hard global cap, swap the store for Upstash.
//
// PURE of next/server so it stays unit-testable; routes build the 429 response.

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  /** Requests left in the current window (0 when over). */
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
  /** Seconds until reset (for Retry-After). */
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
/** Hard cap on tracked keys; prune expired entries before we grow past it. */
const MAX_KEYS = 10_000;

export const RATE_WINDOW_MS = 60_000;
export const DEFAULT_RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN) || 60;

/** Count one hit against `key`'s fixed window. `now` is injectable for tests. */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  const { limit, windowMs } = opts;

  if (store.size > MAX_KEYS) {
    for (const [k, b] of store) if (now >= b.resetAt) store.delete(k);
  }

  let bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }
  bucket.count++;

  return {
    ok: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Standard rate-limit headers for any response. */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.resetAt / 1000)),
  };
}

/**
 * Decide the limit for one request to a named route. Fails OPEN — any internal
 * error returns an allow so the limiter can never take a route down.
 */
export function decideRateLimit(
  req: Request,
  name: string,
  limit: number = DEFAULT_RATE_LIMIT,
  now: number = Date.now(),
): RateLimitResult {
  try {
    return rateLimit(`${name}:${clientIp(req)}`, { limit, windowMs: RATE_WINDOW_MS }, now);
  } catch {
    return { ok: true, limit, remaining: limit, resetAt: now + RATE_WINDOW_MS, retryAfterSec: 0 };
  }
}
