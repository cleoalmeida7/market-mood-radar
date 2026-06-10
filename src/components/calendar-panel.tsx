"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CalendarResponse } from "@/types/api";

function impactClass(impact: string): string {
  switch (impact.toLowerCase()) {
    case "high": return "text-red-400 border-red-500/30";
    case "medium": return "text-amber-400 border-amber-500/30";
    default: return "text-muted-foreground border-border";
  }
}

export function CalendarPanel({ data }: { data: CalendarResponse | null }) {
  const events = (data?.events ?? []).slice(0, 12);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming economic events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data?.warning && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-400">
            {data.warning}
          </p>
        )}
        {events.length === 0 && !data?.warning && (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        )}
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border/40 py-1.5 last:border-0">
            <div className="w-28 shrink-0 text-xs text-muted-foreground">{e.time}</div>
            <Badge variant="outline" className={cn("shrink-0", impactClass(e.impact))}>
              {e.country} · {e.impact}
            </Badge>
            <div className="min-w-0 flex-1 truncate text-sm">{e.event}</div>
            <div className="shrink-0 text-xs text-muted-foreground">
              {e.estimate != null && <span>est {e.estimate}</span>}
              {e.actual != null && <span className="ml-2 text-foreground">act {e.actual}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
