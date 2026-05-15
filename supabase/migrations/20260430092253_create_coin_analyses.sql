create table if not exists public.coin_analyses (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null check (timeframe in ('5m', '15m', '30m', '1h', '4h')),
  price numeric not null,
  indicator_json jsonb not null default '{}'::jsonb,
  risk_json jsonb not null default '{}'::jsonb,
  social_json jsonb default '{}'::jsonb,
  ai_summary_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_coin_analyses_symbol_timeframe_created
  on public.coin_analyses(symbol, timeframe, created_at desc);

create index if not exists idx_coin_analyses_expires_at
  on public.coin_analyses(expires_at);

create index if not exists idx_coin_analyses_risk_score
  on public.coin_analyses(((risk_json->>'pump_dump_risk_score')::numeric));

alter table public.coin_analyses enable row level security;

drop policy if exists "Authenticated users can read coin analyses" on public.coin_analyses;
create policy "Authenticated users can read coin analyses"
  on public.coin_analyses for select
  to authenticated
  using (true);

drop policy if exists "Service role can manage coin analyses" on public.coin_analyses;
create policy "Service role can manage coin analyses"
  on public.coin_analyses for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
