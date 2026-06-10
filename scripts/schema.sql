-- Supabase schema for marketresearch.
-- Run this in the Supabase SQL editor before `npm run backfill` / using alerts.

-- ---------------------------------------------------------------------------
-- 1. price_history — 30-day (and ongoing) OHLCV per ticker. Seeds trend charts
--    and backfill; written by scripts/backfill.ts.
-- ---------------------------------------------------------------------------
create table if not exists price_history (
  ticker       text             not null,
  date         date             not null,
  open         double precision not null,
  high         double precision not null,
  low          double precision not null,
  close        double precision not null,
  volume       double precision not null default 0,
  yahoo_symbol text,
  currency     text,
  inserted_at  timestamptz      not null default now(),
  primary key (ticker, date)
);

create index if not exists price_history_ticker_date_idx
  on price_history (ticker, date desc);

-- ---------------------------------------------------------------------------
-- 2. alerts — user-defined score-threshold alerts (the alerts system).
--    POST /api/alerts inserts; the radar route checks these and fires Resend.
-- ---------------------------------------------------------------------------
create table if not exists alerts (
  id                uuid             primary key default gen_random_uuid(),
  ticker            text             not null,
  threshold         double precision not null,
  direction         text             not null check (direction in ('above', 'below')),
  email             text             not null,
  created_at        timestamptz      not null default now(),
  last_triggered_at timestamptz
);

create index if not exists alerts_ticker_idx on alerts (ticker);

-- ---------------------------------------------------------------------------
-- 3. radar_snapshots — hourly score snapshots that power the trend charts.
--    Written by the cron route (src/app/api/cron/snapshot). One row per
--    commodity per run, plus a special ticker = 'MOOD' row for overall mood.
-- ---------------------------------------------------------------------------
create table if not exists radar_snapshots (
  id          bigint generated always as identity primary key,
  ticker      text             not null,
  score       integer          not null,
  confidence  double precision not null default 0,
  label       text             not null,
  captured_at timestamptz      not null default now()
);

create index if not exists radar_snapshots_ticker_time_idx
  on radar_snapshots (ticker, captured_at desc);
