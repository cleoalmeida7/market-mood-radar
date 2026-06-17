// Topic de-duplication: cluster near-identical headlines (the same story echoed
// across many outlets) so it counts as ONE signal, not N. Applied by the
// news-based scorers (news, sentiment, hormuz) before they count headlines.

import type { NewsItem } from "@/lib/fetchers/finnhub";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "as", "at", "for",
  "is", "are", "be", "by", "with", "from", "amid", "near", "its", "it", "that",
  "this", "after", "over", "into", "up", "down", "new", "says", "say", "could",
  "will", "has", "have", "was", "were",
]);

/** Significant lower-case word set for a headline (stopwords + short words dropped). */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Jaccard similarity of two token sets (0..1). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Headlines sharing ≥ this fraction of significant words are the same story. */
export const SAME_STORY_THRESHOLD = 0.6;

/**
 * Collapse near-duplicate headlines to one representative per cluster (the most
 * recent in the cluster). Greedy single pass against cluster representatives.
 */
export function dedupeNews(
  news: NewsItem[],
  threshold = SAME_STORY_THRESHOLD,
): NewsItem[] {
  const clusters: { rep: NewsItem; toks: Set<string> }[] = [];

  for (const item of news) {
    const toks = tokenize(`${item.headline} ${item.summary ?? ""}`);
    let merged = false;
    for (const c of clusters) {
      if (jaccard(toks, c.toks) >= threshold) {
        if (item.datetime > c.rep.datetime) c.rep = item; // keep most recent
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push({ rep: item, toks });
  }

  return clusters.map((c) => c.rep);
}
