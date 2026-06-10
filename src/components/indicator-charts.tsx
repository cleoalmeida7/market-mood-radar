"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { IndicatorSeriesPoint } from "@/types/api";

const AXIS = { stroke: "#71717a", fontSize: 11 } as const;
const GRID = "#3f3f46";

// Keep the most recent ~90 bars for readability.
function tail(series: IndicatorSeriesPoint[], n = 90) {
  return series.slice(-n);
}

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
};

/** Price with Bollinger Bands overlaid. */
export function PriceChart({ series, color }: { series: IndicatorSeriesPoint[]; color: string }) {
  const data = tail(series);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} minTickGap={40} />
        <YAxis tick={AXIS} domain={["auto", "auto"]} width={56} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
        <Line type="monotone" dataKey="bbUpper" stroke="#52525b" dot={false} strokeWidth={1} name="BB upper" isAnimationActive={false} />
        <Line type="monotone" dataKey="bbMiddle" stroke="#71717a" dot={false} strokeDasharray="4 3" strokeWidth={1} name="BB mid (20MA)" isAnimationActive={false} />
        <Line type="monotone" dataKey="bbLower" stroke="#52525b" dot={false} strokeWidth={1} name="BB lower" isAnimationActive={false} />
        <Line type="monotone" dataKey="close" stroke={color} dot={false} strokeWidth={2} name="Close" isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** RSI (0-100) with 30/70 reference lines. */
export function RsiChart({ series }: { series: IndicatorSeriesPoint[] }) {
  const data = tail(series);
  return (
    <ResponsiveContainer width="100%" height={130}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} minTickGap={40} />
        <YAxis tick={AXIS} domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} width={56} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
        <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" />
        <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 3" />
        <Line type="monotone" dataKey="rsi" stroke="#eab308" dot={false} strokeWidth={2} name="RSI" isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** MACD line + signal line + histogram. */
export function MacdChart({ series }: { series: IndicatorSeriesPoint[] }) {
  const data = tail(series);
  return (
    <ResponsiveContainer width="100%" height={150}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={AXIS} minTickGap={40} />
        <YAxis tick={AXIS} width={56} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
        <ReferenceLine y={0} stroke="#52525b" />
        <Bar dataKey="histogram" name="Histogram" fill="#3b82f6" isAnimationActive={false} />
        <Line type="monotone" dataKey="macd" stroke="#22d3ee" dot={false} strokeWidth={2} name="MACD" isAnimationActive={false} />
        <Line type="monotone" dataKey="signal" stroke="#f97316" dot={false} strokeWidth={1.5} name="Signal" isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
