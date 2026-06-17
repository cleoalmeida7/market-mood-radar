# HANDOVER-CLAUDE.md — session continuity

> Living doc for Claude/dev continuity. **Updated after every completed step** with:
> step + commit hash, next step, and any issues found.

---

## 1. Current project state

**Market Mood Radar** — a Next.js 16 / React 19 / TS app scoring 6 commodities
(−100..+100) by fusing 5 signals, plus an overall market mood. **Built, committed,
and DEPLOYED to Vercel** at **https://marketresearch-tau.vercel.app**.

- **Deployed & live** (Hobby plan). All env vars set in Vercel + `.env.local`.
- **Integrations verified live:** Finnhub (news + Hormuz), Supabase (alerts,
  snapshots, price_history backfill of 221 rows + 154 seeded snapshot rows),
  Resend (alert email confirmed), cron route (CRON_SECRET-secured).
- **Pages:** `/` dashboard, `/radar`, `/commodity/[ticker]`, `/alerts`.
- **API routes:** `/api/radar`, `/api/commodity/[ticker]`, `/api/news`,
  `/api/calendar`, `/api/alerts`, `/api/history/[ticker]`, `/api/cron/snapshot`.
- **Tests:** `npm test` (Jest) — engine.test.ts currently (19 tests). More coming
  in Phase 1 Step 1.
- **Local data scripts:** `npm run backfill`, `npm run seed:snapshots`, plus tsx
  smoke tests (`test:yahoo|finnhub|hormuz|indicators|signals|engine`).

## 2. Full git log (`git log --oneline`)

```
4801a8f docs: cron-job.org setup instructions
37b11dc feat(ui): per-commodity signal breakdown panel
dd5170e fix(ui): tick 'updated X ago' every second (was 5s, jumpy increments)
08f41e7 docs: note economic-calendar deferral (step 3) in handover
cec8e7b feat(db): seed radar snapshots from price history
1863b71 fix: vercel cron to daily
16c50a4 docs: update README to reflect built state
e06e9bf docs: handover document
201f1cc feat(radar): correlation matrix
9c34eba test(radar): engine unit tests
8c4300e fix(ui): loading, error and empty states
817db88 fix(ui): mobile responsive pass
b46471a feat(api): hourly cron snapshot route (...)
bd73069 feat(ui): alerts page (/alerts) + Resend trigger wired into /api/radar
bdb835d feat(ui): commodity detail page (/commodity/[ticker]) ...
2c268c3 feat(ui): radar page (/radar)
131be8e feat(ui): dashboard page (/) with commodity grid
7c53814 feat(db): Supabase schema + backfill
307bf17 feat(api): wire route handlers
1066d8c feat(radar): Step 4 — fusion engine
4ff4f5e fix(radar): match commodity keywords on word boundaries
0ade727 feat(radar): step 3 — signal scorers (technical/calendar/news/marketwide)
4c2838f feat(radar): step 2 — technical indicators (RSI, MACD, MA, Bollinger)
17ccfea feat(radar): step 1 — live Hormuz supply-risk signal (CL/NG)
4c1fd31 feat: phase 2 — Yahoo & Finnhub fetchers + backfill
b238216 chore: initial scaffold
```
_(Tip: re-run `git log --oneline` for the live list; this is a snapshot.)_

## 3. The 14-step roadmap (6 phases)

### PHASE 1 — Safety net + quick wins
- **Step 1:** Jest tests for `indicators.ts`, `hormuz.ts`, and all 4 signal scorers —
  output shape, edge cases (empty / single data point), direction correctness.
  `npm test` must pass. → commit `test: indicators, hormuz and signals coverage`
- **Step 2:** Confirm cron-job.org set up per `CRON_SETUP.md` (user does manually).

### PHASE 2 — Fix the relevance problem
- **Step 3:** Broad market-sentiment signal (weight 0.5) over ALL headlines nudging
  every commodity + Hormuz decay (recency-weight headlines, cap one-story
  saturation) + tests. → `feat(radar): broad sentiment signal + Hormuz decay`
- **Step 4:** Topic de-duplication — cluster repeated headlines (one story = one
  strong signal, not 80). Apply to news scorer AND Hormuz. → `feat(radar): topic de-duplication`

