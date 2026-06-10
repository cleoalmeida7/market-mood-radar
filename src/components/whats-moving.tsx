"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreValue } from "@/components/score-value";
import { styleForScore } from "@/lib/ui/labels";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { cn } from "@/lib/utils";
import type { CommodityScore } from "@/types/api";

/** Top 3 movers by absolute score, each with its leading reason. */
export function WhatsMoving({ commodities }: { commodities: CommodityScore[] }) {
  const movers = [...commodities]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What&apos;s Moving</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {movers.map((c) => {
          const style = styleForScore(c.score);
          return (
            <Link
              key={c.ticker}
              href={`/commodity/${c.ticker}`}
              className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
            >
              <div className="w-20 shrink-0">
                <div className="font-mono font-semibold">{c.ticker}</div>
                <div className="text-xs text-muted-foreground">
                  {COMMODITY_META[c.ticker]?.name}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ScoreValue score={c.score} confidence={c.confidence} size="sm" />
                  <Badge variant="outline" className={cn(style.text, style.border)}>
                    {style.emoji} {c.label}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {c.reasons[0] ?? "No active signals"}
                </p>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
