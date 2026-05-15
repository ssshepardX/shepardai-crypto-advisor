create table if not exists public.sentiment_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  source_json jsonb not null default '{}'::jsonb,
  score_json jsonb not null default '{}'::jsonb,
  trend_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sentiment_snapshots_symbol_expires_idx
  on public.sentiment_snapshots(symbol, expires_at desc);

create index if not exists sentiment_snapshots_created_idx
  on public.sentiment_snapshots(created_at desc);

create table if not exists public.sentiment_sources (
  provider text primary key,
  status text not null default 'unknown',
  last_error text,
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.sentiment_snapshots enable row level security;
alter table public.sentiment_sources enable row level security;

drop policy if exists "Authenticated users can read sentiment snapshots" on public.sentiment_snapshots;
create policy "Authenticated users can read sentiment snapshots"
  on public.sentiment_snapshots for select
  to authenticated
  using (true);

drop policy if exists "Service role can manage sentiment snapshots" on public.sentiment_snapshots;
create policy "Service role can manage sentiment snapshots"
  on public.sentiment_snapshots for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read sentiment sources" on public.sentiment_sources;
create policy "Authenticated users can read sentiment sources"
  on public.sentiment_sources for select
  to authenticated
  using (true);

drop policy if exists "Service role can manage sentiment sources" on public.sentiment_sources;
create policy "Service role can manage sentiment sources"
  on public.sentiment_sources for all
  to service_role
  using (true)
  with check (true);
