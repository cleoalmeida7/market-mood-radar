// Client-facing types for the API responses. Type-only imports from server
// modules are safe (erased at build) and keep the UI in sync with the engine.

import type { RadarResult, CommodityScore } from "@/lib/radar/engine";
import type { OHLCV } from "@/lib/fetchers/yahoo";
import type { IndicatorSet, IndicatorSeriesPoint } from "@/lib/radar/indicators";
import type { NewsItem, EconomicEvent } from "@/lib/fetchers/finnhub";

export type { CommodityScore, OHLCV, NewsItem, EconomicEvent, IndicatorSeriesPoint };

/** GET /api/radar */
export type RadarResponse = RadarResult & {
  /** Last 7 daily closes per commodity, for mini sparklines. */
  spark: Record<string, number[]>;
};

/** GET /api/commodity/[ticker] */
export interface CommodityDetailResponse {
  ticker: string;
  label: string;
  symbol: string;
  currency: string;
  bars: OHLCV[];
  indicators: IndicatorSet;
  series: IndicatorSeriesPoint[];
}

/** GET /api/news */
export interface NewsResponse {
  grouped: Record<string, NewsItem[]>;
  count: number;
  warning?: string;
}

/** GET /api/calendar */
export interface CalendarResponse {
  events: EconomicEvent[];
  warning?: string;
}

export interface Alert {
  id: string;
  ticker: string;
  threshold: number;
  direction: "above" | "below";
  email: string;
  created_at: string;
  last_triggered_at: string | null;
}

/** GET /api/alerts */
export interface AlertsResponse {
  alerts: Alert[];
  warning?: string;
}

export interface ScoreSnapshot {
  score: number;
  confidence: number;
  label: string;
  captured_at: string;
}

/** GET /api/history/[ticker] */
export interface HistoryResponse {
  ticker: string;
  snapshots: ScoreSnapshot[];
  delta: {
    from: number;
    to: number;
    capturedFrom: string;
    capturedTo: string;
  } | null;
  warning?: string;
}
