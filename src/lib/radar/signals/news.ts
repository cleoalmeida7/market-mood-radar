// News sentiment signal scorer (weight 0.6).
// Lightweight lexical sentiment over Finnhub headlines/summaries that mention
// the commodity. (Hormuz is a SEPARATE signal handled in the engine.)

import type { NewsItem } from "@/lib/fetchers/finnhub";
import type { CommodityTicker } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { type SignalResult, round3, clamp } from "@/lib/radar/signals/types";

export const NEWS_WEIGHT = 0.6;

const BULLISH = [
  "rally", "surge", "gain", "gains", "jump", "rise", "rises", "rising",
  "climb", "higher", "demand", "shortage", "tighten", "bullish", "soar",
  "boost", "support", "rebound", "strong", "upbeat",
];
const BEARISH = [
  "fall", "falls", "drop", "drops", "plunge", "slump", "glut", "oversupply",
  "surplus", "weak", "weaker", "lower", "bearish", "slide", "tumble",
  "decline", "pressure", "selloff", "sell-off", "downbeat",
];

function countWords(text: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (text.includes(w)) n++;
  return n;
}

export function scoreNews(
  ticker: CommodityTicker,
  news: NewsItem[],
): SignalResult {
  const meta = COMMODITY_META[ticker];

  let bull = 0;
  let bear = 0;
  let relevant = 0;
  const samples: string[] = [];

  for (const item of news) {
    const text = `${item.headline} ${item.summary}`.toLowerCase();
    if (!meta.keywords.some((k) => text.includes(k))) continue;
    relevant++;

    const b = countWords(text, BULLISH);
    const s = countWords(text, BEARISH);
    if (b > s) {
      bull++;
      if (samples.length < 2) samples.push(`“${item.headline}”`);
    } else if (s > b) {
      bear++;
      if (samples.length < 2) samples.push(`“${item.headline}”`);
    }
  }

  if (relevant === 0) {
    return {
      score: 0,
      confidence: 0,
      reasons: [`News: no ${meta.name}-specific headlines`],
    };
  }

  const directional = bull + bear;
  if (directional === 0) {
    return {
      score: 0,
      confidence: clamp(relevant / 10, 0, 0.3),
      reasons: [`News: ${relevant} ${meta.name} headlines, tone neutral`],
    };
  }

  const score = (bull - bear) / directional; // -1 .. +1
  // Confidence from volume of directional coverage + agreement strength.
  const agreement = Math.abs(bull - bear) / directional;
  const confidence = clamp((directional / 5) * (0.5 + 0.5 * agreement), 0.1, 1);

  const lean = score > 0 ? "bullish" : score < 0 ? "bearish" : "mixed";
  const reasons = [
    `News: ${Math.max(bull, bear)} of ${directional} ${meta.name} headlines lean ${lean}`,
  ];
  if (samples.length) reasons.push(`e.g. ${samples.join("; ")}`);

  return { score: round3(score), confidence: round3(confidence), reasons };
}
