import { dedupeNews, jaccard } from "@/lib/radar/dedup";
import type { NewsItem } from "@/lib/fetchers/finnhub";

let id = 0;
const mk = (headline: string, datetime = 1_700_000_000 + id): NewsItem => ({
  id: id++, category: "general", datetime,
  headline, summary: "", source: "Mock", url: "", image: "", related: "",
});

describe("jaccard", () => {
  test("identical sets = 1, disjoint = 0, empty = 0", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
    expect(jaccard(new Set<string>(), new Set(["a"]))).toBe(0);
  });
});

describe("dedupeNews", () => {
  test("empty → empty", () => {
    expect(dedupeNews([])).toHaveLength(0);
  });

  test("identical headlines collapse to one", () => {
    const out = dedupeNews([
      mk("Iran closes the Strait of Hormuz"),
      mk("Iran closes the Strait of Hormuz"),
      mk("Iran closes the Strait of Hormuz"),
    ]);
    expect(out).toHaveLength(1);
  });

  test("distinct stories are all kept", () => {
    const out = dedupeNews([
      mk("Gold rallies to a record high"),
      mk("Copper tumbles on weak China demand"),
      mk("Natural gas storage builds sharply"),
    ]);
    expect(out).toHaveLength(3);
  });

  test("near-duplicate wording clusters together", () => {
    const out = dedupeNews([
      mk("Gold prices rally to a record high"),
      mk("Gold prices rally to record high today"),
    ]);
    expect(out).toHaveLength(1);
  });

  test("keeps the most recent item as the representative", () => {
    const out = dedupeNews([
      mk("Iran closes the Strait of Hormuz", 100),
      mk("Iran closes the Strait of Hormuz", 500),
      mk("Iran closes the Strait of Hormuz", 300),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].datetime).toBe(500);
  });

  test("80 copies of one story count as one", () => {
    const out = dedupeNews(
      Array.from({ length: 80 }, () => mk("Iran threatens to close the Strait of Hormuz")),
    );
    expect(out).toHaveLength(1);
  });
});
