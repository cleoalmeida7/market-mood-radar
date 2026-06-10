# Market Mood Radar — Handover

A developer-focused guide to the codebase. Assumes you've never seen it before.

---

## 1. Overview & purpose

**Market Mood Radar** tracks 6 commodities and scores each one from **−100 (bearish)
to +100 (bullish)** by fusing five independent signal sources into a single
directional read, plus an overall "market mood". Every score is **explainable**
(it carries a `reasons[]` array) and **confidence-rated** (low-conviction reads are
damped and greyed out in the UI).

| Commodity | Ticker | Yahoo symbol |
|-----------|--------|--------------|
| Gold | XAU | `GC=F` |
| Silver | XAG | `SI=F` |
| Platinum | XPT | `PL=F` |
| WTI Crude | CL | `CL=F` |
| Natural Gas | NG | `NG=F` |
| Copper | HG | `HG=F` |

Market-wide context tickers: **DXY** (`DX-Y.NYB`), **VIX** (`^VIX`),
**TNX** 10Y yield (`^TNX`), **SPX** S&P 500 (`^GSPC`).

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
shadcn/ui (base-ui under the hood) · Recharts · Supabase · Resend · Jest.

---

## 2. Architecture & key decisions

```
src/
  lib/
    fetchers/       yahoo.ts (OHLCV, no key) · finnhub.ts (news + calendar)
    radar/
      engine.ts        PURE fusion — the heart of the app
      indicators.ts    RSI / MACD / MA / Bollinger (values + signals + series)
      hormuz.ts        live geopolitical keyword signal (CL/NG only)
      commodities.ts   names + keyword metadata
      correlation.ts   7-day cross-commodity correlation
      load.ts          tolerant loader that gathers engine inputs from the fetchers
      signals/         one scorer per source: technical/calendar/news/marketwide
    supabase.ts        client factory
    alerts.ts          threshold evaluation + Resend email
    ui/labels.ts       score → weather label + colour
  app/
    page.tsx           Dashboard (/)
    radar/             Radar (/radar)
    commodity/[ticker] Per-commodity detail
    alerts/            Alerts manager
    api/               route handlers (see §5)
  components/          UI (shadcn primitives in components/ui)
  hooks/usePolling.ts  30s polling fetch hook
  types/api.ts         client-facing API response types
scripts/               tsx smoke tests + schema.sql + backfill
```

**Decision: the engine is a pure function.** `computeRadar(inputs, generatedAt?)`
takes *pre-fetched* data (prices, news, calendar) and returns the full result with
no I/O inside. This makes it trivially unit-testable (see
`src/lib/radar/__tests__/engine.test.ts`) and keeps fetching/caching concerns in the
route layer (`load.ts` + `unstable_cache`).

**Decision: signal scorers are uniform.** Every scorer returns
`{ score: -1..1, confidence: 0..1, reasons: string[] }`. The engine treats them
identically, so adding a source later is mechanical.

### The scoring / damping logic (do not "simplify" without understanding)

For each commodity the engine runs all applicable scorers, then fuses them:

1. **Blend by source-weight × confidence.**
   `weighted = Σ(score·weight·confidence) / Σ(weight·confidence)` → a value in −1..1.
   Weighting by confidence means a low-confidence directional blip can't dominate.

2. **Neutral exclusion.** Signals with `score === 0` are dropped from the
   denominator entirely. This matters for signals that are *present but undecided*
   (e.g. balanced news = score 0 but confidence > 0); including them would wrongly
   dilute the average toward zero.

3. **Damping for low conviction.** Count the scorers with `confidence > 0.3`
   ("conviction-grade"). `dampFactor = min(count / 3, 1)`. The final score is
   `round(weighted × 100 × dampFactor)`, clamped to ±100. So a read backed by only
   1–2 confident signals is scaled to ⅓–⅔ of its raw strength — the README's
   "requires ~3 corroborating signals for full confidence" rule.

4. **Confidence output** = (weight-mean of contributing confidences) × dampFactor,
   in 0..1. The UI greys out and tooltips any score with confidence < 0.3.

