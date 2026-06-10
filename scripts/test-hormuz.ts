// Test the Hormuz signal with mock news. Run: npm run test:hormuz
import { scoreHormuz } from "../src/lib/radar/hormuz.ts";
import type { NewsItem } from "../src/lib/fetchers/finnhub.ts";

let id = 0;
function mk(headline: string, summary = ""): NewsItem {
  return {
    id: id++,
    category: "general",
    datetime: 1_700_000_000 + id,
    headline,
    summary,
    source: "MockWire",
    url: "https://example.com",
    image: "",
    related: "",
  };
}

const cases: { name: string; news: NewsItem[] }[] = [
  {
    name: "No relevant news",
    news: [mk("Apple unveils new iPhone"), mk("Fed holds rates steady")],
  },
  {
    name: "Escalation (3 articles)",
    news: [
      mk("Iran threatens to close Strait of Hormuz amid tensions"),
      mk("Drone strike disrupts oil supply near Hormuz"),
      mk("LNG tanker seized in the Strait, traders fear blockade"),
      mk("Unrelated tech earnings beat"),
    ],
  },
  {
    name: "De-escalation",
    news: [
      mk("Iran and neighbors reach ceasefire, Hormuz tensions ease"),
      mk("Oil supply routes reopen as diplomats strike a deal"),
    ],
  },
  {
    name: "Single weak hit",
    news: [mk("Iran economy minister visits Europe")],
  },
];

console.log("=== Hormuz signal smoke test ===\n");
for (const c of cases) {
  const s = scoreHormuz(c.news);
  console.log(`[${c.name}]`);
  console.log(
    `   score=${s.score}  confidence=${s.confidence}  ` +
      `articles=${s.matchedArticles}  keywords=[${s.matchedKeywords.join(", ")}]`,
  );
  console.log(`   reasons: ${s.reasons.join(" | ")}`);
  console.log(`   affects: ${s.affects.join(", ")}\n`);
}

// Light assertions
const esc = scoreHormuz(cases[1].news);
const de = scoreHormuz(cases[2].news);
const none = scoreHormuz(cases[0].news);
if (!(esc.score > 0.3)) throw new Error("expected escalation to be bullish");
if (!(de.score < 0)) throw new Error("expected de-escalation to be bearish");
if (none.score !== 0 || none.confidence !== 0)
  throw new Error("expected neutral on no match");
console.log("PASS: escalation bullish, de-escalation bearish, no-match neutral.");
