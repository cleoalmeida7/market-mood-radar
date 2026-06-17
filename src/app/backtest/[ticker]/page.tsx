"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePolling } from "@/hooks/usePolling";
import type { BacktestResponse } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/states";
import { BacktestCharts, HorizonStatsTable } from "@/components/backtest-charts";
import { COMMODITY_META } from "@/lib/radar/commodities";

export default function BacktestPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params.ticker ?? "").toUpperCase();
  const meta = COMMODITY_META[ticker as keyof typeof COMMODITY_META];

  // Backtest inputs change at most once a day; poll lazily.
  const { data, error, refresh } = usePolling<BacktestResponse>(
    `/api/backtest/${ticker}`,
    5 * 60_000,
  );

  if (!meta) {
    return (
      <div className="space-y-3">
        <p className="text-lg">
          Unknown commodity: <span className="font-mono">{ticker}</span>
        </p>
        <Link href="/backtest" className="text-sm text-primary hover:underline">
          ← Back to backtests
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={`/commodity/${ticker}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {ticker} detail
        </Link>
        <Link href="/backtest" className="text-sm text-muted-foreground hover:underline">
          All backtests
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="font-mono">{ticker}</span>{" "}
          <span className="text-base font-normal text-muted-foreground">
            {meta.name} — backtest
          </span>
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Reconstructs the <strong>price-driven</strong> score (technical +
          market-wide signals) at each past day and checks it against the actual
          forward price move. News, calendar and geopolitical signals aren&rsquo;t
          stored historically, so this isolates the price model — live scores can
          differ.
        </p>
      </header>

      {error && !data && (
        <ErrorCard
          title={`Couldn’t load the ${ticker} backtest`}
          message={error}
          onRetry={refresh}
        />
      )}

      {data?.warning && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="py-4 text-sm text-muted-foreground">
            {data.warning}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Predictive accuracy by horizon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data ? (
            <>
              <HorizonStatsTable result={data} />
              <p className="text-xs text-muted-foreground">
                Hit rate = share of directional days where the score&rsquo;s
                sign matched the next move. Above 50% (green) suggests edge;
                correlation is score vs forward return. Numbers in parentheses
                are sample sizes.
              </p>
            </>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score history &amp; forward returns</CardTitle>
          {data?.window.from && data.window.to && (
            <p className="text-xs text-muted-foreground">
              {data.window.from} → {data.window.to} · {data.window.scoredDays} scored days
            </p>
          )}
        </CardHeader>
        <CardContent>
          {data ? (
            <BacktestCharts result={data} />
          ) : (
            <Skeleton className="h-[440px] w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
