# marketresearch

A Next.js 16 / React 19 app that does a **market mood radar** for commodities — fusing multiple data sources into a single directional score per commodity and an overall market mood.

---

## What It Does

Tracks 6 commodities and scores each one on a scale of **-100 (bearish) to +100 (bullish)**:

| Commodity | Ticker |
|-----------|--------|
| Gold | XAU |
| Silver | XAG |
| Platinum | XPT |
| WTI Crude | CL |
| Natural Gas | NG |
| Copper | HG |

---

## Radar Engine

Located at `src/lib/radar/engine.ts`. Pulls signals from 5 sources and fuses them into a score per commodity plus an overall **market mood**.

| Signal Source | Weight | Provider |
|---------------|--------|----------|
| Technical | 1.0 | Yahoo Finance (price history → indicators) |
| Calendar | 0.8 | Finnhub economic calendar |
| News | 0.6 | Finnhub news sentiment |
| Market-wide | — | DXY, VIX, 10Y Treasury, S&P 500 |
| Hormuz | — | Geopolitical oil/LNG supply-chain signal (live, keyword-parsed) |

**Scoring rules:**
- Requires ~3 corroborating signals for full confidence — low-conviction reads are damped
- Neutral signals are excluded from the denominator
- Each score includes a `reasons[]` array explaining which signals contributed and why
- Each score includes a `confidence` percentage surfaced in the UI
- Radar output is cached for 30 seconds

> The Hormuz signal tracks geopolitical risk in the Strait of Hormuz by parsing Finnhub news for keywords: `Hormuz`, `Iran`, `Strait`, `LNG tanker`, `oil supply`. It primarily affects CL and NG scores and was the last feature added (April 17).

---

## Score Labels

Scores are mapped to human-readable market weather labels:

| Score | Label |
|-------|-------|
| +70 to +100 | 🟢 Strong Bull |
| +30 to +69 | 🟡 Cautious Optimism |
| -29 to +29 | ⚪ Neutral / Mixed |
| -30 to -69 | 🟠 Risk-Off |
| -70 to -100 | 🔴 Strong Bear |

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — commodity grid with score, direction, confidence, and mini sparkline per commodity |
| `/radar` | Main radar view — mood gauge, market weather label, "what's moving" panel, explainability panel, news and calendar panels |
| `/alerts` | Alert system — set score thresholds per commodity, delivered via email (Resend) or browser push notification |
| `/commodity/[ticker]` | Per-commodity chart with RSI, MACD, Bollinger Bands overlaid, plus score history trend |

---

## Key Features

### Explainability
Every score shows a plain-English reason:
> *"Gold: +72 — RSI oversold + bullish news sentiment + DXY falling"*

### Confidence Indicator
The engine's damping logic is surfaced in the UI:
- Low confidence (fewer than ~3 signals) — score is greyed out with a tooltip
- High confidence — score is bold and full colour

### Score History & Trends
Hourly snapshots are stored in Supabase. Each commodity page shows:
- 24h and 7d mood trend chart
- Score delta from yesterday (e.g. *"was -40, now +65"*)

### Correlation View
On the radar page, a correlation matrix flags unusual divergences:
- Gold and Silver moving in opposite directions
- Oil up while Natural Gas is flat

### Live Hormuz Signal
Dynamically scored from Finnhub news — not a static value. Updates every 30 seconds with the radar cache.

---

## Tech Stack

- **Framework:** Next.js 16
- **UI:** React 19, Tailwind CSS, shadcn/ui
- **Language:** TypeScript
- **Charts:** Recharts
- **Database:** Supabase (score history)
- **Email alerts:** Resend
- **Data:** Yahoo Finance (no key needed), Finnhub (API key required)

---

## Getting Started

### 1. Clone the repo

```bash
git clone <repo-url>
cd marketresearch
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root:

```
FINNHUB_API_KEY=your_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
RESEND_API_KEY=your_resend_key
```

- Finnhub API key: [finnhub.io](https://finnhub.io) (free tier)
- Supabase project: [supabase.com](https://supabase.com) (free tier)
- Resend API key: [resend.com](https://resend.com) (free tier)

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
  lib/
    radar/
      engine.ts         # Signal fusion engine — core scoring logic
      hormuz.ts         # Live Hormuz keyword parser
      history.ts        # Score snapshot storage (Supabase)
      correlation.ts    # Cross-commodity correlation logic
  app/
    page.tsx            # Dashboard commodity grid
    radar/
      page.tsx          # Radar page
    alerts/
      page.tsx          # Alerts system
    commodity/
      [ticker]/
        page.tsx        # Per-commodity chart + history
  api/
    radar/              # GET /api/radar — fused scores, 30s cache
    commodity/          # GET /api/commodity/[ticker] — price + indicators
    news/               # GET /api/news — Finnhub headlines by commodity
    calendar/           # GET /api/calendar — upcoming economic events
    alerts/             # POST /api/alerts — save threshold, trigger notification
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FINNHUB_API_KEY` | Yes | Finnhub API key for news and calendar data |
| `SUPABASE_URL` | Yes | Supabase project URL for score history |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `RESEND_API_KEY` | No | Resend API key for email alerts |

---

## Testing

```bash
npm test
```

Jest tests cover `engine.ts` scoring logic, damping behaviour, and neutral-exclusion rules.

---

## Notes for Developers

- Yahoo Finance requires no API key but has unofficial rate limits — don't hammer it
- Finnhub free tier has a 60 calls/minute limit — the 30s cache is intentional
- The scoring damping and neutral-exclusion logic in `engine.ts` is intentional — do not simplify it without understanding the impact on score accuracy
- The Hormuz signal is live and keyword-parsed — extend the keyword list in `hormuz.ts` if needed
- Score history snapshots are written hourly via a Next.js cron route — do not increase frequency without checking Supabase write limits
- All scores expose a `reasons[]` array and `confidence` field — always surface both in the UI
