-- Custom migration: triggers Drizzle cannot model.
--  * a profile for every auth user (anonymous devices included)
--  * the two seeded superadmins, matched by VERIFIED email, out of band (never client code)
--  * referral confirmation fired by the verified-email signal
--  * updated_at maintenance
--  * audit_log append-only enforcement (beats even the table owner)
set check_function_bodies = off;

/** Seeded platform staff. Both are superadmin; never asked, never only one. */
create or replace function private.seed_admin_role(p_user uuid, p_email text, p_confirmed timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_confirmed is not null
     and lower(coalesce(p_email, '')) in ('zaionsmanager@gmail.com', 'aoneahsan@gmail.com') then
    insert into public.user_roles (user_id, role)
    values (p_user, 'superadmin')
    on conflict (user_id) do update set role = 'superadmin';
  end if;
end;
$$;

/** auth.users AFTER INSERT: create the profile (and the role, for a seeded email). */
create or replace function private.handle_auth_user_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, referral_code)
  values (new.id, lower(new.email), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  on conflict (id) do nothing;
  perform private.seed_admin_role(new.id, new.email, new.email_confirmed_at);
  perform private.try_confirm_referral(new.id);
  return new;
end;
$$;

/**
 * auth.users AFTER UPDATE of identity columns: an anonymous device linking Google
 * (linkIdentity) arrives here with an email and a confirmed timestamp.
 */
create or replace function private.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email), updated_at = now()
   where id = new.id and email is distinct from lower(new.email);
  perform private.seed_admin_role(new.id, new.email, new.email_confirmed_at);
  perform private.try_confirm_referral(new.id);
  return new;
end;
$$;

-- The two auth.users triggers are attached in the team_referral migration, after
-- private.try_confirm_referral() exists, so no signup can hit a missing function.

-- Backfill: users who signed up before this migration ran.
insert into public.profiles (id, email, referral_code)
select u.id, lower(u.email), upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'superadmin'
  from auth.users u
 where u.email_confirmed_at is not null
   and lower(u.email) in ('zaionsmanager@gmail.com', 'aoneahsan@gmail.com')
on conflict (user_id) do update set role = 'superadmin';

/** BEFORE UPDATE: keep updated_at honest without trusting the writer. */
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_updated_at on public.profiles;
create trigger touch_updated_at before update on public.profiles
  for each row execute function private.touch_updated_at();
drop trigger if exists touch_updated_at on public.plans;
create trigger touch_updated_at before update on public.plans
  for each row execute function private.touch_updated_at();
drop trigger if exists touch_updated_at on public.schedules_meta;
create trigger touch_updated_at before update on public.schedules_meta
  for each row execute function private.touch_updated_at();
drop trigger if exists touch_updated_at on public.app_config;
create trigger touch_updated_at before update on public.app_config
  for each row execute function private.touch_updated_at();

/** audit_log is append-only for every role, the owner included. */
create or replace function private.audit_log_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only (% refused)', tg_op using errcode = '42501';
end;
$$;

drop trigger if exists audit_log_no_update_delete on public.audit_log;
create trigger audit_log_no_update_delete before update or delete on public.audit_log
  for each row execute function private.audit_log_is_append_only();
drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_log_is_append_only();

/**
 * Append one audit row in the CALLER's transaction. Actors and user targets are stored
 * as pseudonymous audit_actors rows so deletion can anonymise without touching audit_log.
 */
create or replace function private.actor_ref(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref uuid;
begin
  if p_user is null then
    return null;
  end if;
  select a.id into v_ref from public.audit_actors a where a.user_id = p_user;
  if v_ref is null then
    insert into public.audit_actors (user_id, label)
    select p_user, coalesce(p.email, 'Device ' || left(p_user::text, 8))
      from public.profiles p where p.id = p_user
    on conflict (user_id) do update set label = excluded.label
    returning id into v_ref;
  end if;
  return v_ref;
end;
$$;

create or replace function private.audit(
  p_actor uuid, p_action text, p_target_type text, p_target_id text,
  p_target_user uuid, p_detail jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (actor_ref, action, target_type, target_id, target_ref, detail)
  values (private.actor_ref(p_actor), p_action, p_target_type, p_target_id,
          private.actor_ref(p_target_user), coalesce(p_detail, '{}'::jsonb));
end;
$$;

revoke execute on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.is_anon() to anon, authenticated;
grant execute on function private.my_team_id() to authenticated;
grant execute on function private.has_feature(text) to authenticated;
