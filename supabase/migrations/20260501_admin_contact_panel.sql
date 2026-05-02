alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('user', 'admin')),
  add column if not exists display_name text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists satisfaction text check (satisfaction in ('happy', 'neutral', 'unhappy'));

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_last_seen_idx on public.profiles(last_seen_at desc);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  satisfaction text check (satisfaction in ('happy', 'neutral', 'unhappy')),
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can create contact messages" on public.contact_messages;
create policy "Anyone can create contact messages"
  on public.contact_messages for insert
  with check (true);

drop policy if exists "Users can read own contact messages" on public.contact_messages;
create policy "Users can read own contact messages"
  on public.contact_messages for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role can manage contact messages" on public.contact_messages;
create policy "Service role can manage contact messages"
  on public.contact_messages for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
