// Broad market-sentiment signal (weight 0.5).
// Scores the tone of ALL recent headlines (not commodity-filtered) and nudges
// every commodity. This dilutes any single dominant story so the overall mood
// reflects general market news, not just one event.

import type { NewsItem } from "@/lib/fetchers/finnhub";
import { BULLISH, BEARISH, countWords } from "@/lib/radar/signals/news";
import { dedupeNews } from "@/lib/radar/dedup";
import { type SignalResult, round3, clamp } from "@/lib/radar/signals/types";

export const SENTIMENT_WEIGHT = 0.5;

/** Headlines needed for full confidence (broad signal → wants decent volume). */
const FULL_VOLUME = 12;

/**
 * Net bullish/bearish tone across the whole news feed.
 * Same value applies to every commodity (it's a market-wide read).
 */
export function scoreMarketSentiment(news: NewsItem[]): SignalResult {
  let bull = 0;
  let bear = 0;

  // De-duplicate so one widely-syndicated story doesn't dominate the tone.
  for (const item of dedupeNews(news)) {
    const text = `${item.headline} ${item.summary}`.toLowerCase();
    const b = countWords(text, BULLISH);
    const s = countWords(text, BEARISH);
    if (b > s) bull++;
    else if (s > b) bear++;
  }

  const directional = bull + bear;
  if (directional === 0) {
    return { score: 0, confidence: 0, reasons: ["Market sentiment: no directional headlines"] };
  }

  const score = (bull - bear) / directional; // -1 .. +1
  const agreement = Math.abs(bull - bear) / directional;
  // Confidence from coverage volume × agreement (a broad signal wants many articles).
  const confidence = clamp((directional / FULL_VOLUME) * (0.5 + 0.5 * agreement), 0.1, 1);

  const lean = score > 0.05 ? "bullish" : score < -0.05 ? "bearish" : "mixed";
  return {
    score: round3(score),
    confidence: round3(confidence),
    reasons: [
      `Market sentiment: ${bull} of ${directional} headlines bullish, ${bear} bearish → ${lean} overall tone`,
    ],
  };
}