### PHASE 3 — Stronger signals
- **Step 5:** Cache Yahoo in Supabase — store 12 months/ticker, read from Supabase
  instead of hitting Yahoo each request (MA-50/MACD need 50+ bars). →
  `feat(db): cache Yahoo price history in Supabase`

### PHASE 4 — Trust & credibility
- **Step 6:** Backtesting — replay historical scores vs actual next-N-day price moves
  (1/3/7d) using `price_history`; `/backtest` page per commodity. →
  `feat: backtesting engine + /backtest page`
- **Step 7:** `/about` page — scoring methodology, weights, damping, Hormuz in plain
  English. → `feat(ui): methodology /about page`

### PHASE 5 — UX improvements
- **Step 8:** Mood-over-time chart on `/radar` from `radar_snapshots`. → `feat(ui): mood over time chart`
- **Step 9:** Alerts upgrade — last-fired timestamp, send-test-email button,
  enable/disable toggle per alert. → `feat(ui): alerts upgrade`
- **Step 10:** Click a reason → show underlying headlines (expandable per commodity). →
  `feat(ui): reasons drill-down to headlines`
- **Step 11:** Light/dark toggle. → `feat(ui): light/dark toggle`

### PHASE 6 — Hardening
- **Step 12:** Rate-limit `/api/radar`, `/api/news`, `/api/calendar`. → `feat(api): rate limiting on public routes`
- **Step 13:** Sentry error monitoring + Yahoo fallback source. → `feat(ops): Sentry + Yahoo fallback`
- **Step 14:** Playwright E2E smoke tests (all 4 pages). → `test: Playwright E2E smoke tests`

## 4. Where we are

▶ **PHASE 2 COMPLETE** (Step 3 sentiment+Hormuz decay ✅, Step 4 topic dedup ✅).
Next: **Phase 3, Step 5** (cache 12mo Yahoo history in Supabase) — **awaiting user
go-ahead.** NOT yet deployed — Phase 2 engine changes need `vercel --prod` to go live.
Rule: commit after each step, update this file, then WAIT for user confirmation
before the next phase.

## 5. Key architectural decisions

- **`engine.ts` is PURE** — `computeRadar(inputs, generatedAt?)` takes pre-fetched
  data (prices, news, calendar), no I/O. Fetching/caching lives in `load.ts` +
  the route layer (`unstable_cache`, 30s).
- **Uniform scorers** — every signal returns `{ score: -1..1, confidence: 0..1, reasons[] }`.
- **Fusion (do not simplify):**
  - Blend by `sourceWeight × confidence`: `weighted = Σ(score·w·conf) / Σ(w·conf)`.
  - **Neutral exclusion** — signals with `score === 0` are dropped from the denominator.
  - **Damping** — count scorers with `confidence > 0.3`; `dampFactor = min(count/3, 1)`;
    `finalScore = round(weighted × 100 × dampFactor)`, clamped ±100.
  - **Confidence** = weight-mean of contributing confidences × dampFactor (0..1).
  - **Weights:** technical 1.0, calendar 0.8, news 0.6, market-wide 0.7, Hormuz 0.9.
  - **Labels:** ≥70 Strong Bull · ≥30 Cautious Optimism · −29..29 Neutral/Mixed ·
    −30..−69 Risk-Off · ≤−70 Strong Bear.
  - **Mood** = confidence-weighted avg of the 6; `dominantCommodity` = max |score|.
- **Hormuz signal** (`hormuz.ts`, CL/NG only): keyword scan of news (hormuz, lng
  tanker, oil supply, strait, iran), counts escalation vs de-escalation terms →
  net direction (escalation = bullish oil/gas). Confidence saturates ~3 articles.
  _(Phase 2 will add recency-decay + saturation cap — known over-domination issue.)_
- **MACD confidence** normalised by recent daily volatility (scale-free).
- **News commodity match** uses word boundaries (so "oil" ≠ "turmoil").

## 6. `.env.example` variables

