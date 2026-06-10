"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/sparkline";
import { ConfidenceBar } from "@/components/confidence-bar";
import { ScoreValue } from "@/components/score-value";
import { styleForScore } from "@/lib/ui/labels";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { cn } from "@/lib/utils";
import type { CommodityScore } from "@/types/api";

interface CommodityCardProps {
  commodity: CommodityScore;
  spark: number[];
}

export function CommodityCard({ commodity, spark }: CommodityCardProps) {
  const style = styleForScore(commodity.score);
  const name = COMMODITY_META[commodity.ticker]?.name ?? "";
  const topReason = commodity.reasons[0] ?? "No active signals";

  return (
    <Link href={`/commodity/${commodity.ticker}`} className="group block">
      <Card
        className={cn(
          "h-full gap-3 border transition-colors hover:border-foreground/30",
          style.border,
          style.bg,
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
          <div>
            <div className="font-mono text-lg font-semibold">{commodity.ticker}</div>
            <div className="text-xs text-muted-foreground">{name}</div>
          </div>
          <Badge variant="outline" className={cn("shrink-0", style.text, style.border)}>
            {style.emoji} {commodity.label}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <ScoreValue score={commodity.score} confidence={commodity.confidence} />
            <div className="h-9 w-24">
              <Sparkline data={spark} color={style.hex} />
            </div>
          </div>

          <ConfidenceBar confidence={commodity.confidence} fill={style.fill} />

          <p className="line-clamp-2 text-xs text-muted-foreground" title={topReason}>
            {topReason}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
