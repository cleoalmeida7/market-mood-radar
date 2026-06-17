"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Two-state light/dark toggle. Renders an inert placeholder until mounted to
 * avoid a hydration mismatch (the theme is unknown during SSR). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={cn(
        "rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
        className,
      )}
    >
      {mounted ? (
        isDark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />
      ) : (
        <SunIcon className="size-4 opacity-0" />
      )}
    </button>
  );
}