```
FINNHUB_API_KEY=        # Finnhub free tier — news + Hormuz (calendar is premium/403)
SUPABASE_URL=           # Supabase project URL
SUPABASE_ANON_KEY=      # Supabase key (we use the sb_secret_ key; server-side only, RLS off)
RESEND_API_KEY=         # Resend — alert emails (optional)
CRON_SECRET=            # authorises /api/cron/snapshot
```
_(Optional, not in example: `ALERTS_FROM_EMAIL` to override the Resend sender once a
domain is verified.)_

## 7. Known issues

- **OneDrive crash** — the project lives in `OneDrive\Desktop\marketresearch`;
  OneDrive locks/syncs `.next` mid-write, corrupting the Turbopack persistent cache
  (`Failed to open database … invalid digit found in string`), which kills
  `next dev`. Workaround: `rm -rf .next` + restart, and run **one** dev server at a
  time. Real fix: move the project out of OneDrive.
- **Finnhub 403 on economic calendar** — premium endpoint; free tier returns 403.
  Handled gracefully (panel shows "not available"); calendar signal is excluded
  (neutral). Deferred — see HANDOVER.md §8a.
- **Trend charts** — `radar_snapshots` only fills via cron; Vercel Hobby cron is
  **daily**. Seeded 22 days from price_history (mapped to recent dates because the
  market data lags the wall clock here). Hourly density needs cron-job.org (Phase 1
  Step 2) — see `CRON_SETUP.md`.
- **Relevance skew** — news/Hormuz currently over-weight one dominant story (Iran
  war). Phase 2 (Steps 3–4) fixes this.
- **Thin price history** — only ~22 trading days backfilled, so MA-50/MACD are
  under-powered. Phase 3 Step 5 fixes this (12 months cached in Supabase).

---

## Progress log

- **Phase 1 Step 1 — DONE** (`2ca4c40` test: indicators, hormuz and signals coverage).
  Added `indicators.test.ts`, `hormuz.test.ts`, `signals.test.ts`. `npm test` =
  **4 suites / 58 tests passing** (19 engine + 39 new). No issues found.
  → **Next: Phase 1 Step 2** (confirm cron-job.org — user does this manually).
- **Phase 1 Step 2 — DONE** (manual, no commit). cron-job.org job created: hourly
  (`0 * * * *`), GET `…/api/cron/snapshot`, `Authorization: Bearer <CRON_SECRET>`
  header. **TEST RUN = 200 OK** (snapshot written). Hourly snapshots now live.
  → **PHASE 1 COMPLETE. Next: Phase 2 Step 3** — awaiting user go-ahead.
- **Phase 2 Step 3 — DONE** (`505c5f4` feat(radar): broad sentiment signal + Hormuz
  decay). New `sentiment.ts` (weight 0.5, scores ALL-headline tone, nudges every
  commodity, added to engine + SignalBreakdown UI). Hormuz reworked to
  recency-weighted AVERAGE (24h half-life) so volume can't saturate it and recent
  news dominates. Added `sentiment.test.ts` + hormuz decay/saturation tests + an
  engine sentiment-nudge test; updated engine.test scenarios (sentiment neutralised
  in the shared mock; damped case given its own sparse-news scenario). `npm test` =
  **5 suites / 68 passing**; clean build OK. NOTE: not yet deployed — needs
  `vercel --prod` to go live.
  → **Next: Phase 2 Step 4** (topic de-duplication for news + Hormuz).
- **Phase 2 Step 4 — DONE** (`8b08bad` feat(radar): topic de-duplication). New
  `dedup.ts` — clusters near-identical headlines (Jaccard ≥ 0.6 on significant
  tokens), keeps the most-recent per cluster. Applied inside `scoreNews`,
  `scoreMarketSentiment`, and `scoreHormuz` (the `/api/news` panel still shows ALL
  raw headlines). Added `dedup.test.ts`; updated sentiment/engine tests to use
  DISTINCT headlines (identical ones now collapse). `npm test` = **6 suites / 75
  passing**; clean build OK.
  → **PHASE 2 COMPLETE. Next: Phase 3 Step 5** — awaiting user go-ahead.
  ⚠️ Phase 2 changes NOT yet deployed — run `vercel --prod` to push live.
