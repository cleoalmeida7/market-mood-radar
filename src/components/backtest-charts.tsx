"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BacktestResult } from "@/types/api";
import { styleForScore, type WeatherKey } from "@/lib/ui/labels";
import { useChartPalette } from "@/components/use-chart-palette";
import { cn } from "@/lib/utils";

const REP_SCORE: Record<WeatherKey, number> = {
  bull: 80,
  cautious: 40,
  neutral: 0,
  riskoff: -40,
  bear: -80,
};
const hexFor = (key: WeatherKey) => styleForScore(REP_SCORE[key]).hex;

const pct = (x: number | null, digits = 2) =>
  x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;

export function BacktestCharts({ result }: { result: BacktestResult }) {
  const [horizon, setHorizon] = useState<number>(7);
  const pal = useChartPalette();
  const AXIS = { stroke: pal.axis, fontSize: 11 };
  const TOOLTIP = {
    contentStyle: {
      backgroundColor: pal.tooltipBg,
      border: `1px solid ${pal.tooltipBorder}`,
      borderRadius: 8,
      fontSize: 12,
    },
    labelStyle: { color: pal.tooltipLabel },
  };

  const scoreData = result.points.map((p) => ({
    t: new Date(`${p.date}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    score: p.score,
  }));

  const buckets = (result.buckets[horizon] ?? []).map((b) => ({
    label: bandShort(b.key),
    key: b.key,
    ret: b.avgReturn == null ? null : Number((b.avgReturn * 100).toFixed(3)),
    n: b.n,
  }));

  return (
    <div className="space-y-3">
      {/* Reconstructed score over the backtest window */}
      {scoreData.length >= 2 ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={scoreData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={pal.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" tick={AXIS} minTickGap={48} />
            <YAxis tick={AXIS} domain={[-100, 100]} ticks={[-100, -50, 0, 50, 100]} width={40} />
            <Tooltip {...TOOLTIP} />
            <ReferenceLine y={0} stroke={pal.ref} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#a78bfa"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center rounded-md border border-dashed border-border text-center text-sm text-muted-foreground">
          Not enough history to chart the score.
        </div>
      )}

      {/* Horizon selector for the band chart */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          Avg forward return by mood band
        </p>
        <div className="flex items-center gap-1">
          {result.horizons.map((h) => (
            <button
              key={h.horizon}
              onClick={() => setHorizon(h.horizon)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                horizon === h.horizon
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              {h.horizon}d
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={pal.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} />
          <YAxis tick={AXIS} width={48} tickFormatter={(v) => `${v}%`} />
          <Tooltip
            {...TOOLTIP}
            formatter={(value, _name, item) => {
              const n = (item?.payload as { n?: number })?.n ?? 0;
              return [`${value}%`, `avg ${horizon}d return (n=${n})`];
            }}
          />
          <ReferenceLine y={0} stroke={pal.ref} />
          <Bar dataKey="ret" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {buckets.map((b) => (
              <Cell key={b.key} fill={hexFor(b.key)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground">
        If the read has edge, bullish bands should show higher forward returns
        than bearish ones. Sparse bands (low n) are noisy.
      </p>
    </div>
  );
}

function bandShort(key: WeatherKey): string {
  switch (key) {
    case "bull":
      return "Bull";
    case "cautious":
      return "Cautious";
    case "neutral":
      return "Neutral";
    case "riskoff":
      return "Risk-Off";
    case "bear":
      return "Bear";
  }
}

/** Small stats table for the three horizons — exported for the page header. */
export function HorizonStatsTable({ result }: { result: BacktestResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Horizon</th>
            <th className="py-2 pr-3 font-medium">Hit rate</th>
            <th className="py-2 pr-3 font-medium">Corr.</th>
            <th className="py-2 pr-3 font-medium">Bull avg</th>
            <th className="py-2 pr-3 font-medium">Bear avg</th>
            <th className="py-2 font-medium">n</th>
          </tr>
        </thead>
        <tbody>
          {result.horizons.map((h) => {
            const edge = h.hitRate != null && h.hitRate > 0.5;
            return (
              <tr key={h.horizon} className="border-b border-border/50">
                <td className="py-2 pr-3 font-mono">{h.horizon}d</td>
                <td
                  className={cn(
                    "py-2 pr-3 font-mono",
                    h.hitRate == null
                      ? "text-muted-foreground"
                      : edge
                        ? "text-emerald-400"
                        : "text-red-400",
                  )}
                >
                  {h.hitRate == null ? "—" : `${(h.hitRate * 100).toFixed(0)}%`}
                </td>
                <td className="py-2 pr-3 font-mono text-muted-foreground">
                  {h.correlation == null ? "—" : h.correlation.toFixed(2)}
                </td>
                <td className="py-2 pr-3 font-mono">
                  <span className="text-emerald-400">{pct(h.avgReturnLong)}</span>{" "}
                  <span className="text-muted-foreground">({h.longN})</span>
                </td>
                <td className="py-2 pr-3 font-mono">
                  <span className="text-red-400">{pct(h.avgReturnShort)}</span>{" "}
                  <span className="text-muted-foreground">({h.shortN})</span>
                </td>
                <td className="py-2 font-mono text-muted-foreground">{h.n}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
