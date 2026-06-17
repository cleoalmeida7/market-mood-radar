"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CommoditySignals } from "@/lib/radar/engine";
import type { SignalResult } from "@/lib/radar/signals/types";

const SOURCES: { key: keyof CommoditySignals; label: string; weight: string }[] = [
  { key: "technical", label: "Technical", weight: "1.0" },
  { key: "calendar", label: "Calendar", weight: "0.8" },
  { key: "marketwide", label: "Market-wide", weight: "0.7" },
  { key: "news", label: "News", weight: "0.6" },
  { key: "hormuz", label: "Hormuz", weight: "0.9" },
];

function direction(score: number) {
  if (score > 0) return { text: "Bullish", text_cls: "text-emerald-400", bar: "bg-emerald-500" };
  if (score < 0) return { text: "Bearish", text_cls: "text-red-400", bar: "bg-red-500" };
  return { text: "Neutral", text_cls: "text-zinc-400", bar: "bg-zinc-500" };
}

function Row({ label, weight, result }: { label: string; weight: string; result: SignalResult | null }) {
  // hormuz is null for non-energy commodities
  if (!result) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
        <span className="w-24 shrink-0">{label}</span>
        <span className="italic">n/a — oil &amp; gas only</span>
      </div>
    );
  }
  const d = direction(result.score);
  const pct = Math.round(Math.max(0, Math.min(1, result.confidence)) * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">
        {label} <span className="text-muted-foreground/50">×{weight}</span>
      </span>
      <span className={cn("w-14 shrink-0 font-medium", d.text_cls)}>{d.text}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", d.bar)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

/**
 * Expandable "5 sources" panel showing each signal's direction + confidence.
 * Reads the engine's per-commodity `signals` — no extra API calls.
 * Used inside clickable cards, so the toggle stops link navigation.
 */
export function SignalBreakdown({
  signals,
  defaultOpen = false,
}: {
  signals: CommoditySignals;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/40 pt-2">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="inline-block w-3">{open ? "▾" : "▸"}</span>
        {open ? "Hide sources" : "5 sources"}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {SOURCES.map((s) => (
            <Row key={s.key} label={s.label} weight={s.weight} result={signals[s.key]} />
          ))}
        </div>
      )}
    </div>
  );
}
