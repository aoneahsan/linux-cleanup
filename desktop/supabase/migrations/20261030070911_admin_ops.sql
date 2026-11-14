-- Custom migration: admin operations. Executable by service_role only, called by the
-- `admin` Edge Function after it has authenticated the caller. Each function RE-CHECKS
-- the actor's role and writes its audit row in the SAME transaction as the change.
-- Lists are keyset-paginated (default 20, max 50) and return { items, next_cursor }.
set check_function_bodies = off;

create or replace function private.assert_admin(p_actor uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not private.is_admin(p_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.page_size(p_limit integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select least(greatest(coalesce(p_limit, 20), 1), 50); $$;

create or replace function public.admin_stats(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month text := private.month_key(now());
begin
  perform private.assert_admin(p_actor);
  return jsonb_build_object(
    'accounts', (select count(*) from public.profiles p where p.email is not null),
    'devices', (select count(*) from public.devices),
    'paying_accounts', (select count(distinct s.user_id) from public.subscriptions s
                         where s.status = 'active' and now() >= s.period_start and now() < s.period_end),
    'active_grants', (select count(*) from public.plan_grants g
                       where g.revoked_at is null and now() >= g.starts_at and now() < g.ends_at),
    'real_runs_this_month', (select count(*) from public.run_claims c where c.month = v_month),
    'runs_by_pool', (select coalesce(jsonb_object_agg(x.pool, x.n), '{}'::jsonb) from (
                       select c.pool, count(*) as n from public.run_claims c
                        where c.month = v_month group by c.pool) x),
    'confirmed_referrals', (select count(*) from public.referrals r where r.status = 'confirmed'),
    'month', v_month
  );
end;
$$;

create or replace function public.admin_users_list(p_actor uuid, p_query text, p_cursor text, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.page_size(p_limit);
  v_at timestamptz := nullif(split_part(coalesce(p_cursor, ''), '|', 1), '')::timestamptz;
  v_id uuid := nullif(split_part(coalesce(p_cursor, ''), '|', 2), '')::uuid;
  v_q text := nullif(lower(trim(coalesce(p_query, ''))), '');
  v_items jsonb;
  v_count integer;
begin
  perform private.assert_admin(p_actor);
  with page as (
    select p.id, p.email, p.created_at
      from public.profiles p
     where p.email is not null
       and (v_q is null or strpos(p.email, v_q) > 0)
       and (v_at is null or (p.created_at, p.id) < (v_at, v_id))
     order by p.created_at desc, p.id desc
     limit v_limit + 1
  )
  select jsonb_agg(jsonb_build_object(
           'id', pg.id, 'email', pg.email, 'joined_at', pg.created_at,
           'plan_id', private.effective_plan_id(pg.id),
           'role', (select r.role from public.user_roles r where r.user_id = pg.id),
           'machines', (select count(*) from public.devices d where d.user_id = pg.id),
           'real_runs_this_month', (select count(*) from public.run_claims c
                                     where c.user_id = pg.id and c.month = private.month_key(now())),
           'verified', (select u.email_confirmed_at is not null from auth.users u where u.id = pg.id)
         ) order by pg.created_at desc, pg.id desc),
         count(*)
    into v_items, v_count
    from page pg;

  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(e order by n) from jsonb_array_elements(v_items) with ordinality t(e, n) where n <= v_limit), '[]'::jsonb),
    'next_cursor', case when v_count > v_limit then
      (v_items -> (v_limit - 1) ->> 'joined_at') || '|' || (v_items -> (v_limit - 1) ->> 'id') end
  );
end;
$$;

create or replace function public.admin_user_view(p_actor uuid, p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  perform private.assert_admin(p_actor);
  select * into v_profile from public.profiles where id = p_user;
  if v_profile.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'id', v_profile.id, 'email', v_profile.email, 'joined_at', v_profile.created_at,
    'plan_id', private.effective_plan_id(p_user),
    'role', (select r.role from public.user_roles r where r.user_id = p_user),
    'limits_override', v_profile.limits_override,
    'verified', (select u.email_confirmed_at is not null from auth.users u where u.id = p_user),
    'devices', (select coalesce(jsonb_agg(to_jsonb(d) order by d.last_seen_at desc), '[]'::jsonb) from (
                 select x.id, x.name, x.os_version, x.last_seen_at from public.devices x
                  where x.user_id = p_user order by x.last_seen_at desc limit 50) d),
    'subscriptions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.period_start desc), '[]'::jsonb) from (
                 select x.id, x.plan_id, x.interval, x.seats, x.status, x.period_start, x.period_end,
                        x.amount_cents, x.currency from public.subscriptions x
                  where x.user_id = p_user order by x.period_start desc limit 20) s),
    'grants', (select coalesce(jsonb_agg(to_jsonb(g) order by g.created_at desc), '[]'::jsonb) from (
                 select x.id, x.plan_id, x.source, x.reason, x.starts_at, x.ends_at, x.revoked_at,
                        (select p.email from public.profiles p where p.id = x.granted_by) as granted_by,
                        x.created_at from public.plan_grants x
                  where x.user_id = p_user order by x.created_at desc limit 20) g),
    'real_runs_this_month', (select coalesce(jsonb_object_agg(c.pool, c.n), '{}'::jsonb) from (
                 select x.pool, count(*) as n from public.run_claims x
                  where x.user_id = p_user and x.month = private.month_key(now()) group by x.pool) c),
    'confirmed_referrals', (select count(*) from public.referrals r
                             where r.referrer_id = p_user and r.status = 'confirmed')
  );
