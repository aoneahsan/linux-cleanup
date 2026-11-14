ALTER TABLE "devices" ADD COLUMN "handoff_code_hash" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "handoff_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_invites" ADD COLUMN "last_sent_at" timestamp with time zone;--> statement-breakpoint
-- Security-audit fixes 2026-10-30 (lane-security F-SEC-002, F-SEC-003, F-SEC-006).
set check_function_bodies = off;
--> statement-breakpoint
/**
 * F-SEC-002: a device row is bound to ONE user. Registering refreshes last_seen_at for its
 * owner and refuses anyone else with device_owned (42501). The anonymous -> Google link
 * (linkIdentity) keeps the same auth user id, so it passes. Every other move (signing in
 * to an existing Google account on this computer, signing out to a new anonymous session) is
 * proven with a one-time handoff code: public.device_handoff_begin/complete below.
 */
create or replace function private.register_device(p_user uuid, p_device uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.devices (id, user_id)
  values (p_device, p_user)
  on conflict (id) do update set last_seen_at = now()
   where public.devices.user_id = excluded.user_id;
  if not found then
    raise exception 'device_owned' using errcode = '42501';
  end if;
end;
$$;
--> statement-breakpoint
/**
 * The CURRENT owner of a device starts a handoff (before switching sessions on this computer).
 * Returns a one-time code valid for 15 minutes; only its sha256 is stored.
 */
create or replace function public.device_handoff_begin(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_code text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  update public.devices
     set handoff_code_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex'),
         handoff_expires_at = now() + interval '15 minutes'
   where id = p_device_id and user_id = v_user;
  if not found then
    raise exception 'device_owned' using errcode = '42501';
  end if;
  return jsonb_build_object('device_id', p_device_id, 'code', v_code, 'expires_in_seconds', 900);
end;
$$;
--> statement-breakpoint
/** The NEXT session on the same computer completes the handoff with the code; single use. */
create or replace function public.device_handoff_complete(p_device_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_from uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select d.user_id into v_from from public.devices d
   where d.id = p_device_id
     and d.handoff_code_hash = encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex')
     and d.handoff_expires_at > now()
   for update;
  if v_from is null then
    raise exception 'handoff_invalid' using errcode = '42501';
  end if;
  update public.devices
     set user_id = v_user, handoff_code_hash = null, handoff_expires_at = null, last_seen_at = now()
   where id = p_device_id;
  perform private.audit(v_user, 'device.handoff', 'device', p_device_id::text, v_from, '{}'::jsonb);
  return jsonb_build_object('device_id', p_device_id);
end;
$$;
--> statement-breakpoint
/**
 * F-SEC-003: creating a team needs a plan with fleet reports (a paid Team period, a team
 * seat or an admin/referral grant). A paid Team order already creates "My team" for its
 * owner, so `create` on a team the caller owns renames it instead of failing.
 */
create or replace function public.team_create(p_actor uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_seats smallint := coalesce((select p.min_seats from public.plans p where p.id = 'team'), 3);
begin
  if not coalesce((select p.fleet_reports from public.plans p where p.id = private.effective_plan_id(p_actor)), false) then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  select t.* into v_team from public.teams t where t.owner_id = p_actor for update;
  if v_team.id is not null then
    update public.teams set name = trim(p_name) where id = v_team.id returning * into v_team;
    return jsonb_build_object('team_id', v_team.id, 'name', v_team.name, 'seats', v_team.seats);
  end if;
  if exists (select 1 from public.team_members m where m.user_id = p_actor) then
    raise exception 'already_in_team' using errcode = '23505';
  end if;
  insert into public.teams (name, owner_id, seats) values (trim(p_name), p_actor, v_seats) returning * into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team.id, p_actor, 'owner');
  return jsonb_build_object('team_id', v_team.id, 'name', v_team.name, 'seats', v_team.seats);
end;
$$;
--> statement-breakpoint
/**
 * F-SEC-003: inviting needs the same plan, and the invite email is sent only for a new
 * invite or when the last send is older than 24 hours (`send_email` in the result).
 */
create or replace function public.team_invite(p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_email text := lower(trim(p_email));
  v_existing public.team_invites%rowtype;
  v_used integer;
  v_id uuid;
  v_send boolean;
begin
  select t.* into v_team from public.teams t where t.owner_id = p_actor for update;
  if v_team.id is null then
    raise exception 'not_team_owner' using errcode = '42501';
  end if;
  if not coalesce((select p.fleet_reports from public.plans p where p.id = private.effective_plan_id(p_actor)), false) then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  if exists (select 1 from public.team_members m join public.profiles p on p.id = m.user_id
              where m.team_id = v_team.id and p.email = v_email) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  select i.* into v_existing from public.team_invites i
   where i.team_id = v_team.id and i.email = v_email and i.accepted_at is null for update;

  if v_existing.id is null then
    select (select count(*) from public.team_members m where m.team_id = v_team.id)
         + (select count(*) from public.team_invites i
             where i.team_id = v_team.id and i.accepted_at is null and i.expires_at > now())
      into v_used;
    if v_used >= v_team.seats then
      raise exception 'no_seats' using errcode = '23514';
    end if;
    insert into public.team_invites (team_id, email, invited_by, last_sent_at)
    values (v_team.id, v_email, p_actor, now())
    returning id into v_id;
    v_send := true;
  else
    v_send := v_existing.last_sent_at is null or v_existing.last_sent_at < now() - interval '24 hours';
    update public.team_invites
       set expires_at = now() + interval '14 days', invited_by = p_actor,
           last_sent_at = case when v_send then now() else last_sent_at end
     where id = v_existing.id;
    v_id := v_existing.id;
  end if;

  return jsonb_build_object('invite_id', v_id, 'team_name', v_team.name, 'send_email', v_send,
    'invited_by', (select p.email from public.profiles p where p.id = p_actor), 'email', v_email);
end;
$$;
--> statement-breakpoint
/**
 * F-SEC-006: everything the server holds about the CALLER, as one JSON object, for
 * "Download my data". Own rows only (auth.uid()); long lists capped at the newest 500.
 * Grant provenance names the source, never an administrator's address.
 */
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select jsonb_build_object('id', p.id, 'email', p.email, 'display_name', p.display_name,
                  'referral_code', p.referral_code, 'limits_override', p.limits_override, 'created_at', p.created_at)
                  from public.profiles p where p.id = v_user),
    'platform_role', (select r.role from public.user_roles r where r.user_id = v_user),
    'plan_id', private.effective_plan_id(v_user),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name,
                  'os_version', d.os_version, 'created_at', d.created_at, 'last_seen_at', d.last_seen_at)
                  order by d.last_seen_at desc), '[]'::jsonb) from public.devices d where d.user_id = v_user),
    'subscriptions', (select coalesce(jsonb_agg(jsonb_build_object('plan_id', s.plan_id, 'interval', s.interval,
                  'seats', s.seats, 'status', s.status, 'period_start', s.period_start, 'period_end', s.period_end,
                  'amount_cents', s.amount_cents, 'currency', s.currency, 'polar_order_id', s.polar_order_id,
                  'ended_at', s.ended_at, 'created_at', s.created_at) order by s.period_start desc), '[]'::jsonb)
                  from public.subscriptions s where s.user_id = v_user),
    'plan_grants', (select coalesce(jsonb_agg(jsonb_build_object('plan_id', g.plan_id, 'source', g.source,
                  'granted_by', case g.source when 'admin' then 'linux-cleanup team' else 'referral programme' end,
                  'reason', g.reason, 'starts_at', g.starts_at, 'ends_at', g.ends_at, 'revoked_at', g.revoked_at,
                  'created_at', g.created_at) order by g.created_at desc), '[]'::jsonb)
                  from public.plan_grants g where g.user_id = v_user),
    'user_settings', (select jsonb_build_object('shortcuts', u.shortcuts, 'appearance', u.appearance,
                  'legal_notice_seen_at', u.legal_notice_seen_at, 'updated_at', u.updated_at)
                  from public.user_settings u where u.user_id = v_user),
    'team', (select jsonb_build_object('team_id', t.id, 'name', t.name, 'role', m.role, 'seats', t.seats,
                  'joined_at', m.joined_at)
                  from public.team_members m join public.teams t on t.id = m.team_id where m.user_id = v_user),
    'schedules', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'kind', x.kind,
                  'section_ids', x.section_ids, 'cadence', x.cadence, 'enabled', x.enabled, 'device_id', x.device_id,
                  'updated_at', x.updated_at) order by x.created_at), '[]'::jsonb)
                  from public.schedules_meta x where x.user_id = v_user),
    'run_summaries', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb) from (
                  select s.id, s.device_id, s.claim_id, s.dry_run, s.os_version, s.disk_free_before_kb,
                         s.disk_free_after_kb, s.freed_kb, s.created_at,
                         (select coalesce(jsonb_agg(jsonb_build_object('id', c.section_id, 'status', c.status,
                            'freed_kb', c.freed_kb) order by c.section_id), '[]'::jsonb)
                            from public.run_summary_sections c where c.summary_id = s.id) as sections
                    from public.run_summaries s where s.user_id = v_user
                   order by s.created_at desc limit 500) r),
    'referrals', (select coalesce(jsonb_agg(jsonb_build_object('status', f.status, 'points_awarded', f.points_awarded,
                  'rewarded', f.reward_grant_id is not null, 'created_at', f.created_at, 'confirmed_at', f.confirmed_at)
                  order by f.created_at desc), '[]'::jsonb)
                  from public.referrals f where f.referrer_id = v_user),
    'run_claims', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb) from (
                  select x.id, x.device_id, x.month, x.pool, x.sections, x.created_at
                    from public.run_claims x where x.user_id = v_user
                   order by x.created_at desc limit 500) c)
  );
end;
$$;
--> statement-breakpoint
revoke execute on function private.register_device(uuid, uuid) from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function public.device_handoff_begin(uuid) from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function public.device_handoff_complete(uuid, text) from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function public.export_my_data() from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function public.team_create(uuid, text) from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function public.team_invite(uuid, text) from public, anon, authenticated, service_role;
--> statement-breakpoint
grant execute on function public.device_handoff_begin(uuid) to authenticated;
--> statement-breakpoint
grant execute on function public.device_handoff_complete(uuid, text) to authenticated;
--> statement-breakpoint
grant execute on function public.export_my_data() to authenticated;
--> statement-breakpoint
grant execute on function public.team_create(uuid, text) to service_role;
--> statement-breakpoint
grant execute on function public.team_invite(uuid, text) to service_role;
