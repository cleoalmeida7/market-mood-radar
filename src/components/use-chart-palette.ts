"use client";

import { useTheme } from "next-themes";

// Recharts renders stroke/fill as SVG *attributes*, where CSS var() does NOT
// resolve — so charts can't use the theme tokens directly. Instead we map the
// active theme to concrete neutral colors here; switching theme re-renders the
// charts via useTheme. Vivid series colors (score line, indicator series,
// score-band colors) work in both themes and stay hard-coded at the call sites.
export interface ChartPalette {
  /** Axis ticks / labels. */
  axis: string;
  /** Gridlines. */
  grid: string;
  /** Reference lines (zero line, thresholds). */
  ref: string;
  /** Track/background fill (e.g. the mood gauge backdrop). */
  track: string;
  /** Bollinger band lines. */
  bbBand: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipLabel: string;
}

const DARK: ChartPalette = {
  axis: "#71717a",
  grid: "#3f3f46",
  ref: "#52525b",
  track: "#27272a",
  bbBand: "#52525b",
  tooltipBg: "#18181b",
  tooltipBorder: "#3f3f46",
  tooltipLabel: "#a1a1aa",
};

const LIGHT: ChartPalette = {
  axis: "#52525b",
  grid: "#e4e4e7",
  ref: "#a1a1aa",
  track: "#e4e4e7",
  bbBand: "#a1a1aa",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e4e4e7",
  tooltipLabel: "#52525b",
};

/** Neutral chart colors for the active theme (defaults to dark pre-mount). */
export function useChartPalette(): ChartPalette {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "light" ? LIGHT : DARK;
}
