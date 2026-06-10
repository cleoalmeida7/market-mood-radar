// Maps radar scores to the README's market-weather labels + colour styling.
// Full literal class strings (no concatenation) so Tailwind's JIT picks them up.

export type WeatherKey = "bull" | "cautious" | "neutral" | "riskoff" | "bear";

export interface LabelStyle {
  key: WeatherKey;
  label: string;
  emoji: string;
  /** text colour for the score/label */
  text: string;
  /** translucent background tint for cards/badges */
  bg: string;
  /** border tint */
  border: string;
  /** solid colour for bars/fills */
  fill: string;
  /** hex for Recharts strokes/fills */
  hex: string;
}

const STYLES: Record<WeatherKey, LabelStyle> = {
  bull: {
    key: "bull", label: "Strong Bull", emoji: "🟢",
    text: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30",
    fill: "bg-emerald-500", hex: "#10b981",
  },
  cautious: {
    key: "cautious", label: "Cautious Optimism", emoji: "🟡",
    text: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30",
    fill: "bg-amber-500", hex: "#f59e0b",
  },
  neutral: {
    key: "neutral", label: "Neutral / Mixed", emoji: "⚪",
    text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30",
    fill: "bg-zinc-400", hex: "#a1a1aa",
  },
  riskoff: {
    key: "riskoff", label: "Risk-Off", emoji: "🟠",
    text: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30",
    fill: "bg-orange-500", hex: "#f97316",
  },
  bear: {
    key: "bear", label: "Strong Bear", emoji: "🔴",
    text: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30",
    fill: "bg-red-500", hex: "#ef4444",
  },
};

/** Score → weather style (bands match the README label table exactly). */
export function styleForScore(score: number): LabelStyle {
  if (score >= 70) return STYLES.bull;
  if (score >= 30) return STYLES.cautious;
  if (score > -30) return STYLES.neutral;
  if (score > -70) return STYLES.riskoff;
  return STYLES.bear;
}

/** Directional arrow from a score (flat band around zero). */
export function arrowForScore(score: number): "↑" | "↓" | "→" {
  if (score > 5) return "↑";
  if (score < -5) return "↓";
  return "→";
}
