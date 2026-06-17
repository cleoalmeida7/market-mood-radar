import { scoreHormuz, HORMUZ_AFFECTS } from "@/lib/radar/hormuz";
import type { NewsItem } from "@/lib/fetchers/finnhub";

let id = 0;
function mk(headline: string, summary = ""): NewsItem {
  return {
    id: id++,
    category: "general",
    datetime: 1_700_000_000 + id,
    headline,
    summary,
    source: "Mock",
    url: "",
    image: "",
    related: "",
  };
}

describe("scoreHormuz — output shape", () => {
  const s = scoreHormuz([mk("Iran threatens to close the Strait of Hormuz")]);
  test("returns a valid HormuzSignal", () => {
    expect(typeof s.score).toBe("number");
    expect(s.score).toBeGreaterThanOrEqual(-1);
    expect(s.score).toBeLessThanOrEqual(1);
    expect(s.confidence).toBeGreaterThanOrEqual(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
    expect(Array.isArray(s.reasons)).toBe(true);
    expect(s.reasons.length).toBeGreaterThan(0);
    expect(Array.isArray(s.matchedKeywords)).toBe(true);
    expect(typeof s.matchedArticles).toBe("number");
    expect(s.affects).toEqual(["CL", "NG"]);
  });
});

describe("scoreHormuz — edge cases", () => {
  test("empty news → neutral, zero confidence, no matches", () => {
    const s = scoreHormuz([]);
    expect(s.score).toBe(0);
    expect(s.confidence).toBe(0);
    expect(s.matchedArticles).toBe(0);
    expect(s.reasons[0].length).toBeGreaterThan(0);
  });

  test("single irrelevant article → neutral", () => {
    const s = scoreHormuz([mk("Apple unveils new iPhone")]);
    expect(s.score).toBe(0);
    expect(s.confidence).toBe(0);
    expect(s.matchedArticles).toBe(0);
  });
});

describe("scoreHormuz — direction correctness", () => {
  const escalation = scoreHormuz([
    mk("Iran threatens to close Strait of Hormuz amid tensions"),
    mk("Drone strike disrupts oil supply near Hormuz"),
    mk("LNG tanker seized in the Strait, traders fear blockade"),
  ]);
  const deescalation = scoreHormuz([
    mk("Iran and neighbors reach ceasefire, Hormuz tensions ease"),
    mk("Oil supply routes reopen as diplomats strike a deal"),
  ]);

  test("escalation → bullish oil/gas (positive)", () => {
    expect(escalation.score).toBeGreaterThan(0.3);
    expect(escalation.matchedArticles).toBe(3);
    expect(escalation.confidence).toBeGreaterThan(0);
  });

  test("de-escalation → bearish oil/gas (negative)", () => {
    expect(deescalation.score).toBeLessThan(0);
  });

  test("only ever affects CL & NG", () => {
    expect(escalation.affects).toEqual(HORMUZ_AFFECTS);
    expect(deescalation.affects).toEqual(["CL", "NG"]);
  });

  test("reasons are human-readable", () => {
    expect(escalation.reasons[0]).toContain(" ");
    expect(escalation.reasons[0]).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe("scoreHormuz — decay & saturation (Phase 2)", () => {
  const mkAt = (headline: string, datetime: number): NewsItem => ({
    id: id++, category: "general", datetime,
    headline, summary: "", source: "Mock", url: "", image: "", related: "",
  });
  const BASE = 1_700_000_000;
  const DAY = 86_400;

  test("volume does not inflate magnitude (80 ≈ 3, both ≤ 1)", () => {
    const three = scoreHormuz([
      mk("Iran threatens to close Strait of Hormuz"),
      mk("Strike disrupts oil supply near Hormuz"),
      mk("LNG tanker seized in the Strait"),
    ]);
    const eighty = scoreHormuz(
      Array.from({ length: 80 }, () =>
        mk("Iran threatens to close the Strait of Hormuz amid oil supply fears"),
      ),
    );
    expect(eighty.score).toBeLessThanOrEqual(1);
    // recency-weighted AVERAGE: sheer repetition doesn't push magnitude higher
    expect(Math.abs(eighty.score - three.score)).toBeLessThan(0.4);
  });

  test("recency: fresh de-escalation outweighs older escalation", () => {
    const items = [
      // older escalation (5 days ago — heavily recency-discounted)
      mkAt("Iran threatens to close Strait of Hormuz", BASE),
      mkAt("Drone strike disrupts oil supply near Hormuz", BASE + 100),
      mkAt("Missiles near the Strait, blockade feared", BASE + 200),
      mkAt("Iran attack raises Hormuz tensions", BASE + 300),
      mkAt("Oil supply at risk as Hormuz strikes continue", BASE + 400),
      // fresh de-escalation (now)
      mkAt("Iran and US reach ceasefire, Hormuz reopens", BASE + 5 * DAY),
      mkAt("Oil supply routes reopen as the deal holds", BASE + 5 * DAY + 100),
    ];
    const s = scoreHormuz(items);
    expect(s.score).toBeLessThan(0); // recent peace beats stale war
  });
});
