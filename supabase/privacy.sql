-- Run this once in your Supabase project: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Lets a signed-in person delete their own account from inside the app ("Delete account and data" on the You tab).
--
-- Deleting the row in auth.users cascades to everything tied to it: their tracker data (schema.sql), and their
-- friends profile, friendships and shared leaderboard stats (social.sql). Safe to run again.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
