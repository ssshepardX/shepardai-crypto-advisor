alter table public.coin_analyses
  add column if not exists continuation_json jsonb not null default '{}'::jsonb;

create table if not exists public.market_overview_snapshots (
  id uuid primary key default gen_random_uuid(),
  panel_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists market_overview_snapshots_panel_expires_idx
  on public.market_overview_snapshots(panel_type, expires_at desc);

create index if not exists market_overview_snapshots_created_idx
  on public.market_overview_snapshots(created_at desc);

alter table public.market_overview_snapshots enable row level security;

drop policy if exists "Authenticated users can read market overview snapshots" on public.market_overview_snapshots;
create policy "Authenticated users can read market overview snapshots"
  on public.market_overview_snapshots for select
  to authenticated
  using (true);

drop policy if exists "Service role can manage market overview snapshots" on public.market_overview_snapshots;
create policy "Service role can manage market overview snapshots"
  on public.market_overview_snapshots for all
  to service_role
  using (true)
  with check (true);