5. **Labels** (exact README bands): ≥70 Strong Bull · ≥30 Cautious Optimism ·
   −29..29 Neutral/Mixed · −30..−69 Risk-Off · ≤−70 Strong Bear.

6. **Market mood** = confidence-weighted average of the 6 scores.
   `dominantCommodity` = largest |score|; `dominantReason` = its top reason.

---

## 3. The five signal sources & weights

| Source | Weight | Provider | What it does |
|--------|--------|----------|--------------|
| **Technical** | 1.0 | Yahoo OHLCV | Fuses RSI, MACD, 20/50-day MA, Bollinger into one read. Each indicator emits −1/0/+1 + confidence + a reason; neutral indicators are excluded. |
| **Calendar** | 0.8 | Finnhub economic calendar | Maps events to commodities via 3 channels: *energy inventory* (oil/gas builds/draws → CL/NG), *USD-macro* (CPI/jobs/Fed → metals via real rates), *growth* (GDP/PMI → industrials). Resolved surprises drive direction; pending high-impact events add uncertainty. |
| **News** | 0.6 | Finnhub general news | Lexical sentiment over headlines that mention the commodity (whole-word match so "oil" ≠ "turmoil"). |
| **Market-wide** | 0.7 | Yahoo (DXY/VIX/TNX/SPX) | Per-commodity sensitivity matrix to macro moves (e.g. gold: dollar↓ & yields↓ & VIX↑ = bullish; copper loves risk-on). |
| **Hormuz** | 0.9 | Finnhub news | Live geopolitical supply-risk overlay — **CL & NG only** (see §4). |

> The 1.0/0.8/0.6 weights are from the README. Market-wide (0.7) and Hormuz (0.9)
> are "—" in the README; the chosen values are documented in their modules and in
> `engine.ts`.

Confidence notes: MACD confidence is normalised by recent **daily volatility**
(scale-free), so it isn't perpetually muted for high-priced commodities like gold.
MA/Bollinger confidence use *percentage* separation, which is naturally scale-free.

---

## 4. The Hormuz signal (live, keyword-parsed)

`src/lib/radar/hormuz.ts` scans Finnhub news for Strait-of-Hormuz supply-risk
keywords — `hormuz`, `lng tanker`, `oil supply`, `strait`, `iran` — each weighted by
specificity. For every matching article it counts **escalation** vs
**de-escalation** terms (attack/seize/threaten vs ease/ceasefire/reopen) and takes
the net direction. Counting (not mere presence) keeps phrasing like *"tensions ease"*
or *"strike a deal"* from being misread.

- Output: `score ∈ −1..+1` (escalation = bullish oil/gas), `confidence` rising with
  the number of corroborating articles (~3 ≈ full), and a `reasons[]` entry.
- It **only** feeds CL and NG. For every other commodity `signals.hormuz === null`.
- It re-runs on each radar refresh (30s cache), so it's genuinely live, not static.

---

## 5. API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/radar` | GET | Full fused result (6 commodities + mood + 7-day sparklines). Cached 30s via `unstable_cache`. Also evaluates alerts and fires Resend. |
| `/api/commodity/[ticker]` | GET | OHLCV bars + latest indicators + indicator **series** (for charts). 400 on unknown ticker. |
| `/api/news` | GET | Finnhub headlines grouped by commodity. Empty + warning if unkeyed. |
| `/api/calendar` | GET | Upcoming economic events. Empty + warning on 403 (premium endpoint) or missing key. |
| `/api/alerts` | GET / POST / DELETE | List / create (validated) / delete threshold alerts in Supabase. |
| `/api/history/[ticker]` | GET | Score-snapshot history (24h + 7d) + delta, from `radar_snapshots`. |
| `/api/cron/snapshot` | GET/POST | Computes the radar and writes hourly snapshots. Secured by `CRON_SECRET`. |

Everything that needs a key or DB **degrades gracefully** (empty data + a `warning`
field, or a 503) so the app never shows a blank page or a raw error.

---

## 6. Environment variables

Defined in `.env.local` (git-ignored) and mirrored empty in `.env.example`.

