-- Friends and leaderboards. Run this once in your Supabase project after schema.sql (and profiles.sql
-- after it; if you run this file again, run profiles.sql again too):
-- Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to run again.
--
-- What's stored:
--   social_profiles  one row per person who turned on Friends: the name they show and a one-way hash
--                    of their phone number (never the number).
--   friendships      friend requests and friends.
--   board_stats      a small summary of each person's cardio (totals and bests), for the leaderboard.
-- Each person can read and change only their own rows. Everything that involves someone else goes
-- through the functions below, which check who's asking: you see others' names only when they're your
-- friend, have a request with you, or match a phone number you looked up; you see others' stats only
-- when you're friends.

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  phone_hash text unique check (phone_hash is null or phone_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.friendships (
  requester uuid not null references public.social_profiles (user_id) on delete cascade,
  addressee uuid not null references public.social_profiles (user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friendships_addressee on public.friendships (addressee);

create table if not exists public.board_stats (
  user_id uuid primary key references public.social_profiles (user_id) on delete cascade,
  stats jsonb not null check (pg_column_size(stats) < 8000),
  updated_at timestamptz not null default now()
);

alter table public.social_profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.board_stats enable row level security;

drop policy if exists "Own profile: read" on public.social_profiles;
create policy "Own profile: read" on public.social_profiles for select using (auth.uid() = user_id);
drop policy if exists "Own profile: add" on public.social_profiles;
create policy "Own profile: add" on public.social_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Own profile: change" on public.social_profiles;
create policy "Own profile: change" on public.social_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Own profile: remove" on public.social_profiles;
create policy "Own profile: remove" on public.social_profiles for delete using (auth.uid() = user_id);

drop policy if exists "Own friendships: read" on public.friendships;
create policy "Own friendships: read" on public.friendships for select using (auth.uid() in (requester, addressee));

drop policy if exists "Own stats: read" on public.board_stats;
create policy "Own stats: read" on public.board_stats for select using (auth.uid() = user_id);
drop policy if exists "Own stats: add" on public.board_stats;
create policy "Own stats: add" on public.board_stats for insert with check (auth.uid() = user_id);
drop policy if exists "Own stats: change" on public.board_stats;
create policy "Own stats: change" on public.board_stats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- People with these phone hashes who have turned on Friends, and where you stand with each.
drop function if exists public.find_by_phone(text[]);
create function public.find_by_phone(hashes text[])
returns table (user_id uuid, name text, phone_hash text, status text)
language plpgsql stable security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if cardinality(hashes) > 2000 then raise exception 'Too many numbers at once'; end if;
  return query
    select p.user_id, p.name, p.phone_hash,
      case
        when f.status = 'accepted' then 'friends'
        when f.requester = me then 'sent'
        when f.requester is not null then 'received'
      end
    from social_profiles p
    left join friendships f on (f.requester = me and f.addressee = p.user_id) or (f.requester = p.user_id and f.addressee = me)
    where p.phone_hash = any (hashes) and p.user_id <> me;
end $$;

-- Your friends and requests, with names: status is 'friends', 'sent' (waiting on them) or 'received'.
drop function if exists public.my_friends();
create function public.my_friends()
returns table (user_id uuid, name text, status text)
language sql stable security definer set search_path = public
as $$
  select p.user_id, p.name,
    case when f.status = 'accepted' then 'friends' when f.requester = auth.uid() then 'sent' else 'received' end
  from friendships f
  join social_profiles p on p.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by p.name;
$$;

-- Ask someone to be friends. If they already asked you, this accepts.
create or replace function public.add_friend(other uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if other = me then raise exception 'That''s you'; end if;
  if not exists (select 1 from social_profiles where user_id = me) then raise exception 'Turn on Friends first'; end if;
  if not exists (select 1 from social_profiles where user_id = other) then raise exception 'No one found'; end if;
  update friendships set status = 'accepted' where requester = other and addressee = me;
  if found then return 'friends'; end if;
  insert into friendships (requester, addressee) values (me, other) on conflict do nothing;
  return (select case when status = 'accepted' then 'friends' else 'sent' end from friendships where requester = me and addressee = other);
end $$;

-- Accept a request someone sent you.
create or replace function public.accept_friend(other uuid)
returns void
language sql security definer set search_path = public
as $$
  update friendships set status = 'accepted' where requester = other and addressee = auth.uid();
$$;

-- Unfriend, cancel a request you sent, or decline one you got.
create or replace function public.remove_friend(other uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from friendships
  where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid());
$$;

-- You and your friends, with each person's shared stats, for the leaderboard.
drop function if exists public.friend_board();
create function public.friend_board()
returns table (user_id uuid, name text, stats jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.user_id, p.name, b.stats, b.updated_at
  from social_profiles p
  left join board_stats b on b.user_id = p.user_id
  where p.user_id = auth.uid()
     or exists (
       select 1 from friendships f
       where f.status = 'accepted'
         and ((f.requester = auth.uid() and f.addressee = p.user_id) or (f.addressee = auth.uid() and f.requester = p.user_id))
     );
$$;

revoke all on function public.find_by_phone(text[]) from public, anon;
revoke all on function public.my_friends() from public, anon;
revoke all on function public.add_friend(uuid) from public, anon;
revoke all on function public.accept_friend(uuid) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.friend_board() from public, anon;
grant execute on function public.find_by_phone(text[]) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.add_friend(uuid) to authenticated;
grant execute on function public.accept_friend(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.friend_board() to authenticated;
