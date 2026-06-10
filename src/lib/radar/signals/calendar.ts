// Economic calendar signal scorer (weight 0.8).
// Maps Finnhub economic events to commodities via three channels:
//   - energyInventory: oil/gas storage builds/draws (CL, NG)
//   - usdMacro:        inflation / jobs / rates → metals via USD & real rates
//   - growth:          activity surprises → industrial commodities
//
// Resolved events (actual vs estimate) drive direction; high-impact PENDING
// events add uncertainty (they damp confidence but stay directionally neutral).

import type { EconomicEvent } from "@/lib/fetchers/finnhub";
import type { CommodityTicker } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { type SignalResult, round3, clamp } from "@/lib/radar/signals/types";

export const CALENDAR_WEIGHT = 0.8;

type Channel = "energyInventory" | "usdMacro" | "growth";

interface Classification {
  affects: CommodityTicker[];
  channel: Channel;
}

const ENERGY_INVENTORY = ["inventor", "stocks", "storage"];
const USD_MACRO = [
  "cpi", "inflation", "ppi", "nonfarm", "payroll", "unemployment",
  "fed", "fomc", "interest rate", "rate decision", "dollar",
];
const GROWTH = ["gdp", "pmi", "manufacturing", "industrial production", "retail sales"];

function impactWeight(impact: string): number {
  switch (impact.toLowerCase()) {
    case "high": return 1.0;
    case "medium": return 0.6;
    case "low": return 0.3;
    default: return 0.4;
  }
}

/** Decide which commodities an event touches and through which channel. */
function classify(event: EconomicEvent): Classification | null {
  const name = event.event.toLowerCase();

  const isEnergy = ENERGY_INVENTORY.some((k) => name.includes(k));
  if (isEnergy) {
    if (name.includes("natural gas") || name.includes("gas")) {
      return { affects: ["NG"], channel: "energyInventory" };
    }
    if (name.includes("crude") || name.includes("oil") || name.includes("petroleum")) {
      return { affects: ["CL"], channel: "energyInventory" };
    }
  }

  // Macro channel only counts US events (USD-driven metals story).
  const isUS = event.country.toUpperCase() === "US";
  if (isUS && USD_MACRO.some((k) => name.includes(k))) {
    return { affects: ["XAU", "XAG", "XPT"], channel: "usdMacro" };
  }
  if (isUS && GROWTH.some((k) => name.includes(k))) {
    return { affects: ["CL", "HG", "XPT"], channel: "growth" };
  }
  return null;
}

/**
 * Directional effect of a resolved surprise on a commodity, in [-1, 1].
 * surpriseSign = sign(actual - estimate).
 */
function directionFor(channel: Channel, surpriseSign: number): number {
  switch (channel) {
    // Bigger build than expected (actual > estimate) → bearish for the fuel.
    case "energyInventory": return -surpriseSign;
    // Hotter data (actual > estimate) → higher rates / stronger USD → bearish metals.
    case "usdMacro": return -surpriseSign;
    // Stronger activity (actual > estimate) → bullish industrials.
    case "growth": return surpriseSign;
  }
}

export function scoreCalendar(
  ticker: CommodityTicker,
  events: EconomicEvent[],
): SignalResult {
  const meta = COMMODITY_META[ticker];

  let weighted = 0;
  let resolvedWeight = 0;
  let pendingWeight = 0;
  const reasons: string[] = [];

  for (const event of events) {
    const cls = classify(event);
    if (!cls || !cls.affects.includes(ticker)) continue;

    const w = impactWeight(event.impact);
    const hasActual = event.actual != null && event.estimate != null;

    if (!hasActual) {
      // Upcoming high/medium-impact event → uncertainty, no direction.
      if (w >= 0.6) {
        pendingWeight += w;
        reasons.push(`${event.event} pending (${event.impact} impact) — watch for surprise`);
      }
      continue;
    }

    const surprise = (event.actual as number) - (event.estimate as number);
    const surpriseSign = Math.sign(surprise);
    if (surpriseSign === 0) continue;

    const direction = directionFor(cls.channel, surpriseSign);
    weighted += direction * w;
    resolvedWeight += w;

    const beat = surprise > 0 ? "above" : "below";
    const effect = direction > 0 ? "bullish" : "bearish";
    reasons.push(
      `${event.event} came in ${beat} estimate → ${effect} ${meta.name}`,
    );
  }

  if (resolvedWeight === 0 && pendingWeight === 0) {
    return { score: 0, confidence: 0, reasons: [`Calendar: no relevant ${meta.name} events`] };
  }

  const score = resolvedWeight === 0 ? 0 : clamp(weighted / resolvedWeight, -1, 1);

  // Resolved events build confidence; pending-only events keep it low.
  let confidence: number;
  if (resolvedWeight === 0) {
    confidence = clamp(pendingWeight / 4, 0.1, 0.3); // uncertainty, not conviction
  } else {
    // Pending events slightly dampen an otherwise resolved read.
    const damp = 1 - clamp(pendingWeight / 6, 0, 0.3);
    confidence = clamp((resolvedWeight / 2) * damp, 0.1, 1);
  }

  return { score: round3(score), confidence: round3(confidence), reasons };
}
