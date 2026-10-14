-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- One row per person holding all their tracker data. Row Level Security means each signed-in
-- person can only read and write their own row.

create table if not exists public.tracker_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at bigint not null
);

alter table public.tracker_data enable row level security;

drop policy if exists "Read own data" on public.tracker_data;
create policy "Read own data" on public.tracker_data
  for select using (auth.uid() = user_id);

drop policy if exists "Insert own data" on public.tracker_data;
create policy "Insert own data" on public.tracker_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own data" on public.tracker_data;
create policy "Update own data" on public.tracker_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Delete own data" on public.tracker_data;
create policy "Delete own data" on public.tracker_data
  for delete using (auth.uid() = user_id);
