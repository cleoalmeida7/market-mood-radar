"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Friendly error card with an optional retry. Never shows a raw stack. */
export function ErrorCard({
  title = "Couldn’t load this data",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-red-500/30 bg-red-500/10">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="text-2xl">⚠️</div>
        <div>
          <p className="font-medium">{title}</p>
          {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Empty-state block (dashed border) with a title and prompt. */
export function EmptyState({
  title,
  message,
  className,
}: {
  title: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-md border border-dashed border-border py-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      {message && <p className="max-w-xs text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}

/** Subtle "Updated Xs ago" that re-renders every 5s; flags stale on error. */
export function UpdatedAgo({
  updatedAt,
  stale,
  className,
}: {
  updatedAt: number | null;
  stale?: boolean;
  className?: string;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  if (!updatedAt) return null;
  const secs = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  const label = secs < 60 ? `${secs}s ago` : `${Math.round(secs / 60)}m ago`;

  return (
    <span className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span
        className={cn("inline-block size-1.5 rounded-full", stale ? "bg-amber-400" : "bg-emerald-500")}
      />
      {stale ? "Stale — couldn’t refresh · " : ""}Updated {label}
    </span>
  );
}