end;
$$;

/** Create a plan grant with provenance. Runs alongside paid time; never shortens it. */
create or replace function public.admin_grant_create(
  p_actor uuid, p_user uuid, p_plan text, p_starts timestamptz, p_ends timestamptz, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_admin(p_actor);
  if not exists (select 1 from public.profiles p where p.id = p_user and p.email is not null) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.plans p where p.id = p_plan) or p_plan = 'free' then
    raise exception 'invalid_plan' using errcode = '22023';
  end if;
  insert into public.plan_grants (user_id, plan_id, source, granted_by, reason, starts_at, ends_at)
  values (p_user, p_plan, 'admin', p_actor, p_reason, coalesce(p_starts, now()), p_ends)
  returning id into v_id;
  perform private.audit(p_actor, 'grant.create', 'plan_grant', v_id::text, p_user,
    jsonb_build_object('plan', p_plan, 'starts_at', coalesce(p_starts, now()), 'ends_at', p_ends, 'reason', p_reason));
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.admin_grant_revoke(p_actor uuid, p_grant uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant public.plan_grants%rowtype;
begin
  perform private.assert_admin(p_actor);
  update public.plan_grants set revoked_at = now(), revoked_by = p_actor
   where id = p_grant and revoked_at is null
  returning * into v_grant;
  if v_grant.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform private.audit(p_actor, 'grant.end', 'plan_grant', p_grant::text, v_grant.user_id,
    jsonb_build_object('plan', v_grant.plan_id, 'reason', p_reason));
  return jsonb_build_object('id', p_grant, 'revoked_at', v_grant.revoked_at);
end;
$$;

/** Change a user's plan: an admin grant, or (to Free) the end of every active admin grant. */
create or replace function public.admin_set_plan(
  p_actor uuid, p_user uuid, p_plan text, p_ends timestamptz, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ended integer;
begin
  perform private.assert_admin(p_actor);
  if p_plan <> 'free' then
    return public.admin_grant_create(p_actor, p_user, p_plan, now(), p_ends, p_reason);
  end if;
  update public.plan_grants set revoked_at = now(), revoked_by = p_actor
   where user_id = p_user and source = 'admin' and revoked_at is null and ends_at > now();
  get diagnostics v_ended = row_count;
  perform private.audit(p_actor, 'user.plan', 'profile', p_user::text, p_user,
    jsonb_build_object('plan', 'free', 'admin_grants_ended', v_ended, 'reason', p_reason));
  return jsonb_build_object('plan_id', private.effective_plan_id(p_user), 'admin_grants_ended', v_ended);
end;
$$;

/** Override one user's run limits. Allowed keys only; null clears the override. */
create or replace function public.admin_override_limits(p_actor uuid, p_user uuid, p_override jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform private.assert_admin(p_actor);
  if p_override is not null and (
       jsonb_typeof(p_override) <> 'object'
       or exists (select 1 from jsonb_object_keys(p_override) k
                   where k not in ('real_runs_unlimited', 'device_real_runs_per_month', 'account_extra_real_runs_per_month'))
       or coalesce((p_override ->> 'device_real_runs_per_month')::integer, 0) not between 0 and 100000
       or coalesce((p_override ->> 'account_extra_real_runs_per_month')::integer, 0) not between 0 and 100000) then
    raise exception 'invalid_override' using errcode = '22023';
  end if;
  select limits_override into v_before from public.profiles where id = p_user for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.profiles set limits_override = nullif(p_override, '{}'::jsonb) where id = p_user;
  perform private.audit(p_actor, 'user.limits', 'profile', p_user::text, p_user,
    jsonb_build_object('before', v_before, 'after', p_override, 'reason', p_reason));
  return jsonb_build_object('limits_override', nullif(p_override, '{}'::jsonb));
end;
$$;

create or replace function public.admin_plans_list(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  return jsonb_build_object('items', (select coalesce(jsonb_agg(to_jsonb(p) order by p.rank), '[]'::jsonb)
                                        from public.plans p), 'next_cursor', null);
end;
$$;

/**
 * Create a plan or edit its limits and prices. On update an ABSENT key keeps the stored
 * value and an explicit null clears a nullable limit. The free plan cannot be deactivated.
 */
create or replace function public.admin_plan_upsert(p_actor uuid, p_plan jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := p_plan ->> 'id';
  v_before public.plans%rowtype;
  v_after public.plans%rowtype;
begin
  perform private.assert_admin(p_actor);
  select * into v_before from public.plans where id = v_id for update;
  if v_before.id is null then
    insert into public.plans (id, name, description, rank, is_active, price_month_cents, price_year_cents,
      per_seat, min_seats, real_runs_unlimited, device_real_runs_per_month, account_extra_real_runs_per_month,
      max_synced_machines, history_sync, schedules, exports, fleet_reports)
    values (v_id, p_plan ->> 'name', coalesce(p_plan ->> 'description', ''), (p_plan ->> 'rank')::smallint,
      coalesce((p_plan ->> 'is_active')::boolean, true), coalesce((p_plan ->> 'price_month_cents')::integer, 0),
      coalesce((p_plan ->> 'price_year_cents')::integer, 0), coalesce((p_plan ->> 'per_seat')::boolean, false),
      coalesce((p_plan ->> 'min_seats')::smallint, 1), coalesce((p_plan ->> 'real_runs_unlimited')::boolean, false),
      (p_plan ->> 'device_real_runs_per_month')::integer, (p_plan ->> 'account_extra_real_runs_per_month')::integer,
      coalesce((p_plan ->> 'max_synced_machines')::smallint, 0), coalesce((p_plan ->> 'history_sync')::boolean, false),
      coalesce((p_plan ->> 'schedules')::boolean, false), coalesce((p_plan ->> 'exports')::boolean, false),
      coalesce((p_plan ->> 'fleet_reports')::boolean, false))
    returning * into v_after;
    perform private.audit(p_actor, 'plan.create', 'plan', v_id, null,
      jsonb_build_object('after', to_jsonb(v_after), 'reason', p_reason));
  else
    if v_id = 'free' and p_plan ? 'is_active' and not (p_plan ->> 'is_active')::boolean then
      raise exception 'free_plan_required' using errcode = '22023';
    end if;
    update public.plans set
      name = case when p_plan ? 'name' then p_plan ->> 'name' else name end,
      description = case when p_plan ? 'description' then coalesce(p_plan ->> 'description', '') else description end,
      rank = case when p_plan ? 'rank' then (p_plan ->> 'rank')::smallint else rank end,
      is_active = case when p_plan ? 'is_active' then (p_plan ->> 'is_active')::boolean else is_active end,
      price_month_cents = case when p_plan ? 'price_month_cents' then (p_plan ->> 'price_month_cents')::integer else price_month_cents end,
      price_year_cents = case when p_plan ? 'price_year_cents' then (p_plan ->> 'price_year_cents')::integer else price_year_cents end,
      per_seat = case when p_plan ? 'per_seat' then (p_plan ->> 'per_seat')::boolean else per_seat end,
      min_seats = case when p_plan ? 'min_seats' then (p_plan ->> 'min_seats')::smallint else min_seats end,
      real_runs_unlimited = case when p_plan ? 'real_runs_unlimited' then (p_plan ->> 'real_runs_unlimited')::boolean else real_runs_unlimited end,
      device_real_runs_per_month = case when p_plan ? 'device_real_runs_per_month' then (p_plan ->> 'device_real_runs_per_month')::integer else device_real_runs_per_month end,
      account_extra_real_runs_per_month = case when p_plan ? 'account_extra_real_runs_per_month' then (p_plan ->> 'account_extra_real_runs_per_month')::integer else account_extra_real_runs_per_month end,
      max_synced_machines = case when p_plan ? 'max_synced_machines' then (p_plan ->> 'max_synced_machines')::smallint else max_synced_machines end,
      history_sync = case when p_plan ? 'history_sync' then (p_plan ->> 'history_sync')::boolean else history_sync end,
      schedules = case when p_plan ? 'schedules' then (p_plan ->> 'schedules')::boolean else schedules end,
      exports = case when p_plan ? 'exports' then (p_plan ->> 'exports')::boolean else exports end,
      fleet_reports = case when p_plan ? 'fleet_reports' then (p_plan ->> 'fleet_reports')::boolean else fleet_reports end
    where id = v_id
    returning * into v_after;
    perform private.audit(p_actor, 'plan.update', 'plan', v_id, null,
      jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after), 'reason', p_reason));
  end if;
  return to_jsonb(v_after);
end;
$$;

/** Grants with their provenance: source, who granted, why, the window, revocation. */
create or replace function public.admin_grants_list(
  p_actor uuid, p_user uuid, p_active_only boolean, p_cursor text, p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.page_size(p_limit);
  v_at timestamptz := nullif(split_part(coalesce(p_cursor, ''), '|', 1), '')::timestamptz;
  v_id uuid := nullif(split_part(coalesce(p_cursor, ''), '|', 2), '')::uuid;
  v_rows jsonb;
begin
  perform private.assert_admin(p_actor);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc), '[]'::jsonb) into v_rows from (
    select g.id, g.user_id, (select p.email from public.profiles p where p.id = g.user_id) as user_email,
           g.plan_id, g.source, g.reason, g.starts_at, g.ends_at, g.revoked_at, g.created_at,
           coalesce((select p.email from public.profiles p where p.id = g.granted_by),
                    case when g.source = 'referral' then 'system' end) as granted_by
      from public.plan_grants g
     where (p_user is null or g.user_id = p_user)
       and (not coalesce(p_active_only, false) or (g.revoked_at is null and g.ends_at > now()))
       and (v_at is null or (g.created_at, g.id) < (v_at, v_id))
     order by g.created_at desc, g.id desc
     limit v_limit + 1) x;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(e order by n) from jsonb_array_elements(v_rows) with ordinality t(e, n) where n <= v_limit), '[]'::jsonb),
    'next_cursor', case when jsonb_array_length(v_rows) > v_limit then
      (v_rows -> (v_limit - 1) ->> 'created_at') || '|' || (v_rows -> (v_limit - 1) ->> 'id') end);
