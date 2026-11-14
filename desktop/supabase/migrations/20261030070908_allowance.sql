-- Custom migration: the run allowance. Previews never claim; only real runs call
-- public.claim_run(). The SQL here is the ENFORCING copy of the pool order; the Edge
-- Function's _shared/allowance.ts mirrors it to cross-check and format, and its
-- Vitest file pins the same order (plan unlimited -> device pool -> account pool).
set check_function_bodies = off;

/** Bind a device id to its current caller (an anonymous device that signs in moves with it). */
create or replace function private.register_device(p_user uuid, p_device uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.devices (id, user_id)
  values (p_device, p_user)
  on conflict (id) do update set user_id = excluded.user_id, last_seen_at = now();
$$;

/**
 * The allowance facts for one user on one device in the current UTC month.
 * Limits: a per-user admin override, else the plan row, else the app_config default.
 * The account pool exists only for signed-in (non-anonymous) callers.
 */
create or replace function private.allowance_facts(p_user uuid, p_device uuid, p_is_anon boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month text := private.month_key(now());
  v_plan public.plans%rowtype;
  v_override jsonb;
  v_unlimited boolean;
  v_device_limit integer;
  v_account_limit integer;
  v_device_used integer;
  v_account_used integer;
begin
  select * into v_plan from public.plans where id = private.effective_plan_id(p_user);
  select p.limits_override into v_override from public.profiles p where p.id = p_user;

  v_unlimited := coalesce((v_override ->> 'real_runs_unlimited')::boolean, v_plan.real_runs_unlimited, false);
  v_device_limit := greatest(0, coalesce((v_override ->> 'device_real_runs_per_month')::integer,
    v_plan.device_real_runs_per_month, private.config_int('device_real_runs_per_month'), 0));
  v_account_limit := greatest(0, coalesce((v_override ->> 'account_extra_real_runs_per_month')::integer,
    v_plan.account_extra_real_runs_per_month, private.config_int('account_extra_real_runs_per_month'), 0));

  select count(*) into v_device_used from public.run_claims c
   where c.device_id = p_device and c.month = v_month and c.pool = 'device';
  select count(*) into v_account_used from public.run_claims c
   where c.user_id = p_user and c.month = v_month and c.pool = 'account';

  return jsonb_build_object(
    'month', v_month,
    'is_anonymous', p_is_anon,
    'plan', jsonb_build_object('id', coalesce(v_plan.id, 'free'), 'name', coalesce(v_plan.name, 'Free'), 'unlimited', v_unlimited),
    'device', jsonb_build_object('used', v_device_used, 'limit', v_device_limit),
    'account', case when p_is_anon then null
                    else jsonb_build_object('used', v_account_used, 'limit', v_account_limit) end
  );
end;
$$;

/** GET allowance: registers the device for the caller and returns the facts. */
create or replace function public.get_allowance(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_device_id is null then
    raise exception 'invalid_device' using errcode = '22023';
  end if;
  perform private.register_device(v_user, p_device_id);
  return private.allowance_facts(v_user, p_device_id, private.is_anon());
end;
$$;

/**
 * Claim one REAL run, atomically. Serialised per device and per user with transaction
 * advisory locks (always device first, then user), so two concurrent claims can never
 * both take the last run. Returns the pool used, or limit_reached.
 */
create or replace function public.claim_run(p_device_id uuid, p_sections smallint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_anon boolean := private.is_anon();
  v_before jsonb;
  v_pool public.run_pool;
  v_claim uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_device_id is null or p_sections is null
     or cardinality(p_sections) not between 1 and 64
     or exists (select 1 from unnest(p_sections) s where s is null or s not between 1 and 999) then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('linux_cleanup.claim.device:' || p_device_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('linux_cleanup.claim.user:' || v_user::text, 0));
  perform private.register_device(v_user, p_device_id);

  v_before := private.allowance_facts(v_user, p_device_id, v_anon);
  v_pool := case
    when (v_before -> 'plan' ->> 'unlimited')::boolean then 'plan'
    when (v_before -> 'device' ->> 'used')::integer < (v_before -> 'device' ->> 'limit')::integer then 'device'
    when not v_anon
      and (v_before -> 'account' ->> 'used')::integer < (v_before -> 'account' ->> 'limit')::integer then 'account'
    else null
  end;

  if v_pool is null then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached', 'before', v_before, 'allowance', v_before);
  end if;

  insert into public.run_claims (device_id, user_id, month, pool, sections)
  values (p_device_id, v_user, v_before ->> 'month', v_pool,
          (select array_agg(distinct s order by s) from unnest(p_sections) s))
  returning id into v_claim;

  return jsonb_build_object(
    'ok', true, 'claim_id', v_claim, 'pool', v_pool, 'before', v_before,
    'allowance', private.allowance_facts(v_user, p_device_id, v_anon)
  );
end;
$$;

/**
 * Store one run summary (numbers only, no path can be expressed) for a signed-in account
 * whose plan includes history sync. Summary + sections land in one transaction.
 * Payload keys: claim_id, dry_run, device_id, os_version, disk_free_before_kb,
 * disk_free_after_kb, sections[{id, status, freed_kb}].
 */
create or replace function public.record_run_summary(p_summary jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_device uuid := (p_summary ->> 'device_id')::uuid;
  v_claim uuid := nullif(p_summary ->> 'claim_id', '')::uuid;
  v_max smallint;
  v_id uuid;
begin
  if v_user is null or private.is_anon() then
    raise exception 'signed_in_required' using errcode = '42501';
  end if;
  if not private.has_feature('history_sync') then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  if v_claim is not null and not exists (
    select 1 from public.run_claims c where c.id = v_claim and c.user_id = v_user and c.device_id = v_device
  ) then
    raise exception 'invalid_claim' using errcode = '22023';
  end if;
  if v_claim is not null and exists (select 1 from public.run_summaries s where s.claim_id = v_claim) then
    raise exception 'duplicate_summary' using errcode = '23505';
  end if;

  select p.max_synced_machines into v_max from public.plans p where p.id = private.effective_plan_id(v_user);
  if (select count(distinct s.device_id) from public.run_summaries s
       where s.user_id = v_user and s.device_id <> v_device) >= coalesce(v_max, 0) then
    raise exception 'mac_limit' using errcode = '42501';
  end if;

  insert into public.run_summaries (user_id, device_id, claim_id, dry_run, os_version,
                                    disk_free_before_kb, disk_free_after_kb, freed_kb)
  values (v_user, v_device, v_claim, (p_summary ->> 'dry_run')::boolean, p_summary ->> 'os_version',
          (p_summary ->> 'disk_free_before_kb')::bigint, (p_summary ->> 'disk_free_after_kb')::bigint,
          coalesce((select sum((x ->> 'freed_kb')::bigint) from jsonb_array_elements(p_summary -> 'sections') x), 0))
  returning id into v_id;

  insert into public.run_summary_sections (summary_id, section_id, status, freed_kb)
  select v_id, (x ->> 'id')::smallint, (x ->> 'status')::public.section_status, (x ->> 'freed_kb')::bigint
    from jsonb_array_elements(p_summary -> 'sections') x;

  return v_id;
end;
$$;

revoke execute on function public.record_run_summary(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_run_summary(jsonb) to authenticated;
revoke execute on function public.get_allowance(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.claim_run(uuid, smallint[]) from public, anon, authenticated, service_role;
grant execute on function public.get_allowance(uuid) to authenticated;
grant execute on function public.claim_run(uuid, smallint[]) to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.is_anon() to anon, authenticated;
grant execute on function private.my_team_id() to authenticated;
grant execute on function private.has_feature(text) to authenticated;
