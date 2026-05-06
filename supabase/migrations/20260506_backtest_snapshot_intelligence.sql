create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null check (timeframe in ('5m', '15m', '30m', '1h', '4h')),
  price numeric not null,
  kline_json jsonb not null default '{}'::jsonb,
  orderbook_json jsonb not null default '{}'::jsonb,
  trades_json jsonb not null default '{}'::jsonb,
  indicators_json jsonb not null default '{}'::jsonb,
  risk_json jsonb not null default '{}'::jsonb,
  cause_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists market_snapshots_symbol_timeframe_created_idx
  on public.market_snapshots(symbol, timeframe, created_at desc);

create index if not exists market_snapshots_created_idx
  on public.market_snapshots(created_at desc);

create table if not exists public.movement_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null check (timeframe in ('5m', '15m', '30m', '1h', '4h')),
  event_start timestamptz not null,
  event_end timestamptz,
  move_pct numeric not null default 0,
  volume_zscore numeric not null default 0,
  detected_label text not null default 'balanced_market',
  realized_outcome text not null default 'unknown' check (realized_outcome in ('continued', 'reversed', 'wick_trap', 'low_signal', 'unknown')),
  manual_label text check (manual_label in ('organic_demand', 'whale_push', 'thin_liquidity_move', 'fomo_trap', 'fraud_pump_risk', 'news_social_catalyst', 'balanced_market')),
  confidence_score numeric not null default 0,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movement_events_symbol_timeframe_start_idx
  on public.movement_events(symbol, timeframe, event_start desc);

create table if not exists public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  config_json jsonb not null default '{}'::jsonb,
  symbols text[] not null default '{}',
  date_range tstzrange,
  metrics_json jsonb not null default '{}'::jsonb,
  events_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists backtest_runs_created_idx
  on public.backtest_runs(created_at desc);

alter table public.market_snapshots enable row level security;
alter table public.movement_events enable row level security;
alter table public.backtest_runs enable row level security;

drop policy if exists "Service role can manage market snapshots" on public.market_snapshots;
create policy "Service role can manage market snapshots"
  on public.market_snapshots for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage movement events" on public.movement_events;
create policy "Service role can manage movement events"
  on public.movement_events for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Service role can manage backtest runs" on public.backtest_runs;
create policy "Service role can manage backtest runs"
  on public.backtest_runs for all
  to service_role
  using (true)
  with check (true);
