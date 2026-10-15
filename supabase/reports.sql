-- Emailed summaries (Progress -> Export -> Email me a summary). Run once in your Supabase project:
-- Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to run again.
-- Then deploy the email function and schedule it: see supabase/functions/send-reports/README.md.

create table if not exists public.report_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Which summaries to send: any of 'day', 'week', 'month', 'year'.
  periods text[] not null default '{}' check (periods <@ array['day', 'week', 'month', 'year']),
  -- The person's time zone (like 'America/Chicago') and the local hour to send at.
  tz text not null default 'UTC' check (length(tz) between 1 and 64),
  hour smallint not null default 7 check (hour between 0 and 23),
  -- First day of the last summary sent for each period, so each is sent once: {"week": "2026-10-05"}.
  last_sent jsonb not null default '{}'::jsonb,
  -- Last "Send one now", to keep test sends to one a minute.
  last_test timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.report_subscriptions enable row level security;

drop policy if exists "own subscription: read" on public.report_subscriptions;
create policy "own subscription: read" on public.report_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "own subscription: add" on public.report_subscriptions;
create policy "own subscription: add" on public.report_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "own subscription: change" on public.report_subscriptions;
create policy "own subscription: change" on public.report_subscriptions
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own subscription: remove" on public.report_subscriptions;
create policy "own subscription: remove" on public.report_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- The app only changes which summaries, the time zone and the hour. The send bookkeeping is the
-- email function's (it uses the service role, which bypasses these grants).
revoke all on public.report_subscriptions from anon, authenticated;
grant select, delete on public.report_subscriptions to authenticated;
grant insert (user_id, periods, tz, hour, updated_at) on public.report_subscriptions to authenticated;
grant update (user_id, periods, tz, hour, updated_at) on public.report_subscriptions to authenticated;
