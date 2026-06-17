"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { ScoreSnapshot } from "@/types/api";
import { useChartPalette } from "@/components/use-chart-palette";

type Range = "24h" | "7d";

export function ScoreHistoryChart({
  snapshots,
  warning,
}: {
  snapshots: ScoreSnapshot[];
  warning?: string;
}) {
  const [range, setRange] = useState<Range>("7d");
  const p = useChartPalette();
  const AXIS = { stroke: p.axis, fontSize: 11 };

  const cutoff = Date.now() - (range === "24h" ? 24 : 24 * 7) * 60 * 60 * 1000;
  const data = snapshots
    .filter((s) => new Date(s.captured_at).getTime() >= cutoff)
    .map((s) => ({
      t: new Date(s.captured_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
      }),
      score: s.score,
    }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        {(["24h", "7d"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              range === r
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      {data.length < 2 ? (
        <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border text-center text-sm text-muted-foreground">
          {warning ?? "Not enough snapshots yet — the trend builds up as the hourly cron runs."}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={p.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" tick={AXIS} minTickGap={40} />
            <YAxis tick={AXIS} domain={[-100, 100]} ticks={[-100, -50, 0, 50, 100]} width={40} />
            <Tooltip
              contentStyle={{
                backgroundColor: p.tooltipBg,
                border: `1px solid ${p.tooltipBorder}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: p.tooltipLabel }}
            />
            <ReferenceLine y={0} stroke={p.ref} />
            <Line type="monotone" dataKey="score" stroke="#a78bfa" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
