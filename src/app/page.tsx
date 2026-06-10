"use client";

import { usePolling } from "@/hooks/usePolling";
import type { RadarResponse } from "@/types/api";
import { CommodityCard } from "@/components/commodity-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard, UpdatedAgo } from "@/components/states";
import { styleForScore } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { data, error, loading, updatedAt, refresh } = usePolling<RadarResponse>(
    "/api/radar",
    30_000,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commodity Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Directional mood for 6 commodities · auto-refreshes every 30s
          </p>
          <UpdatedAgo updatedAt={updatedAt} stale={Boolean(error && data)} className="mt-1" />
        </div>
        {data && <MoodPill score={data.mood.score} label={data.mood.label} />}
      </header>

      {error && !data ? (
        <ErrorCard message={error} onRetry={refresh} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))
            : data?.commodities.map((c) => (
                <CommodityCard key={c.ticker} commodity={c} spark={data.spark[c.ticker] ?? []} />
              ))}
        </div>
      )}
    </div>
  );
}

function MoodPill({ score, label }: { score: number; label: string }) {
  const style = styleForScore(score);
  const sign = score > 0 ? "+" : "";
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm",
        style.border,
        style.bg,
      )}
    >
      <span className="text-muted-foreground">Market mood</span>
      <span className={cn("font-mono font-semibold", style.text)}>
        {sign}
        {score}
      </span>
      <span className={style.text}>
        {style.emoji} {label}
      </span>
    </div>
  );
}
