"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCorrelation } from "@/lib/radar/correlation";

/** Background colour for a correlation cell: green (correlated) → red (diverging). */
function cellColor(corr: number): string {
  if (corr > 0) return `rgba(16, 185, 129, ${Math.min(corr, 1) * 0.55})`; // emerald
  if (corr < 0) return `rgba(239, 68, 68, ${Math.min(-corr, 1) * 0.55})`; // red
  return "transparent";
}

export function CorrelationMatrix({ spark }: { spark: Record<string, number[]> }) {
  const { tickers, matrix, divergences } = buildCorrelation(spark);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Correlation (7-day)</CardTitle>
        <p className="text-xs text-muted-foreground">
          How the commodities are moving relative to each other ·
          <span className="text-emerald-400"> green = correlated</span>,
          <span className="text-red-400"> red = diverging</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <table className="min-w-[360px] border-separate border-spacing-0.5 text-center text-xs">
            <thead>
              <tr>
                <th className="p-1" />
                {tickers.map((t) => (
                  <th key={t} className="p-1 font-mono font-medium text-muted-foreground">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickers.map((rowT, i) => (
                <tr key={rowT}>
                  <th className="p-1 text-right font-mono font-medium text-muted-foreground">
                    {rowT}
                  </th>
                  {tickers.map((colT, j) => {
                    const v = matrix[i][j];
                    const self = i === j;
                    return (
                      <td
                        key={colT}
                        className="h-8 w-10 rounded-sm font-mono tabular-nums"
                        style={{ backgroundColor: self ? "rgba(113,113,122,0.15)" : cellColor(v) }}
                        title={`${rowT} vs ${colT}: ${self ? "—" : v.toFixed(2)}`}
                      >
                        {self ? "—" : v.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Notable divergences</p>
          {divergences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing unusual — commodities are broadly moving together.
            </p>
          ) : (
            <ul className="space-y-1">
              {divergences.map((d) => (
                <li key={`${d.a}-${d.b}`} className="flex items-start gap-2 text-sm">
                  <span>⚠️</span>
                  <span>
                    {d.note}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      (r = {d.corr.toFixed(2)})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
