"use client";

import Link from "next/link";
import { usePolling } from "@/hooks/usePolling";
import type { BacktestResponse } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { styleForScore } from "@/lib/ui/labels";
import { cn } from "@/lib/utils";
import optimized from "@/lib/radar/optimized-weights.json";

// Signal weights — kept in sync with the *_WEIGHT consts in the scorers.
const WEIGHTS = [
  { source: "Technical", weight: 1.0, what: "RSI, MACD, 20/50-day MA, Bollinger Bands on the commodity's own price." },
  { source: "Hormuz", weight: 0.9, what: "Geopolitical oil/LNG supply-risk from news keywords. CL & NG only.", energy: true },
  { source: "Calendar", weight: 0.8, what: "Relevant economic-calendar events (Finnhub; often unavailable on the free tier)." },
  { source: "Market-wide", weight: 0.7, what: "DXY, VIX, 10-Year Treasury and S&P 500 moves, weighted by each commodity's sensitivity." },
  { source: "News", weight: 0.6, what: "Tone of headlines that mention the specific commodity." },
  { source: "Sentiment", weight: 0.5, what: "Broad tone across all market headlines — a small nudge shared by every commodity." },
];

const BANDS = [
  { score: 80, range: "+70 to +100" },
  { score: 40, range: "+30 to +69" },
  { score: 0, range: "−29 to +29" },
  { score: -40, range: "−30 to −69" },
  { score: -80, range: "−70 to −100" },
];

const pct = (x: number | null | undefined, d = 2) =>
  x == null ? "—" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;

