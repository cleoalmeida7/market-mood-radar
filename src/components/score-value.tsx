"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { styleForScore, arrowForScore } from "@/lib/ui/labels";
import { LOW_CONFIDENCE } from "@/components/confidence-bar";
import { cn } from "@/lib/utils";

interface ScoreValueProps {
  score: number;
  confidence: number;
  size?: "sm" | "lg";
  showArrow?: boolean;
}

/**
 * The numeric score. Low-confidence reads are greyed out with a tooltip that
 * explains why (README: confidence indicator + damping made visible).
 */
export function ScoreValue({ score, confidence, size = "lg", showArrow = true }: ScoreValueProps) {
  const style = styleForScore(score);
  const low = confidence < LOW_CONFIDENCE;
  const sign = score > 0 ? "+" : "";

  const value = (
    <span
      className={cn(
        "font-mono font-bold tabular-nums",
        size === "lg" ? "text-3xl" : "text-xl",
        low ? "text-muted-foreground/60" : style.text,
      )}
    >
      {sign}
      {score}
      {showArrow && <span className="ml-1">{arrowForScore(score)}</span>}
    </span>
  );

  if (!low) return value;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="cursor-help" />}>{value}</TooltipTrigger>
      <TooltipContent className="max-w-56">
        Low confidence ({Math.round(confidence * 100)}%) — fewer than ~3 corroborating
        signals, so this score is damped and shown greyed out.
      </TooltipContent>
    </Tooltip>
  );
}