| Variable | Required | Where to get it | What it does |
|----------|----------|-----------------|--------------|
| `FINNHUB_API_KEY` | Yes (for news/calendar/Hormuz) | [finnhub.io](https://finnhub.io) free tier | News sentiment, economic calendar, Hormuz signal. Without it the radar still runs on technicals + macro. |
| `SUPABASE_URL` | Yes (for history/alerts) | [supabase.com](https://supabase.com) project settings | Score history + alerts persistence. |
| `SUPABASE_ANON_KEY` | Yes (for history/alerts) | Supabase project settings | Supabase client auth. |
| `RESEND_API_KEY` | No | [resend.com](https://resend.com) | Sends alert emails when a threshold is crossed. |
| `ALERTS_FROM_EMAIL` | No | — | Override the "from" address (defaults to Resend's onboarding sender). |
| `CRON_SECRET` | For cron | Any random string | Authorises `/api/cron/snapshot` (Vercel injects it as `Authorization: Bearer …`). |

---

## 7. Running & deploying

### Local
```bash
npm install
cp .env.example .env.local   # then fill in keys (optional — app degrades without them)
npm run dev                  # http://localhost:3000
```
Windows note: run only **one** `next dev` at a time — duplicate dev servers crash the
Turbopack worker. Node lives at `C:\Program Files\nodejs` (not on the git-bash PATH;
use PowerShell). Standalone TS scripts run via `node --import tsx scripts/<x>.ts`.

Useful scripts: `npm test` (Jest engine tests), `npm run build`, and the tsx smoke
tests `npm run test:yahoo|test:hormuz|test:indicators|test:signals|test:engine`.

### Supabase setup
1. Create a project, copy URL + anon key into `.env.local`.
2. Run `scripts/schema.sql` in the Supabase SQL editor (creates `price_history`,
   `alerts`, `radar_snapshots`).
3. `npm run backfill` seeds 30 days of price history.

### Vercel
1. Import the repo; set all env vars in Project → Settings → Environment Variables
   (including `CRON_SECRET`).
2. `vercel.json` already declares the hourly cron (`0 * * * *` → `/api/cron/snapshot`);
   Vercel auto-sends the `CRON_SECRET` bearer token.
3. Deploy. The 30s radar cache and 60-calls/min Finnhub limit are respected by design.

---

## 8. Known limitations

- **Finnhub free tier**: 60 calls/min (the 30s cache is intentional). The
  **economic calendar is a premium endpoint** — the free tier returns 403, so the
  calendar panel will show its graceful "not available on this plan" note.
- **Yahoo Finance** is an *unofficial* endpoint with no key and informal rate limits.
  `load.ts` fetches tolerantly and the radar caches for 30s; don't hammer it.
- **News sentiment is lexical**, not an ML model — good enough for a directional
  nudge, not for nuance. Same for the calendar event→commodity heuristics.
- **Sparklines/correlation use 7 daily closes** — short window, indicative not rigorous.

---

## 9. Still pending (needs real credentials)

Everything below is **built and credential-ready**, just not yet exercised live
because `.env.local` still holds placeholder values:

- [ ] Add a real `FINNHUB_API_KEY` → live news, Hormuz, calendar (and run
      `npm run test:finnhub` to confirm).
- [ ] Add `SUPABASE_URL` + `SUPABASE_ANON_KEY`, run `scripts/schema.sql`, then
      `npm run backfill` → enables alert persistence and the score-history charts.
- [ ] Add `RESEND_API_KEY` → alert emails.
- [ ] Set `CRON_SECRET` (and deploy) → hourly snapshots begin populating the trend
      charts.

---

## 10. Suggested next improvements

- Replace lexical news sentiment with a small model or Finnhub's sentiment endpoint.
- Cache Yahoo responses in Supabase to survive rate-limiting and add longer history.
- Add per-commodity alert history / "last fired" UI and a test-send button.
- Backfill `radar_snapshots` from `price_history` so trend charts aren't empty on day one.
- Add E2E tests (Playwright) for the four pages and a CI workflow running `npm test`.
- Make signal weights configurable (env or a small admin panel) for experimentation.
- Surface the correlation matrix's strongest *positive* pairs too, not just divergences.
