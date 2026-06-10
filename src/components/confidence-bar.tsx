"use client";

import { cn } from "@/lib/utils";

/** Threshold below which a score is treated as low-conviction (README: ~3 signals). */
export const LOW_CONFIDENCE = 0.3;

interface ConfidenceBarProps {
  /** 0..1 */
  confidence: number;
  fill: string; // tailwind bg-* class
  className?: string;
}

export function ConfidenceBar({ confidence, fill, className }: ConfidenceBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const low = confidence < LOW_CONFIDENCE;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Confidence</span>
        <span className={cn(low && "text-muted-foreground/70")}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", low ? "bg-muted-foreground/40" : fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
