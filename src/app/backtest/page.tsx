import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { COMMODITY_TICKERS } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";

export const metadata = {
  title: "Backtest — Market Mood Radar",
};

// /backtest — pick a commodity to replay its price-model score vs forward returns.
export default function BacktestIndexPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Backtests</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Does the radar&rsquo;s read actually precede price moves? Each backtest
          replays the price-driven score (technical + market-wide) across the last
          year and scores it against the real 1 / 3 / 7-day forward return.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMMODITY_TICKERS.map((t) => (
          <Link key={t} href={`/backtest/${t}`} className="group">
            <Card className="transition-colors hover:border-foreground/30 hover:bg-muted/30">
              <CardContent className="flex items-center justify-between py-5">
                <div>
                  <p className="font-mono text-lg">{t}</p>
                  <p className="text-sm text-muted-foreground">{COMMODITY_META[t].name}</p>
                </div>
                <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
