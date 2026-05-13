create table if not exists public.market_snapshot_daily_aggregates (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null check (timeframe in ('5m', '15m', '30m', '1h', '4h')),
  aggregate_date date not null,
  snapshot_count integer not null default 0,
  avg_price numeric not null default 0,
  avg_spread_pct numeric not null default 0,
  avg_volume_zscore numeric not null default 0,
  avg_whale_risk_score numeric not null default 0,
  avg_pump_dump_risk_score numeric not null default 0,
  cause_counts_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, timeframe, aggregate_date)
);

create index if not exists market_snapshot_daily_aggregates_lookup_idx
  on public.market_snapshot_daily_aggregates(symbol, timeframe, aggregate_date desc);

alter table public.market_snapshot_daily_aggregates enable row level security;

drop policy if exists "Service role can manage market snapshot aggregates" on public.market_snapshot_daily_aggregates;
create policy "Service role can manage market snapshot aggregates"
  on public.market_snapshot_daily_aggregates for all
  to service_role
  using (true)
  with check (true);
