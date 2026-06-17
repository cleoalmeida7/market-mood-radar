// Live Hormuz geopolitical signal.
// Parses Finnhub news for Strait-of-Hormuz supply-risk keywords and produces a
// directional score. Supply risk in the Strait pushes oil/gas prices UP, so an
// escalation reads BULLISH (+) for CL and NG; de-escalation reads bearish (-).
//
// This signal ONLY affects CL (WTI Crude) and NG (Natural Gas).

import type { NewsItem } from "@/lib/fetchers/finnhub";
import { dedupeNews } from "@/lib/radar/dedup";

/** Commodities the Hormuz signal is allowed to influence. */
export const HORMUZ_AFFECTS = ["CL", "NG"] as const;
export type HormuzTicker = (typeof HORMUZ_AFFECTS)[number];

/**
 * Keywords that flag Strait-of-Hormuz / regional supply risk, with relative
 * weights. Stronger, more specific terms weigh more than generic ones.
 */
export const HORMUZ_KEYWORDS: { keyword: string; weight: number }[] = [
  { keyword: "hormuz", weight: 1.0 },
  { keyword: "lng tanker", weight: 0.9 },
  { keyword: "oil supply", weight: 0.8 },
  { keyword: "strait", weight: 0.6 },
  { keyword: "iran", weight: 0.5 },
];

// Escalation terms → supply risk rising → bullish oil/gas.
const ESCALATION = [
  "attack", "strike", "seize", "seized", "block", "blockade", "threat",
  "threaten", "tension", "disrupt", "halt", "closure", "close", "missile",
  "drone", "conflict", "war", "sanction",
];

// De-escalation terms → supply risk easing → bearish oil/gas.
const DE_ESCALATION = [
  "ease", "eased", "resume", "resumed", "deal", "ceasefire", "truce",
  "agreement", "reopen", "reopened", "calm", "de-escalat", "diplomat",
];

export interface HormuzSignal {
  /** -1.0 (bearish oil/gas) .. +1.0 (bullish oil/gas). */
  score: number;
  /** 0..1 — rises with the number of corroborating articles. */
  confidence: number;
  reasons: string[];
  matchedKeywords: string[];
  matchedArticles: number;
  affects: readonly HormuzTicker[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Score the Hormuz supply-risk signal from a batch of news items.
 * Returns a neutral, zero-confidence signal when nothing matches.
 */
/** Half-life (seconds) for recency weighting — a 24h-older headline counts half. */
const HORMUZ_HALF_LIFE_SEC = 24 * 60 * 60;

export function scoreHormuz(news: NewsItem[]): HormuzSignal {
  const matchedKeywordSet = new Set<string>();
  let matchedArticles = 0;
  // Net = Σ(direction · articleWeight · recency); divided by Σ(weight·recency)
  // to get a recency-weighted AVERAGE direction — so sheer volume can't inflate
  // the magnitude, and recent headlines dominate (the war winding down fades it).
  let directionalSum = 0;
  let totalWeight = 0;

  // De-duplicate first so one widely-syndicated story counts once, not N times.
  const items = dedupeNews(news);

  // Recency reference = the newest article in the batch (keeps this pure — no Date.now).
  let newest = 0;
  for (const item of items) if (item.datetime > newest) newest = item.datetime;

  for (const item of items) {
    const text = `${item.headline} ${item.summary}`.toLowerCase();

    // Which Hormuz keywords appear in this article?
    let articleWeight = 0;
    const hitKeywords: string[] = [];
    for (const { keyword, weight } of HORMUZ_KEYWORDS) {
      if (text.includes(keyword)) {
        articleWeight += weight;
        hitKeywords.push(keyword);
      }
    }
    if (articleWeight === 0) continue; // not a Hormuz-relevant article

    matchedArticles++;
    hitKeywords.forEach((k) => matchedKeywordSet.add(k));

    // Direction: count escalation vs de-escalation terms and take the net.
    // Counting (not mere presence) keeps mixed phrasing like "tensions ease"
    // or "strike a deal" from being misread — the dominant side wins.
    const escCount = ESCALATION.filter((t) => text.includes(t)).length;
    const deCount = DE_ESCALATION.filter((t) => text.includes(t)).length;
    let direction: number;
    if (escCount > deCount) direction = 1; // net escalation → bullish oil/gas
    else if (deCount > escCount) direction = -1; // net de-escalation → bearish
    else if (escCount === 0 && deCount === 0)
      direction = 0.5; // topic on the radar, no directional verb → mild bullish
    else direction = 0; // balanced mix → neutral

    // Recency weight: newest article = 1, decaying with age (24h half-life).
    const ageSec = newest > 0 ? Math.max(0, newest - item.datetime) : 0;
    const recency = Math.pow(0.5, ageSec / HORMUZ_HALF_LIFE_SEC);

    const w = articleWeight * recency;
    directionalSum += direction * w;
    totalWeight += w;
  }

  if (matchedArticles === 0) {
    return {
      score: 0,
      confidence: 0,
      reasons: ["No Hormuz/Iran supply-risk headlines detected"],
      matchedKeywords: [],
      matchedArticles: 0,
      affects: HORMUZ_AFFECTS,
    };
  }

  // Recency-weighted AVERAGE direction in [-1, 1]. 80 same-direction headlines
  // score the same as a few — volume sets confidence, not magnitude.
  const score = totalWeight > 0 ? clamp(directionalSum / totalWeight, -1, 1) : 0;

  // Confidence scales with (recency-discounted) corroboration; ~3 fresh strong
  // articles ≈ full confidence.
  const confidence = clamp(totalWeight / 3, 0, 1);

  const matchedKeywords = [...matchedKeywordSet];
  const dir = score > 0.1 ? "bullish" : score < -0.1 ? "bearish" : "mixed";
  const reasons = [
    `${matchedArticles} headline${matchedArticles === 1 ? "" : "s"} mention ` +
      `${matchedKeywords.join(", ")} → ${dir} oil/gas (Hormuz supply risk, recency-weighted)`,
  ];

  return {
    score: Number(score.toFixed(3)),
    confidence: Number(confidence.toFixed(3)),
    reasons,
    matchedKeywords,
    matchedArticles,
    affects: HORMUZ_AFFECTS,
  };
}
