import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SiteNav } from "@/components/site-nav";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Market Mood Radar",
  description:
    "Directional mood scores for 6 commodities, fusing technicals, calendar, news, macro and geopolitical signals.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider delay={150}>
            <SiteNav />
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
            <footer className="border-t border-border/60">
              <p className="mx-auto max-w-3xl px-4 py-4 text-center text-xs text-muted-foreground">
                <strong className="font-medium">Not financial advice.</strong> Market Mood
                Radar is a directional research signal for informational purposes only — not
                an offer, recommendation, or solicitation to buy or sell any asset. Data may
                be delayed or inaccurate. Always do your own research.
              </p>
            </footer>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
