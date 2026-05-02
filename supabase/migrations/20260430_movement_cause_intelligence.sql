alter table public.coin_analyses
  add column if not exists cause_json jsonb not null default '{}'::jsonb,
  add column if not exists market_microstructure_json jsonb not null default '{}'::jsonb,
  add column if not exists news_json jsonb not null default '{}'::jsonb,
  add column if not exists confidence_json jsonb not null default '{}'::jsonb;

create index if not exists coin_analyses_cause_created_idx
  on public.coin_analyses using gin (cause_json);
