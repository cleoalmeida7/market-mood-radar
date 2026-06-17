# NOTE.md — Project Handover for Management

**Project:** Market Mood Radar — a web app that scores 6 commodities (Gold, Silver,
Platinum, WTI Crude, Natural Gas, Copper) on a −100…+100 "directional mood" scale
by fusing technical, macro, news and geopolitical signals.

**Live site:** https://marketresearch-tau.vercel.app
**Status:** Built and deployed. All planned features (14-step roadmap) are complete.

This note lists everything **your side needs to own, decide, or maintain** when you
take the project over. It is non-technical where possible. Deep technical detail
lives in `HANDOVER-CLAUDE.md` and `README.md` in this repo.

---

## 1. DO FIRST — critical items

These block proper ownership and should be handled before anything else.

- [ ] **Move the project onto a company-owned Vercel account.**
  It currently lives on a **personal** Vercel account (`cleosaviocruzalmeida-7143s-projects`)
  on the **free "Hobby" plan**. Vercel's Hobby plan is for **non-commercial use only** —
  running this as a business product on it is against their terms. Action: create/usE a
  company Vercel account, upgrade to **Pro**, and transfer the project to it.
- [ ] **Take ownership of every external account** (see §2) — get the logins or transfer
  ownership to a company email, and **rotate all API keys/secrets** so they are no longer
  tied to the original developer.
- [ ] **Re-enter all environment variables** on the company Vercel account (see §3).
- [ ] **Decide on a custom domain** (e.g. `radar.nxtlsolutions.com`). The site currently
  uses the default Vercel URL; no custom domain is attached.

---

## 2. Accounts & external services to take over

The app depends on these third-party services. For each: get ownership/credentials,
move to a company email, and review the plan.

| Service | What it's used for | Current plan | Action needed |
|---|---|---|---|
| **Vercel** | Hosting + deployment + cron | Hobby (free, personal) | Transfer to company account, upgrade to **Pro** (commercial use + better cron) |
| **Supabase** | Database (price history, score history, alerts) | Free tier | Take ownership; watch free-tier limits (storage, row counts) |
| **Finnhub** | News headlines + geopolitical signal | Free tier | Take ownership. **Economic calendar needs a PAID tier** (free returns 403 — see §5) |
| **Yahoo Finance** | Price data | No account (public, unofficial API) | Nothing to own, but it's an **unofficial** source that can break (see §5) |
| **Resend** | Alert emails | Free tier | Take ownership. **Currently NOT sending — needs domain verification** (see §5) |
| **Sentry** | Error monitoring/alerting | Free tier | Take ownership; you'll get notified of production errors here |
| **cron-job.org** | Triggers the hourly data refresh | Free | Take ownership, or replace with Vercel Pro cron (see §4) |
| **GitHub / source repo** | The code itself | — | Ensure company has admin access to the repository |

---

## 3. Environment variables (secrets)

These must be set in Vercel (Settings → Environment Variables) for **Production**.
The repo's `.env.example` lists them. **Never commit real values.**

| Variable | Purpose | Required? |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Database connection | Yes |
| `FINNHUB_API_KEY` | News + geopolitical signal | Yes (app degrades without it) |
| `CRON_SECRET` | Password that protects the data-refresh endpoint | Yes |
| `RESEND_API_KEY` | Sending alert emails | Optional (alerts off without it) |
| `SENTRY_DSN` | Error monitoring | Optional (recommended — already set) |
| `RATE_LIMIT_PER_MIN` | API abuse protection (default 60/min) | Optional |

> Reminder: changing an env var only takes effect after a **new deployment**.

---

## 4. Keeping it running day-to-day

- **Data refresh is automatic.** A scheduled job ("cron") refreshes prices and records
  daily scores. It runs **hourly via cron-job.org** and **daily via Vercel**. As long as
  these keep firing (and `CRON_SECRET` is unchanged), the data and charts stay current on
  their own — **no daily manual reset is needed.**
- **If you move off cron-job.org:** Vercel **Pro** allows more frequent built-in cron, so
  you can drop the external service. On the free Hobby plan, Vercel cron only runs once a
  day, which is why cron-job.org was added for hourly updates.
- **Deploying changes:** a developer publishes updates by running `vercel --prod` from the
  project, or via the Vercel dashboard. Only people with repo + Vercel access can deploy.

---

## 5. Known limitations / things NOT currently working

Be transparent about these — they are by design or pending a paid upgrade.

1. **Alert emails do not send yet.** Resend requires a **verified sender domain**. Until a
   company domain is verified in Resend (and `RESEND_API_KEY` set), the alert feature is
   inactive. This was the one planned feature left switched off for this reason.
2. **Economic-calendar data is unavailable.** Finnhub's calendar is a **paid** endpoint;
   on the free tier it returns "access denied" and that signal is simply skipped (the app
   handles it gracefully). Upgrade Finnhub if you want it.
3. **Price data comes from an unofficial Yahoo Finance API.** It's free but not guaranteed;
   Yahoo can rate-limit or change it. A fallback host is built in, but for a commercial
   product consider a paid market-data provider.
4. **This is a directional signal, not financial advice.** Honesty matters here: the
   backtest shows only a **modest edge** (~52% directional accuracy on the price model,
   vs ~50% baseline). **A clear "not financial advice / for information only" disclaimer
   should be shown to users** before any public/commercial launch — please confirm with
   legal/compliance.

---

## 6. Ongoing maintenance (occasional, by a developer)

- **Re-tune the model (optional, ~monthly/quarterly).** The scoring weights were optimised
  against 2 years of history. A developer can re-run the optimiser (`npm run optimize`) and
  redeploy to refresh them — it only adopts new weights if they still beat the current ones
  on held-out data. This is **not automatic** by design.
- **Monitor Sentry** for production errors.
- **If the database is ever wiped/reset**, a developer reseeds it (`npm run backfill` then
  `npm run seed:snapshots`).
- **Rotate API keys** periodically and whenever staff changes.

---

## 7. Rough cost picture

Everything currently runs on **free tiers (≈ $0/month)**. Expect costs when scaling to a
commercial product (verify current pricing with each vendor):

- **Vercel Pro** — required for commercial use; per-seat monthly fee.
- **Finnhub paid** — only if you want the economic-calendar signal.
- **Supabase paid** — only when you outgrow the free database limits.
- **Resend / Sentry** — generous free tiers; paid only at higher volume.
- **Custom domain** — small annual registration fee.

---

## 8. Handover checklist (tick as completed)

- [ ] Company Vercel account created, on **Pro**, project transferred
- [ ] Ownership of Supabase, Finnhub, Resend, Sentry, cron-job.org moved to company
- [ ] GitHub/repo admin access confirmed for the company
- [ ] All API keys/secrets rotated and re-entered in Vercel
- [ ] Custom domain attached
- [ ] Resend sender domain verified → alert emails enabled
- [ ] Decided whether to upgrade Finnhub (economic calendar)
- [ ] "Not financial advice" disclaimer reviewed with legal and shown in the app
- [ ] Cron confirmed running (data stays current)
- [ ] A maintaining developer identified for deploys & periodic re-tuning

---

_For technical/engineering detail, see `HANDOVER-CLAUDE.md` (full build log, architecture,
env setup) and `README.md` (spec + scoring methodology). Last updated 2026-06-17._
