-- Custom migration: Supabase Auth `before_user_created` hook (Postgres function).
-- Fleet rule 2026-10-29: end users sign in with Google only.
--   allowed : anonymous device sessions, and users created through the Google provider
--   allowed : email users matching the automation identity aoneahsan.apps.t1+<n>@gmail.com
--             (test accounts created through the admin API; the password lives in ~/.secrets)
--   refused : every other email/password (or other provider) sign-up, with a 403
-- Linking Google onto an existing anonymous user is not a user creation, so it never
-- reaches this hook. Enabled by [auth.hook.before_user_created] in supabase/config.toml.

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user jsonb := event -> 'user';
  v_provider text := v_user -> 'app_metadata' ->> 'provider';
  v_providers jsonb := coalesce(v_user -> 'app_metadata' -> 'providers', '[]'::jsonb);
  v_email text := lower(coalesce(v_user ->> 'email', ''));
begin
  if coalesce((v_user ->> 'is_anonymous')::boolean, false) then
    return '{}'::jsonb;
  end if;
  if v_provider = 'google' or v_providers ? 'google' then
    return '{}'::jsonb;
  end if;
  if v_provider = 'email' and v_email ~ '^aoneahsan\.apps\.t1\+[a-z0-9._-]+@gmail\.com$' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'linux-cleanup accounts sign in with Google.'
  ));
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
