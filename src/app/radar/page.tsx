"use client";

import { usePolling } from "@/hooks/usePolling";
import type { RadarResponse, NewsResponse, CalendarResponse } from "@/types/api";
import { MoodGauge } from "@/components/mood-gauge";
import { WhatsMoving } from "@/components/whats-moving";
import { Explainability } from "@/components/explainability";
import { NewsPanel } from "@/components/news-panel";
import { CalendarPanel } from "@/components/calendar-panel";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RadarPage() {
  const radar = usePolling<RadarResponse>("/api/radar", 30_000);
  const news = usePolling<NewsResponse>("/api/news", 30_000);
  const calendar = usePolling<CalendarResponse>("/api/calendar", 60_000);

  const data = radar.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Market Radar</h1>
        <p className="text-sm text-muted-foreground">
          Overall mood, movers, and the reasoning behind every score · auto-refreshes every 30s
        </p>
      </header>

      {radar.error && !data && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          Failed to load radar: {radar.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            {data ? (
              <MoodGauge score={data.mood.score} label={data.mood.label} />
            ) : (
              <Skeleton className="mx-auto h-52 w-full max-w-sm" />
            )}
            {data && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Driven by {data.mood.dominantCommodity}: {data.mood.dominantReason}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {data ? (
            <WhatsMoving commodities={data.commodities} />
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data ? (
          <Explainability commodities={data.commodities} />
        ) : (
          <Skeleton className="h-96 w-full" />
        )}
        <div className="space-y-6">
          <NewsPanel data={news.data} />
          <CalendarPanel data={calendar.data} />
        </div>
      </div>
    </div>
  );
}
