"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/radar", label: "Radar" },
  { href: "/backtest", label: "Backtest" },
  { href: "/alerts", label: "Alerts" },
  { href: "/about", label: "About" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          <span className="sm:hidden">📡 Radar</span>
          <span className="hidden sm:inline">📡 Market Mood Radar</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:px-3",
                  active && "bg-muted text-foreground",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
