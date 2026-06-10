-- Supabase schema for marketresearch.
-- Run this in the Supabase SQL editor before running `npm run backfill`.

-- 30-day (and ongoing) OHLCV history per ticker, used to seed trend charts.
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

-- NOTE: hourly score snapshots (radar output) get their own table in a later
-- phase, once the engine exists.
