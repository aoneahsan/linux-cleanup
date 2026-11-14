-- Custom migration: referral confirmation (fired by the verified-email signal), the
-- auth.users triggers, and Team operations (service role, called by the `team` and
-- `account-welcome` Edge Functions with the authenticated caller as p_actor).
set check_function_bodies = off;

/**
 * Confirm a pending referral once the invitee's account exists, is not anonymous and has
 * a verified email. Awards points; every `threshold` confirmations grant one month of Pro,
 * at most `cap` per rolling year, starting after the referrer's current paid/granted time.
 * Every number is an admin field; `referral_enabled` is the off switch.
 */
create or replace function private.try_confirm_referral(p_invitee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref public.referrals%rowtype;
  v_points integer := coalesce(private.config_int('referral_points_per_confirmed'), 0);
  v_threshold integer := coalesce(private.config_int('referral_pro_month_threshold'), 0);
  v_cap integer := coalesce(private.config_int('referral_pro_months_cap_per_year'), 0);
  v_confirmed integer;
  v_recent integer;
  v_start timestamptz;
  v_grant uuid;
begin
  if not coalesce((select (c.value #>> '{}')::boolean from public.app_config c where c.key = 'referral_enabled'), false) then
    return;
  end if;
  select * into v_ref from public.referrals r where r.invitee_id = p_invitee and r.status = 'pending' for update;
  if v_ref.id is null or not exists (
    select 1 from auth.users u
     where u.id = p_invitee and u.email_confirmed_at is not null and coalesce(u.is_anonymous, false) = false
  ) then
    return;
  end if;

  update public.referrals set status = 'confirmed', confirmed_at = now(), points_awarded = v_points
   where id = v_ref.id;

  select count(*) into v_confirmed from public.referrals r
   where r.referrer_id = v_ref.referrer_id and r.status = 'confirmed';
  select count(*) into v_recent from public.plan_grants g
   where g.user_id = v_ref.referrer_id and g.source = 'referral' and g.created_at > now() - interval '1 year';

  if v_threshold > 0 and v_confirmed % v_threshold = 0 and v_recent < v_cap
     and exists (select 1 from public.plans p where p.id = 'pro') then
    -- Bank the month after any current time on Pro or a higher plan: extend, never overwrite.
    select greatest(now(), coalesce(max(x.ends), now())) into v_start from (
      select s.period_end as ends from public.subscriptions s join public.plans p on p.id = s.plan_id
       where s.user_id = v_ref.referrer_id and s.status = 'active' and s.period_end > now()
         and p.rank >= (select rank from public.plans where id = 'pro')
      union all
      select g.ends_at from public.plan_grants g join public.plans p on p.id = g.plan_id
       where g.user_id = v_ref.referrer_id and g.revoked_at is null and g.ends_at > now()
         and p.rank >= (select rank from public.plans where id = 'pro')
    ) x;
    insert into public.plan_grants (user_id, plan_id, source, reason, starts_at, ends_at)
    values (v_ref.referrer_id, 'pro', 'referral',
            format('Referral reward: %s confirmed friends', v_confirmed), v_start, v_start + interval '1 month')
    returning id into v_grant;
    update public.referrals set reward_grant_id = v_grant where id = v_ref.id;
    perform private.audit(null, 'grant.create', 'plan_grant', v_grant::text, v_ref.referrer_id,
      jsonb_build_object('plan', 'pro', 'source', 'referral', 'starts_at', v_start));
  end if;
end;
$$;

-- Now that every function the auth triggers call exists, attach them.
drop trigger if exists linux_cleanup_on_auth_user_insert on auth.users;
create trigger linux_cleanup_on_auth_user_insert
  after insert on auth.users
  for each row execute function private.handle_auth_user_insert();

drop trigger if exists linux_cleanup_on_auth_user_update on auth.users;
create trigger linux_cleanup_on_auth_user_update
  after update of email, email_confirmed_at, is_anonymous on auth.users
  for each row execute function private.handle_auth_user_update();

/**
 * Record who invited this account (once, within 30 days of the account's creation, never
 * yourself), then try to confirm it. Recording is not confirming: the verified-email
 * signal decides, inside try_confirm_referral.
 */
create or replace function public.referral_claim(p_invitee uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer uuid;
begin
  select p.id into v_referrer from public.profiles p where p.referral_code = upper(trim(p_code));
  if v_referrer is null or v_referrer = p_invitee then
    return jsonb_build_object('result', 'invalid_code');
  end if;
  if exists (select 1 from public.referrals r where r.invitee_id = p_invitee) then
    return jsonb_build_object('result', 'already_recorded');
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_invitee and p.created_at > now() - interval '30 days') then
    return jsonb_build_object('result', 'too_late');
  end if;
  insert into public.referrals (referrer_id, invitee_id) values (v_referrer, p_invitee);
  perform private.try_confirm_referral(p_invitee);
  return jsonb_build_object('result', (select r.status from public.referrals r where r.invitee_id = p_invitee));
end;
$$;

create or replace function public.team_create(p_actor uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_seats smallint := coalesce((select p.min_seats from public.plans p where p.id = 'team'), 3);
begin
  if exists (select 1 from public.team_members m where m.user_id = p_actor) then
    raise exception 'already_in_team' using errcode = '23505';
  end if;
  insert into public.teams (name, owner_id, seats) values (trim(p_name), p_actor, v_seats) returning id into v_team;
  insert into public.team_members (team_id, user_id, role) values (v_team, p_actor, 'owner');
  return jsonb_build_object('team_id', v_team, 'name', trim(p_name), 'seats', v_seats);
end;
$$;

create or replace function public.team_invite(p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_email text := lower(trim(p_email));
  v_used integer;
  v_id uuid;
begin
  select t.* into v_team from public.teams t where t.owner_id = p_actor for update;
  if v_team.id is null then
    raise exception 'not_team_owner' using errcode = '42501';
  end if;
  if exists (select 1 from public.team_members m join public.profiles p on p.id = m.user_id
              where m.team_id = v_team.id and p.email = v_email) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  select (select count(*) from public.team_members m where m.team_id = v_team.id)
       + (select count(*) from public.team_invites i
           where i.team_id = v_team.id and i.accepted_at is null and i.expires_at > now())
    into v_used;
  if v_used >= v_team.seats then
    raise exception 'no_seats' using errcode = '23514';
  end if;
  insert into public.team_invites (team_id, email, invited_by) values (v_team.id, v_email, p_actor)
  on conflict (team_id, email) where accepted_at is null
  do update set expires_at = now() + interval '14 days', invited_by = excluded.invited_by
  returning id into v_id;
  return jsonb_build_object('invite_id', v_id, 'team_name', v_team.name,
    'invited_by', (select p.email from public.profiles p where p.id = p_actor), 'email', v_email);
end;
$$;

create or replace function public.team_accept(p_actor uuid, p_invite uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.team_invites%rowtype;
  v_seats smallint;
begin
  select i.* into v_inv from public.team_invites i
   where i.id = p_invite and i.accepted_at is null and i.expires_at > now() for update;
  if v_inv.id is null then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                  where p.id = p_actor and p.email = v_inv.email and u.email_confirmed_at is not null) then
    raise exception 'invite_email_mismatch' using errcode = '42501';
  end if;
  if exists (select 1 from public.team_members m where m.user_id = p_actor) then
    raise exception 'already_in_team' using errcode = '23505';
  end if;
  select t.seats into v_seats from public.teams t where t.id = v_inv.team_id for update;
  if (select count(*) from public.team_members m where m.team_id = v_inv.team_id) >= v_seats then
    raise exception 'no_seats' using errcode = '23514';
  end if;
  insert into public.team_members (team_id, user_id, role) values (v_inv.team_id, p_actor, 'member');
  update public.team_invites set accepted_at = now(), accepted_by = p_actor where id = v_inv.id;
  return jsonb_build_object('team_id', v_inv.team_id);
end;
$$;

/** Owner removes a member or an open invite; a member may remove only themself (leave). */
create or replace function public.team_remove(p_actor uuid, p_user uuid, p_invite uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid := (select t.id from public.teams t where t.owner_id = p_actor);
  v_n integer;
begin
  if p_invite is not null then
    delete from public.team_invites i where i.id = p_invite and i.team_id = v_team and i.accepted_at is null;
  elsif p_user = p_actor then
    if v_team is not null then
      raise exception 'owner_cannot_leave' using errcode = '42501';
    end if;
    delete from public.team_members m where m.user_id = p_actor;
  else
    delete from public.team_members m where m.user_id = p_user and m.team_id = v_team and m.role = 'member';
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('removed', v_n);
end;
$$;

/**
 * The fleet report, aggregated in the database: per member machines, last synced run, runs
 * and freed space over 30 days; plus totals. Requires the caller's plan to include it.
 */
create or replace function public.team_fleet(p_actor uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_since timestamptz := now() - interval '30 days';
begin
  select t.* into v_team from public.teams t join public.team_members m on m.team_id = t.id where m.user_id = p_actor;
  if v_team.id is null then
    raise exception 'not_in_team' using errcode = '42501';
  end if;
  if not coalesce((select p.fleet_reports from public.plans p where p.id = private.effective_plan_id(p_actor)), false) then
    raise exception 'plan_required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'team', jsonb_build_object('id', v_team.id, 'name', v_team.name, 'seats', v_team.seats),
    'members', (select coalesce(jsonb_agg(to_jsonb(x) order by x.role, x.email), '[]'::jsonb) from (
      select m.user_id, p.email, m.role, 'active' as status,
             (select count(*) from public.devices d where d.user_id = m.user_id) as machines,
             (select max(s.created_at) from public.run_summaries s where s.user_id = m.user_id) as last_run_at,
             (select count(*) from public.run_summaries s where s.user_id = m.user_id and not s.dry_run and s.created_at > v_since) as runs_30d,
             (select coalesce(sum(s.freed_kb), 0) from public.run_summaries s where s.user_id = m.user_id and s.created_at > v_since) as freed_kb_30d
        from public.team_members m join public.profiles p on p.id = m.user_id
       where m.team_id = v_team.id limit 200) x),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'email', i.email, 'status', 'invited',
                  'created_at', i.created_at) order by i.created_at), '[]'::jsonb)
                  from public.team_invites i where i.team_id = v_team.id and i.accepted_at is null and i.expires_at > now()),
    'totals', (select jsonb_build_object(
        'machines', (select count(*) from public.devices d join public.team_members m on m.user_id = d.user_id where m.team_id = v_team.id),
        'runs_30d', count(*) filter (where not s.dry_run),
        'freed_kb_30d', coalesce(sum(s.freed_kb), 0),
        'quiet_machines', (select count(*) from public.devices d join public.team_members m on m.user_id = d.user_id
                        where m.team_id = v_team.id and not exists (
                          select 1 from public.run_summaries s2 where s2.device_id = d.id and s2.created_at > now() - interval '14 days')))
      from public.run_summaries s join public.team_members m on m.user_id = s.user_id
     where m.team_id = v_team.id and s.created_at > v_since)
  );
end;
$$;

revoke execute on function public.referral_claim(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.team_create(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.team_invite(uuid, text) from public, anon, authenticated, service_role;
revoke execute on function public.team_accept(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.team_remove(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.team_fleet(uuid) from public, anon, authenticated, service_role;
grant execute on function public.referral_claim(uuid, text) to service_role;
grant execute on function public.team_create(uuid, text) to service_role;
grant execute on function public.team_invite(uuid, text) to service_role;
grant execute on function public.team_accept(uuid, uuid) to service_role;
grant execute on function public.team_remove(uuid, uuid, uuid) to service_role;
grant execute on function public.team_fleet(uuid) to service_role;
revoke execute on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.is_anon() to anon, authenticated;
grant execute on function private.my_team_id() to authenticated;
grant execute on function private.has_feature(text) to authenticated;
