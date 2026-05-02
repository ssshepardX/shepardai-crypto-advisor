create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'trader')),
  interval text not null default 'monthly' check (interval in ('monthly', 'quarterly', 'yearly')),
  status text not null default 'active',
  active boolean not null default true,
  creem_customer_id text,
  creem_subscription_id text,
  creem_product_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_subscriptions_one_active_per_user
  on public.user_subscriptions (user_id)
  where active = true;

create index if not exists user_subscriptions_creem_subscription_idx
  on public.user_subscriptions (creem_subscription_id);

create table if not exists public.user_usage_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  ai_analysis_count integer not null default 0,
  scanner_run_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);

create table if not exists public.creem_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;
alter table public.user_usage_daily enable row level security;
alter table public.creem_events enable row level security;

drop policy if exists "Users can read own subscriptions" on public.user_subscriptions;
create policy "Users can read own subscriptions"
  on public.user_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage subscriptions" on public.user_subscriptions;
create policy "Service role can manage subscriptions"
  on public.user_subscriptions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Users can read own usage" on public.user_usage_daily;
create policy "Users can read own usage"
  on public.user_usage_daily for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage usage" on public.user_usage_daily;
create policy "Service role can manage usage"
  on public.user_usage_daily for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can manage creem events" on public.creem_events;
create policy "Service role can manage creem events"
  on public.creem_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.ensure_free_subscription(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_subscriptions (user_id, plan, interval, status, active)
  values (target_user_id, 'free', 'monthly', 'active', true)
  on conflict do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  perform public.ensure_free_subscription(new.id);
  return new;
end;
$$;

insert into public.user_subscriptions (user_id, plan, interval, status, active)
select id, 'free', 'monthly', 'active', true
from auth.users
where not exists (
  select 1 from public.user_subscriptions s
  where s.user_id = auth.users.id and s.active = true
);
