"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IndicatorSet, IndicatorResult } from "@/lib/radar/indicators";

function signalBadge(signal: number) {
  if (signal > 0) return { text: "Bullish", cls: "text-emerald-400 border-emerald-500/30" };
  if (signal < 0) return { text: "Bearish", cls: "text-red-400 border-red-500/30" };
  return { text: "Neutral", cls: "text-zinc-400 border-zinc-500/30" };
}

function Row({ r }: { r: IndicatorResult }) {
  const b = signalBadge(r.signal);
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{r.name}</span>
          {r.value != null && (
            <span className="font-mono text-xs text-muted-foreground">{r.value}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{r.reason}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant="outline" className={cn(b.cls)}>{b.text}</Badge>
        <span className="text-[10px] text-muted-foreground">
          conf {Math.round(r.confidence * 100)}%
        </span>
      </div>
    </div>
  );
}

/** Latest reading for every engine indicator (RSI, MACD, MA, Bollinger). */
export function IndicatorList({ indicators }: { indicators: IndicatorSet }) {
  return (
    <div>
      <Row r={indicators.rsi} />
      <Row r={indicators.macd} />
      <Row r={indicators.ma} />
      <Row r={indicators.bollinger} />
    </div>
  );
}
