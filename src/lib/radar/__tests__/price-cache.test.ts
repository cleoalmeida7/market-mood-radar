import { rowsToPriceHistory, type PriceRow } from "@/lib/radar/price-cache";

function row(ticker: string, date: string, close: number): PriceRow {
  return {
    ticker, date,
    open: close * 0.99, high: close * 1.01, low: close * 0.98, close,
    volume: 1000, yahoo_symbol: `${ticker}=F`, currency: "USD",
  };
}

describe("rowsToPriceHistory", () => {
  test("empty → empty", () => {
    expect(rowsToPriceHistory([])).toEqual({});
  });

  test("groups by ticker, sorts dates ascending, builds bars", () => {
    const out = rowsToPriceHistory([
      row("XAU", "2026-01-03", 2010),
      row("XAU", "2026-01-01", 2000),
      row("XAU", "2026-01-02", 2005),
      row("CL", "2026-01-01", 80),
    ]);
    expect(Object.keys(out).sort()).toEqual(["CL", "XAU"]);
    expect(out.XAU.bars.map((b) => b.date)).toEqual([
      "2026-01-01", "2026-01-02", "2026-01-03",
    ]);
    expect(out.XAU.bars[0].close).toBe(2000);
    expect(out.XAU.yahooSymbol).toBe("XAU=F");
    expect(out.XAU.currency).toBe("USD");
    expect(out.XAU.bars[0].timestamp).toBeGreaterThan(0);
    expect(out.CL.bars).toHaveLength(1);
  });

  test("null volume → 0; missing symbol/currency → defaults", () => {
    const out = rowsToPriceHistory([
      { ticker: "NG", date: "2026-01-01", open: 3, high: 3.1, low: 2.9, close: 3,
        volume: null, yahoo_symbol: null, currency: null },
    ]);
    expect(out.NG.bars[0].volume).toBe(0);
    expect(out.NG.yahooSymbol).toBe("NG");
    expect(out.NG.currency).toBe("USD");
  });
});
