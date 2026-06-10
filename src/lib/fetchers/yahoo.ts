// Yahoo Finance fetcher — OHLCV price history.
// No API key required. Uses the public v8 chart endpoint.
// NOTE: Yahoo has unofficial rate limits — keep calls modest (see fetchAllPrices).

import { fetchJson, HttpError } from "@/api/http";

// ---- Ticker universe -------------------------------------------------------

/** The 6 commodities scored by the radar. */
export const COMMODITY_TICKERS = ["XAU", "XAG", "XPT", "CL", "NG", "HG"] as const;

/** Market-wide context tickers. */
export const MARKET_TICKERS = ["DXY", "VIX", "TNX", "SPX"] as const;

export const ALL_TICKERS = [...COMMODITY_TICKERS, ...MARKET_TICKERS] as const;

export type CommodityTicker = (typeof COMMODITY_TICKERS)[number];
export type MarketTicker = (typeof MARKET_TICKERS)[number];
export type Ticker = (typeof ALL_TICKERS)[number];

/** Map our internal tickers to Yahoo Finance symbols. */
export const YAHOO_SYMBOLS: Record<Ticker, string> = {
  // Commodity futures (front-month continuous)
  XAU: "GC=F", // Gold
  XAG: "SI=F", // Silver
  XPT: "PL=F", // Platinum
  CL: "CL=F", // WTI Crude
  NG: "NG=F", // Natural Gas
  HG: "HG=F", // Copper
  // Market-wide
  DXY: "DX-Y.NYB", // US Dollar Index
  VIX: "^VIX", // CBOE Volatility Index
  TNX: "^TNX", // 10-Year Treasury yield
  SPX: "^GSPC", // S&P 500
};

export const TICKER_LABELS: Record<Ticker, string> = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  CL: "WTI Crude",
  NG: "Natural Gas",
  HG: "Copper",
  DXY: "US Dollar Index",
  VIX: "VIX",
  TNX: "10Y Treasury",
  SPX: "S&P 500",
};

// ---- Types -----------------------------------------------------------------

export interface OHLCV {
  /** ISO date (YYYY-MM-DD) of the bar. */
  date: string;
  /** Unix timestamp (seconds). */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceHistory {
  ticker: Ticker;
  yahooSymbol: string;
  currency: string;
  bars: OHLCV[];
}

export type YahooRange =
  | "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max";
export type YahooInterval = "1m" | "5m" | "15m" | "1h" | "1d" | "1wk" | "1mo";

// ---- Raw Yahoo response shape ---------------------------------------------

interface YahooChartResponse {
  chart: {
    result:
      | {
          meta: { currency?: string; symbol: string };
          timestamp?: number[];
          indicators: {
            quote: {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }[]
      | null;
    error: { code: string; description: string } | null;
  };
}

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// A browser-like UA reduces the chance of being blocked by Yahoo.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function toISODate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

// ---- Core fetch ------------------------------------------------------------

/** Fetch OHLCV history for a single internal ticker. */
export async function fetchPriceHistory(
  ticker: Ticker,
  opts: { range?: YahooRange; interval?: YahooInterval } = {},
): Promise<PriceHistory> {
  const { range = "1mo", interval = "1d" } = opts;
  const symbol = YAHOO_SYMBOLS[ticker];
  if (!symbol) throw new Error(`Unknown ticker: ${ticker}`);

  const url =
    `${CHART_BASE}/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;

  const json = await fetchJson<YahooChartResponse>(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });

  if (json.chart.error) {
    throw new Error(
      `Yahoo error for ${symbol}: ${json.chart.error.code} — ${json.chart.error.description}`,
    );
  }
  const result = json.chart.result?.[0];
  if (!result) throw new Error(`Yahoo returned no result for ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const q = result.indicators.quote[0] ?? {};

  const bars: OHLCV[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const open = q.open?.[i];
    const high = q.high?.[i];
    const low = q.low?.[i];
    const close = q.close?.[i];
    // Skip incomplete bars (Yahoo pads nulls on holidays / current session).
    if (open == null || high == null || low == null || close == null) continue;
    bars.push({
      date: toISODate(timestamps[i]),
      timestamp: timestamps[i],
      open,
      high,
      low,
      close,
      volume: q.volume?.[i] ?? 0,
    });
  }

  return {
    ticker,
    yahooSymbol: symbol,
    currency: result.meta.currency ?? "USD",
    bars,
  };
}

/**
 * Fetch price history for many tickers with limited concurrency to be polite
 * to Yahoo's unofficial rate limits. Returns a map keyed by internal ticker.
 * Individual failures are captured and rethrown as an aggregate at the end.
 */
export async function fetchManyPrices(
  tickers: readonly Ticker[],
  opts: { range?: YahooRange; interval?: YahooInterval; concurrency?: number } = {},
): Promise<Record<string, PriceHistory>> {
  const { concurrency = 3, ...fetchOpts } = opts;
  const out: Record<string, PriceHistory> = {};
  const errors: string[] = [];

  const queue = [...tickers];
  async function worker() {
    while (queue.length) {
      const ticker = queue.shift()!;
      try {
        out[ticker] = await fetchPriceHistory(ticker, fetchOpts);
      } catch (err) {
        const msg = err instanceof HttpError ? err.message : String(err);
        errors.push(`${ticker}: ${msg}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tickers.length) }, worker),
  );

  if (errors.length) {
    throw new AggregateError(
      errors.map((e) => new Error(e)),
      `fetchManyPrices: ${errors.length}/${tickers.length} failed`,
    );
  }
  return out;
}

/** Convenience: fetch all commodity + market-wide tickers. */
export function fetchAllPrices(
  opts: { range?: YahooRange; interval?: YahooInterval } = {},
): Promise<Record<string, PriceHistory>> {
  return fetchManyPrices(ALL_TICKERS, opts);
}
