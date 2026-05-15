create table if not exists signals (
  id uuid default gen_random_uuid() primary key,
  symbol text not null,
  type text not null,
  price decimal not null,
  price_change decimal not null,
  volume decimal not null,
  volume_multiple decimal not null,
  time timestamptz not null default now(),
  ai_analysis jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_signals_symbol on signals(symbol);
create index if not exists idx_signals_time on signals(time);

-- Add RLS policies
alter table signals enable row level security;

create policy "Public read access"
  on signals for select
  using (true);

create policy "Service role insert access"
  on signals for insert
  with check (auth.role() = 'service_role');