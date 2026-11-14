-- Custom migration (drizzle-kit generate --custom). Drizzle cannot model functions,
-- grants or schemas. This file runs BEFORE the tables because the generated policies
-- call private.is_anon(), private.my_team_id() and private.has_feature().
-- Function bodies reference tables created by the next migration, hence:
set check_function_bodies = off;

create schema if not exists private;
revoke all on schema private from public;
-- Policies run as the caller's role, so the caller needs USAGE to resolve the helpers.
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

/** True when the caller has no user, or signed in anonymously (a device session). */
create or replace function private.is_anon()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is null
      or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

/** UTC month key 'YYYY-MM' of an instant: the allowance boundary. */
create or replace function private.month_key(p_at timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM');
$$;

/** The caller's team id, or null. DEFINER so policies avoid recursing into team_members. */
create or replace function private.my_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.team_id from public.team_members m where m.user_id = auth.uid();
$$;

/**
 * The plan a user is on right now, resolved ON READ (no cron can extend a paid plan):
 * the highest-rank plan among active paid periods, active grants and an active team seat.
 * Falls back to 'free'.
 */
create or replace function private.effective_plan_id(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.id
    from public.plans p
    where p.id in (
      select s.plan_id from public.subscriptions s
       where s.user_id = p_user and s.team_id is null and s.status = 'active'
         and now() >= s.period_start and now() < s.period_end
      union all
      select g.plan_id from public.plan_grants g
       where g.user_id = p_user and g.revoked_at is null
         and now() >= g.starts_at and now() < g.ends_at
      union all
      select s.plan_id from public.team_members m
        join public.subscriptions s on s.team_id = m.team_id
       where m.user_id = p_user and s.status = 'active'
         and now() >= s.period_start and now() < s.period_end
    )
    order by p.rank desc
    limit 1
  ), 'free');
$$;

/** Whether the CALLER's effective plan includes a feature. Anonymous sessions: never. */
create or replace function private.has_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_anon() then false else coalesce((
    select case p_feature
             when 'schedules' then p.schedules
             when 'history_sync' then p.history_sync
             when 'exports' then p.exports
             when 'fleet_reports' then p.fleet_reports
             else false
           end
    from public.plans p
    where p.id = private.effective_plan_id(auth.uid())
  ), false) end;
$$;

/** An integer admin field from app_config (null when the key is absent). */
create or replace function private.config_int(p_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (c.value #>> '{}')::integer from public.app_config c where c.key = p_key;
$$;

/** Whether a user holds a platform role (admin or superadmin). Server-side checks only. */
create or replace function private.is_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles r where r.user_id = p_user);
$$;

revoke execute on all functions in schema private from public, anon, authenticated, service_role;
-- Only the helpers a policy calls are executable by the caller roles.
grant execute on function private.is_anon() to anon, authenticated;
grant execute on function private.my_team_id() to authenticated;
grant execute on function private.has_feature(text) to authenticated;