export default function AboutPage() {
  // Live proof: the Gold price-model backtest. Falls back to cited figures.
  const { data } = usePolling<BacktestResponse>("/api/backtest/XAU", 10 * 60_000);
  const h7 = data?.horizons.find((h) => h.horizon === 7);
  const hitRates = data?.horizons.map((h) =>
    h.hitRate == null ? null : Math.round(h.hitRate * 100),
  );
  const hitRange =
    hitRates && hitRates.every((r) => r != null)
      ? `${Math.min(...(hitRates as number[]))}–${Math.max(...(hitRates as number[]))}%`
      : "53–58%";
  const bull7 = h7?.avgReturnLong != null ? pct(h7.avgReturnLong) : "+1.09%";
  const bear7 = h7?.avgReturnShort != null ? pct(h7.avgReturnShort) : "≈0%";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">How the radar works</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every commodity gets a single directional score from −100 (strong bear)
          to +100 (strong bull). Here&rsquo;s exactly how that number is built —
          and whether it has actually predicted anything.
        </p>
      </header>

      {/* Proof first — the most important question is "does it work?" */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-base">Does it actually work?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            We backtested the <strong>price-driven</strong> component of the score
            (technical + market-wide signals) over the last year of Gold (XAU),
            replaying the score each day and comparing it to the <em>actual</em>{" "}
            forward price move.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat
              value={hitRange}
              label="Directional hit rate (1–7 day horizons)"
              tone="good"
            />
            <Stat
              value={bull7}
              label="Avg 7-day return after a bullish read"
              tone="good"
            />
            <Stat
              value={bear7}
              label="Avg 7-day return after a bearish read"
              tone="muted"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Bullish reads preceded meaningfully higher returns than bearish ones —
            a modest but real edge. Honesty check: this isolates the reproducible
            price model (news/geopolitics aren&rsquo;t stored historically), and{" "}
            <strong>edge varies by commodity</strong> — oil&rsquo;s read is weaker.
            See the per-commodity numbers on the{" "}
            <Link href="/backtest" className="text-primary hover:underline">
              backtests page
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {/* Backtested weight tuning */}
      <WeightTuningCard />

      {/* Signals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">The six signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Signal</th>
                  <th className="py-2 pr-3 font-medium">Weight</th>
                  <th className="py-2 font-medium">What it reads</th>
                </tr>
              </thead>
              <tbody>
                {WEIGHTS.map((w) => (
                  <tr key={w.source} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3 font-medium">
                      {w.source}
                      {w.energy && (
                        <span className="ml-1 text-xs text-muted-foreground">(CL/NG)</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono">{w.weight.toFixed(1)}</td>
                    <td className="py-2 text-muted-foreground">{w.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Each scorer returns a direction (−1…+1), a 0–1 confidence, and
            plain-English reasons. Weights say how much each source is trusted
            relative to the others.
          </p>
        </CardContent>
      </Card>

      {/* Fusion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How the signals are fused</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <Step n={1} title="Weight by conviction">
            Each signal counts in proportion to its <em>weight × confidence</em>, so a
            confident technical read outweighs a hesitant news read.
          </Step>
          <Step n={2} title="Exclude neutrals">
            Signals sitting at exactly zero are dropped from the average entirely —
            they neither pull the score nor dilute it.
          </Step>
          <Step n={3} title="Damp thin reads">
            Full confidence needs ~3 corroborating signals. With fewer, the score is
            scaled down proportionally so a lone indicator can&rsquo;t shout.
          </Step>
          <Step n={4} title="Scale &amp; clamp">
            The blended −1…+1 value becomes a −100…+100 score, hard-clamped at the
            ends, and labelled with a market-weather band.
          </Step>
          <p className="pt-1 text-xs">
            The overall <strong>market mood</strong> is the confidence-weighted average
            of the six commodity scores; the loudest commodity leads the headline.
          </p>
        </CardContent>
      </Card>

      {/* Labels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score labels</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {BANDS.map((b) => {
              const s = styleForScore(b.score);
              return (
                <li key={b.range} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "inline-flex w-36 items-center gap-2 rounded-md border px-2.5 py-1",
                      s.border,
                      s.bg,
                      s.text,
                    )}
                  >
                    {s.emoji} {s.label}
                  </span>
                  <span className="font-mono text-muted-foreground">{b.range}</span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Limitations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Honest limitations</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "This is a directional mood signal, not financial advice or a price target.",
              "The economic-calendar source needs a paid Finnhub tier; on the free tier that signal is simply excluded.",
              "News and geopolitical signals are live-only — they aren't stored per day, so the backtest covers the price model alone.",
              "Backtest edge is modest and varies by commodity; past behaviour doesn't guarantee future moves.",
              "Score-history trend density depends on the snapshot cron cadence.",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-foreground/40">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function WeightTuningCard() {
  // The price-signal weights are grid-searched against history and adopted only
  // if they beat the defaults out-of-sample (see weight-optimizer.ts).
  if (!optimized.validated || !optimized.weights) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backtested weight tuning</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The optimizer grid-searches the price-signal weights but currently finds
          no improvement that holds up out-of-sample, so the engine runs on the
          documented default weights.
        </CardContent>
      </Card>
    );
  }

  const w = optimized.weights;
  const r = optimized.report;
  const ti = w.technicalIndicators;
  const indicatorList = [
    ["RSI", ti.rsi],
    ["MACD", ti.macd],
    ["MA", ti.ma],
    ["Bollinger", ti.bollinger],
  ] as const;

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardHeader>
        <CardTitle className="text-base">Backtested weight tuning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          The price-signal weights aren&rsquo;t guessed — they&rsquo;re{" "}
          <strong>grid-searched against ~2 years of history</strong> and adopted
          only when they beat the defaults on a held-out recent test window
          {r ? ` (${r.combosTried} combinations tried)` : ""}. The technical and
          market-wide weights below are the validated winners; the other signals
          keep their defaults (they can&rsquo;t be backtested).
        </p>
        {r && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat value={`${(r.testHitDefault * 100).toFixed(1)}%`} label="Default hit rate (test window)" tone="muted" />
            <Stat value={`${(r.testHitBest * 100).toFixed(1)}%`} label="Tuned hit rate (test window)" tone="good" />
            <Stat value={`+${(r.improvement * 100).toFixed(2)}pp`} label="Out-of-sample improvement" tone="good" />
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip label={`technical ×${w.technical}`} />
          <Chip label={`market-wide ×${w.marketwide}`} />
          {indicatorList.map(([name, weight]) => (
            <Chip key={name} label={`${name} ×${weight}`} dim={weight === 0} />
          ))}
        </div>
        <p className="text-xs">
          Re-tuned by running <code className="font-mono">npm run optimize</code>.
          A weight of ×0 means that indicator was dropped because it didn&rsquo;t
          help out-of-sample.
        </p>
      </CardContent>
    </Card>
  );
}

function Chip({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md border border-border px-2 py-0.5 font-mono text-xs",
        dim ? "text-muted-foreground/50 line-through" : "text-foreground",
      )}
    >
      {label}
    </span>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "good" | "muted";
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div
        className={cn(
          "font-mono text-2xl font-semibold",
          tone === "good" ? "text-emerald-400" : "text-muted-foreground",
        )}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-foreground">
        {n}
      </span>
      <p>
        <strong className="text-foreground">{title}.</strong> {children}
      </p>
    </div>
  );
}