end;
$$;

create or replace function public.admin_config_get(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin(p_actor);
  return jsonb_build_object('items', (select coalesce(jsonb_agg(jsonb_build_object(
      'key', c.key, 'value', c.value, 'is_public', c.is_public, 'min_value', c.min_value,
      'max_value', c.max_value, 'description', c.description, 'updated_at', c.updated_at,
      'updated_by', (select p.email from public.profiles p where p.id = c.updated_by)) order by c.key), '[]'::jsonb)
    from public.app_config c), 'next_cursor', null);
end;
$$;

/** Set an existing admin field. The value keeps its JSON type; the row's CHECK holds the bounds. */
create or replace function public.admin_config_set(p_actor uuid, p_key text, p_value jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
begin
  perform private.assert_admin(p_actor);
  select c.value into v_before from public.app_config c where c.key = p_key for update;
  if v_before is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(v_before) <> jsonb_typeof(p_value) then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  begin
    update public.app_config set value = p_value, updated_by = p_actor where key = p_key;
  exception when check_violation then
    raise exception 'out_of_bounds' using errcode = '22023';
  end;
  perform private.audit(p_actor, 'config.update', 'app_config', p_key, null,
    jsonb_build_object('before', v_before, 'after', p_value, 'reason', p_reason));
  return jsonb_build_object('key', p_key, 'value', p_value);
end;
$$;

create or replace function public.admin_audit_list(p_actor uuid, p_action text, p_cursor bigint, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := private.page_size(p_limit);
  v_rows jsonb;
begin
  perform private.assert_admin(p_actor);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc), '[]'::jsonb) into v_rows from (
    select l.id, l.at, l.action, l.target_type, l.target_id, l.detail,
           coalesce((select a.label from public.audit_actors a where a.id = l.actor_ref), 'system') as actor,
           (select a.label from public.audit_actors a where a.id = l.target_ref) as target
      from public.audit_log l
     where (p_action is null or l.action = p_action)
       and (p_cursor is null or l.id < p_cursor)
     order by l.id desc
     limit v_limit + 1) x;
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(e order by n) from jsonb_array_elements(v_rows) with ordinality t(e, n) where n <= v_limit), '[]'::jsonb),
    'next_cursor', case when jsonb_array_length(v_rows) > v_limit then (v_rows -> (v_limit - 1) ->> 'id') end);
end;
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'admin\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.is_anon() to anon, authenticated;
grant execute on function private.my_team_id() to authenticated;
grant execute on function private.has_feature(text) to authenticated;
