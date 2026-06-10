"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { usePolling } from "@/hooks/usePolling";
import type {
  CommodityDetailResponse,
  RadarResponse,
  HistoryResponse,
  CommodityScore,
} from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreValue } from "@/components/score-value";
import { ConfidenceBar } from "@/components/confidence-bar";
import { IndicatorList } from "@/components/indicator-list";
import { PriceChart, RsiChart, MacdChart } from "@/components/indicator-charts";
import { ScoreHistoryChart } from "@/components/score-history-chart";
import { styleForScore, arrowForScore } from "@/lib/ui/labels";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { cn } from "@/lib/utils";

export default function CommodityPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = (params.ticker ?? "").toUpperCase();

  const detail = usePolling<CommodityDetailResponse>(`/api/commodity/${ticker}`, 60_000);
  const radar = usePolling<RadarResponse>("/api/radar", 30_000);
  const history = usePolling<HistoryResponse>(`/api/history/${ticker}`, 60_000);

  const meta = COMMODITY_META[ticker as keyof typeof COMMODITY_META];
  const score: CommodityScore | undefined = radar.data?.commodities.find(
    (c) => c.ticker === ticker,
  );

  if (!meta) {
    return (
      <div className="space-y-3">
        <p className="text-lg">Unknown commodity: <span className="font-mono">{ticker}</span></p>
        <Link href="/" className="text-sm text-primary hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  const style = styleForScore(score?.score ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Dashboard
        </Link>
      </div>

      {/* Header: current score + reasons + delta */}
      <Card className={cn("border", style.border, style.bg)}>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">
              <span className="font-mono">{ticker}</span>{" "}
              <span className="text-base font-normal text-muted-foreground">{meta.name}</span>
            </CardTitle>
            {detail.data && (
              <p className="mt-1 text-xs text-muted-foreground">
                {detail.data.symbol} · {detail.data.currency}
              </p>
            )}
          </div>
          {score ? (
            <div className="flex flex-col items-end gap-1">
              <ScoreValue score={score.score} confidence={score.confidence} />
              <Badge variant="outline" className={cn(style.text, style.border)}>
                {style.emoji} {score.label}
              </Badge>
            </div>
          ) : (
            <Skeleton className="h-12 w-28" />
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {score && <ConfidenceBar confidence={score.confidence} fill={style.fill} />}
          {score && (
            <ul className="space-y-1">
              {score.reasons.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-foreground/40">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {history.data?.delta && <DeltaCallout delta={history.data.delta} />}
        </CardContent>
      </Card>

      {/* Price + Bollinger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price &amp; Bollinger Bands (90d)</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.data ? (
            <PriceChart series={detail.data.series} color={style.hex} />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">RSI (14)</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.data ? <RsiChart series={detail.data.series} /> : <Skeleton className="h-32 w-full" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MACD (12/26/9)</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.data ? <MacdChart series={detail.data.series} /> : <Skeleton className="h-36 w-full" />}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Indicator readings</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.data ? (
              <IndicatorList indicators={detail.data.indicators} />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score history</CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreHistoryChart
              snapshots={history.data?.snapshots ?? []}
              warning={history.data?.warning}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeltaCallout({
  delta,
}: {
  delta: NonNullable<HistoryResponse["delta"]>;
}) {
  const diff = delta.to - delta.from;
  const cls = diff > 0 ? "text-emerald-400" : diff < 0 ? "text-red-400" : "text-muted-foreground";
  return (
    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
      Was <span className="font-mono font-semibold">{delta.from}</span> yesterday, now{" "}
      <span className="font-mono font-semibold">{delta.to}</span>{" "}
      <span className={cn("font-medium", cls)}>
        ({diff > 0 ? "+" : ""}
        {diff} {arrowForScore(diff)})
      </span>
    </p>
  );
}
