"use client";

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from "recharts";
import { styleForScore } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";

/** Large semicircle gauge for the overall market mood (-100..+100). */
export function MoodGauge({ score, label }: { score: number; label: string }) {
  const style = styleForScore(score);
  const sign = score > 0 ? "+" : "";

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <ResponsiveContainer width="100%" height={220}>
        <RadialBarChart
          innerRadius="78%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
          barSize={26}
          data={[{ value: score, fill: style.hex }]}
        >
          <PolarAngleAxis type="number" domain={[-100, 100]} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={14} />
        </RadialBarChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
        <span className={cn("font-mono text-5xl font-bold tabular-nums", style.text)}>
          {sign}
          {score}
        </span>
        <span className={cn("mt-1 text-lg font-medium", style.text)}>
          {style.emoji} {label}
        </span>
        <span className="mt-0.5 text-xs text-muted-foreground">overall market mood</span>
      </div>
    </div>
  );
}
