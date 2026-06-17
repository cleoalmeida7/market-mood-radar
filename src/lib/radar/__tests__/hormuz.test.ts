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
