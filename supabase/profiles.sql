-- Usernames, city and profile pictures for Friends. Run once after social.sql:
-- Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to run again.
--
-- What's added:
--   social_profiles.username    a unique handle people can search for to add you as a friend.
--   social_profiles.city        the city you represent, shown to friends and people who find you.
--   social_profiles.avatar_url  your profile picture, stored in the public "avatars" bucket below.
--   find_by_username()          search people by username (only people who turned on Friends).
-- The friends functions from social.sql are replaced so they also return these fields.

alter table public.social_profiles add column if not exists username text;
alter table public.social_profiles add column if not exists city text not null default '';
alter table public.social_profiles add column if not exists avatar_url text not null default '';

alter table public.social_profiles drop constraint if exists social_profiles_username_rule;
alter table public.social_profiles add constraint social_profiles_username_rule
  check (username is null or (username ~ '^[a-z0-9_.]{3,20}$' and username !~ '^[._]|[._]$|\.\.'));
alter table public.social_profiles drop constraint if exists social_profiles_city_len;
alter table public.social_profiles add constraint social_profiles_city_len check (char_length(city) <= 60);
alter table public.social_profiles drop constraint if exists social_profiles_avatar_url;
alter table public.social_profiles add constraint social_profiles_avatar_url
  check (avatar_url = '' or (avatar_url ~ '^https://' and char_length(avatar_url) <= 300));
create unique index if not exists social_profiles_username_key on public.social_profiles (username);

-- Profile pictures: a public bucket (anyone with the link can see a picture), small JPEG/PNG/WebP files
-- only, and each person can add, replace or remove files only in their own folder (their user id).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Avatars: add own" on storage.objects;
create policy "Avatars: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Avatars: change own" on storage.objects;
create policy "Avatars: change own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Avatars: remove own" on storage.objects;
create policy "Avatars: remove own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Avatars: list own" on storage.objects;
create policy "Avatars: list own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Return types change, so the old versions go first.
drop function if exists public.find_by_phone(text[]);
drop function if exists public.my_friends();
drop function if exists public.friend_board();
drop function if exists public.find_by_username(text);

-- People with these phone hashes who have turned on Friends, and where you stand with each.
create function public.find_by_phone(hashes text[])
returns table (user_id uuid, name text, username text, city text, avatar_url text, phone_hash text, status text)
language plpgsql stable security definer set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first'; end if;
  if cardinality(hashes) > 2000 then raise exception 'Too many numbers at once'; end if;
  return query
    select p.user_id, p.name, p.username, p.city, p.avatar_url, p.phone_hash,
      case
        when f.status = 'accepted' then 'friends'
        when f.requester = me then 'sent'
        when f.requester is not null then 'received'
      end
    from social_profiles p
    left join friendships f on (f.requester = me and f.addressee = p.user_id) or (f.requester = p.user_id and f.addressee = me)
    where p.phone_hash = any (hashes) and p.user_id <> me;
end $$;

-- People whose username starts with what you typed (at least 2 characters), best matches first.
create function public.find_by_username(q text)
returns table (user_id uuid, name text, username text, city text, avatar_url text, status text)
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  term text := lower(regexp_replace(coalesce(q, ''), '^@', ''));
begin
  if me is null then raise exception 'Sign in first'; end if;
  if char_length(term) < 2 or term !~ '^[a-z0-9_.]+$' then return; end if;
  return query
    select p.user_id, p.name, p.username, p.city, p.avatar_url,
      case
        when f.status = 'accepted' then 'friends'
        when f.requester = me then 'sent'
        when f.requester is not null then 'received'
      end
    from social_profiles p
    left join friendships f on (f.requester = me and f.addressee = p.user_id) or (f.requester = p.user_id and f.addressee = me)
    where p.username like term || '%' and p.user_id <> me
    order by p.username = term desc, p.username
    limit 20;
end $$;

-- Your friends and requests: status is 'friends', 'sent' (waiting on them) or 'received'.
create function public.my_friends()
returns table (user_id uuid, name text, username text, city text, avatar_url text, status text)
language sql stable security definer set search_path = public
as $$
  select p.user_id, p.name, p.username, p.city, p.avatar_url,
    case when f.status = 'accepted' then 'friends' when f.requester = auth.uid() then 'sent' else 'received' end
  from friendships f
  join social_profiles p on p.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by p.name;
$$;

-- You and your friends, with each person's shared stats, for the leaderboard and profiles.
create function public.friend_board()
returns table (user_id uuid, name text, username text, city text, avatar_url text, stats jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.user_id, p.name, p.username, p.city, p.avatar_url, b.stats, b.updated_at
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
revoke all on function public.find_by_username(text) from public, anon;
revoke all on function public.my_friends() from public, anon;
revoke all on function public.friend_board() from public, anon;
grant execute on function public.find_by_phone(text[]) to authenticated;
grant execute on function public.find_by_username(text) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.friend_board() to authenticated;
