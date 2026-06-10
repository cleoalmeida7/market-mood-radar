// Shared HTTP utilities used by the data fetchers.
// Lives in src/api/ as a plain module folder (NOT a route handler).

export class HttpError extends Error {
  status: number;
  url: string;
  body: string;

  constructor(status: number, statusText: string, url: string, body: string) {
    super(`HTTP ${status} ${statusText} for ${url}${body ? ` — ${body.slice(0, 300)}` : ""}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export interface FetchJsonOptions extends RequestInit {
  /** Number of retry attempts on network error / 5xx. Default 2. */
  retries?: number;
  /** Base delay (ms) for exponential backoff. Default 400. */
  retryDelayMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch a URL and parse JSON, throwing HttpError on non-2xx responses.
 * Retries on network failures and 5xx with exponential backoff.
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { retries = 2, retryDelayMs = 400, ...init } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // Retry transient server errors; fail fast on 4xx (bad key, bad request).
        if (res.status >= 500 && attempt < retries) {
          await sleep(retryDelayMs * 2 ** attempt);
          continue;
        }
        throw new HttpError(res.status, res.statusText, url, body);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      // Don't retry deterministic HTTP errors (4xx) — only network/5xx.
      if (err instanceof HttpError) throw err;
      if (attempt < retries) {
        await sleep(retryDelayMs * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr;
}
