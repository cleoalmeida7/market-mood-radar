# Hourly snapshots via cron-job.org

Vercel's **free Hobby plan only runs cron jobs once per day**, so the score‑history
trend charts fill slowly. To get **hourly** snapshots, use the free
[cron-job.org](https://cron-job.org) service to call the snapshot endpoint every
hour. This is independent of Vercel's plan limits.

> No screenshots are embedded here — each setting is described exactly. The
> cron-job.org UI is simple; the field names below match what you'll see.

---

## What it calls

| | Value |
|---|---|
| **URL** | `https://marketresearch-tau.vercel.app/api/cron/snapshot` |
| **Method** | `GET` |
| **Header** | `Authorization: Bearer <CRON_SECRET>` |

`<CRON_SECRET>` is the value from your `.env.local` (the same one set in Vercel →
Settings → Environment Variables). **Do not commit the real secret** — keep it only
in cron-job.org and Vercel.

> The route also accepts the secret as a query param
> (`…/api/cron/snapshot?secret=<CRON_SECRET>`) as a fallback, but the **header is
> preferred** — query params can show up in logs/history.

---

## Step-by-step

1. **Create a free account** at <https://cron-job.org> and sign in.
2. Click **"Create cronjob"** (or **CRONJOBS → Create cronjob**).
3. **Title:** `marketresearch hourly snapshot` (anything you like).
4. **Address (URL):** paste
   `https://marketresearch-tau.vercel.app/api/cron/snapshot`
5. **Schedule:** choose **"Every hour"** — i.e. run at **minute 0 of every hour**.
   (In *expert mode* this is the cron expression `0 * * * *`. cron-job.org allows
   intervals as short as 1 minute on the free tier, so hourly is fine.)
6. **Request method:** scroll to the **Advanced** / request section and set the
   method to **GET**.
7. **Headers:** still in Advanced, add a custom **request header**:
   - **Key / Name:** `Authorization`
   - **Value:** `Bearer <CRON_SECRET>`  ← paste your real secret after `Bearer `
8. Leave the rest at defaults. Make sure the job is **Enabled**.
9. Click **Create** / **Save**.

---

## Verifying it works

- In cron-job.org, open the job → **"History"** (execution log). After the next run
  you should see a row with status **200 / OK**.
- Click a history entry to see the response body — a success looks like:
  ```json
  { "ok": true, "written": 7, "capturedAt": "2026-06-16T18:00:00.000Z" }
  ```
  (`written: 7` = 6 commodities + the MOOD row.)
- On the site, open any commodity page → **Score history** — a new point appears
  each hour, and the 24h view starts to look continuous.

You can also test immediately from your own terminal:
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://marketresearch-tau.vercel.app/api/cron/snapshot
```

---

## Troubleshooting

| Response | Meaning | Fix |
|----------|---------|-----|
| **401 Unauthorized** | Wrong/missing `Authorization` header | Re-check the header is exactly `Bearer <secret>` and matches `CRON_SECRET` in Vercel |
| **503** `CRON_SECRET not configured` | `CRON_SECRET` env var missing on Vercel | Add it in Vercel → Settings → Environment Variables, then redeploy |
| **503** `Supabase not configured` | Supabase env vars missing on Vercel | Add `SUPABASE_URL` / `SUPABASE_ANON_KEY`, then redeploy |
| **500** | DB insert failed | Confirm `scripts/schema.sql` was run (the `radar_snapshots` table exists) |

---

## Note on the Vercel cron

`vercel.json` still defines a **daily** cron (`0 0 * * *`) that also hits this same
endpoint — that's fine. Running both just adds one extra snapshot per day (harmless).
If you'd rather avoid the duplicate, you can remove the `crons` block from
`vercel.json` once cron-job.org is handling the hourly schedule.
