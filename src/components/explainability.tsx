"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreValue } from "@/components/score-value";
import { ConfidenceBar } from "@/components/confidence-bar";
import { SignalBreakdown } from "@/components/signal-breakdown";
import { styleForScore } from "@/lib/ui/labels";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { cn } from "@/lib/utils";
import type { CommodityScore } from "@/types/api";

/** Per-commodity plain-English reasons + confidence (the explainability panel). */
export function Explainability({ commodities }: { commodities: CommodityScore[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Why these scores?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {commodities.map((c) => {
          const style = styleForScore(c.score);
          return (
            <div key={c.ticker} className={cn("rounded-lg border p-3", style.border, style.bg)}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{c.ticker}</span>
                  <span className="text-xs text-muted-foreground">
                    {COMMODITY_META[c.ticker]?.name}
                  </span>
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

              <ConfidenceBar confidence={c.confidence} fill={style.fill} className="mt-3" />

              <div className="mt-3">
                <SignalBreakdown signals={c.signals} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
