"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Timestamp (ms) of the last successful load. */
  updatedAt: number | null;
  refresh: () => void;
}

/**
 * Fetch `url` on mount and every `intervalMs`. Keeps the last good data while
 * refetching, so the UI doesn't flash on each poll.
 */
export function usePolling<T>(url: string, intervalMs = 30_000): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const active = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      if (!active.current) return;
      setData(json);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (err) {
      if (!active.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (active.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    active.current = true;
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      active.current = false;
      clearInterval(id);
    };
  }, [load, intervalMs]);

  return { data, error, loading, updatedAt, refresh: load };
}
