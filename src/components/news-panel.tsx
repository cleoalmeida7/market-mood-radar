"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COMMODITY_TICKERS } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";
import type { NewsResponse } from "@/types/api";

function timeAgo(unixSeconds: number): string {
  const mins = Math.max(0, Math.round((Date.now() / 1000 - unixSeconds) / 60));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function NewsPanel({ data }: { data: NewsResponse | null }) {
  const groups = COMMODITY_TICKERS.map((t) => ({
    ticker: t,
    name: COMMODITY_META[t].name,
    items: (data?.grouped?.[t] ?? []).slice(0, 4),
  })).filter((g) => g.items.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">News by commodity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.warning && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-400">
            {data.warning}
          </p>
        )}
        {groups.length === 0 && !data?.warning && (
          <p className="text-sm text-muted-foreground">No commodity headlines right now.</p>
        )}
        {groups.map((g) => (
          <div key={g.ticker}>
            <div className="mb-1 flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{g.ticker}</span>
              <Badge variant="secondary">{g.name}</Badge>
            </div>
            <ul className="space-y-1">
              {g.items.map((n) => (
                <li key={n.id} className="text-sm">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/90 hover:underline"
                  >
                    {n.headline}
                  </a>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {n.source} · {timeAgo(n.datetime)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
