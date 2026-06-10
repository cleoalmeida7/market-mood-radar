"use client";

import { useState } from "react";
import { toast } from "sonner";
import { usePolling } from "@/hooks/usePolling";
import type { AlertsResponse } from "@/types/api";
import { COMMODITY_TICKERS } from "@/lib/fetchers/yahoo";
import { COMMODITY_META } from "@/lib/radar/commodities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/states";

export default function AlertsPage() {
  const { data, refresh } = usePolling<AlertsResponse>("/api/alerts", 60_000);

  const [ticker, setTicker] = useState("XAU");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("50");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          direction,
          threshold: Number(threshold),
          email,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Failed to save alert", {
          description: body.details?.join(", "),
        });
      } else {
        toast.success(`Alert saved for ${ticker}`);
        setEmail("");
        refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Alert deleted");
      refresh();
    } else {
      const b = await res.json().catch(() => ({}));
      toast.error(b.error ?? "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Get an email when a commodity score crosses your threshold.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New alert</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Commodity</Label>
                <Select value={ticker} onValueChange={(v) => setTicker(v as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMODITY_TICKERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t} — {COMMODITY_META[t].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select
                    value={direction}
                    onValueChange={(v) => setDirection(v as "above" | "below")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Score rises above</SelectItem>
                      <SelectItem value="below">Score falls below</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="threshold">Threshold (-100 to 100)</Label>
                  <Input
                    id="threshold"
                    type="number"
                    min={-100}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Saving…" : "Create alert"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.warning && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-400">
                {data.warning}
              </p>
            )}
            {(data?.alerts?.length ?? 0) === 0 && !data?.warning && (
              <EmptyState
                title="No alerts yet"
                message="Create one on the left to get an email when a commodity score crosses your threshold."
              />
            )}
            {data?.alerts?.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-3 text-sm"
              >
                <div>
                  <span className="font-mono font-semibold">{a.ticker}</span>{" "}
                  {a.direction === "above" ? "≥" : "≤"}{" "}
                  <span className="font-mono">{a.threshold}</span>
                  <div className="text-xs text-muted-foreground">{a.email}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
