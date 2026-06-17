"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreValue } from "@/components/score-value";
import { ConfidenceBar } from "@/components/confidence-bar";
import { SignalBreakdown } from "@/components/signal-breakdown";
import { styleForScore } from "@/lib/ui/labels";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { cn } from "@/lib/utils";
import type { CommodityScore, NewsResponse, NewsItem } from "@/types/api";

function timeAgo(unixSeconds: number): string {
  const mins = Math.max(0, Math.round((Date.now() / 1000 - unixSeconds) / 60));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Per-commodity plain-English reasons + confidence (the explainability panel). */
export function Explainability({
  commodities,
  news,
}: {
  commodities: CommodityScore[];
  news: NewsResponse | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Why these scores?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {commodities.map((c) => (
          <CommodityExplain
            key={c.ticker}
            commodity={c}
            headlines={news?.grouped?.[c.ticker] ?? []}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function CommodityExplain({
  commodity: c,
  headlines,
}: {
  commodity: CommodityScore;
  headlines: NewsItem[];
}) {
  const [open, setOpen] = useState(false);
  const style = styleForScore(c.score);

  return (
    <div className={cn("rounded-lg border p-3", style.border, style.bg)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-semibold">{c.ticker}</span>
          <span className="text-xs text-muted-foreground">{COMMODITY_META[c.ticker]?.name}</span>
          <Badge variant="outline" className={cn(style.text, style.border)}>
            {style.emoji} {c.label}
          </Badge>
        </div>
        <ScoreValue score={c.score} confidence={c.confidence} size="sm" showArrow={false} />
      </div>

      <ul className="mt-2 space-y-1">
        {c.reasons.map((r, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="text-foreground/40">•</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>

      {headlines.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <span className={cn("transition-transform", open && "rotate-90")}>›</span>
            📰 {open ? "Hide" : "Show"} {headlines.length} underlying{" "}
            {headlines.length === 1 ? "headline" : "headlines"}
          </button>

          {open && (
            <ul className="mt-1.5 space-y-1.5 border-l border-border/60 pl-3">
              {headlines.map((n) => (
                <li key={n.id} className="text-sm leading-snug">
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/90 hover:underline"
                  >
                    {n.headline}
                  </a>
                  <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
                    {n.source} · {timeAgo(n.datetime)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfidenceBar confidence={c.confidence} fill={style.fill} className="mt-3" />

      <div className="mt-3">
        <SignalBreakdown signals={c.signals} />
      </div>
    </div>
  );
}
