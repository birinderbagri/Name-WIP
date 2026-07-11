-- ============================================================
-- Security fixes surfaced by Supabase's advisor after 0001-0003.
-- ============================================================

-- Fix: class_leaderboard was running as SECURITY DEFINER (the default for
-- views), bypassing RLS on profiles/class_members so any signed-in user
-- could read every class's leaderboard. security_invoker makes it run with
-- the querying user's own permissions, so its RLS policies apply again.
alter view class_leaderboard set (security_invoker = true);

-- Harden set_updated_at against search_path hijacking.
create or replace function set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user is a SECURITY DEFINER trigger function meant to run only
-- via the on_auth_user_created trigger. Revoking direct EXECUTE stops it
-- from being callable as a public RPC endpoint; the trigger itself is
-- unaffected since trigger firing doesn't require EXECUTE grants.
revoke execute on function handle_new_user() from public, anon, authenticated;
