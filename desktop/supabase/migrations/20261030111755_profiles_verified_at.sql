ALTER TABLE "profiles" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
-- F-SEC-004 (product audit 2026-10-30): the referral window is measured from the moment the
-- account became a verified, non-anonymous (Google) account, not from the anonymous
-- device's profile creation. The auth triggers stamp verified_at once; it is not
-- client-writable (authenticated holds UPDATE on profiles.display_name only).
set check_function_bodies = off;
--> statement-breakpoint
/** Stamp verified_at the first time the user is non-anonymous with a confirmed email. */
create or replace function private.stamp_verified(p_user uuid, p_is_anonymous boolean, p_confirmed timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(p_is_anonymous, false) and p_confirmed is not null then
    update public.profiles set verified_at = now()
     where id = p_user and verified_at is null;
  end if;
end;
$$;
--> statement-breakpoint
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
  perform private.stamp_verified(new.id, new.is_anonymous, new.email_confirmed_at);
  perform private.seed_admin_role(new.id, new.email, new.email_confirmed_at);
  perform private.try_confirm_referral(new.id);
  return new;
end;
$$;
--> statement-breakpoint
create or replace function private.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email), updated_at = now()
   where id = new.id and email is distinct from lower(new.email);
  perform private.stamp_verified(new.id, new.is_anonymous, new.email_confirmed_at);
  perform private.seed_admin_role(new.id, new.email, new.email_confirmed_at);
  perform private.try_confirm_referral(new.id);
  return new;
end;
$$;
--> statement-breakpoint
-- Backfill accounts verified before this migration: the confirmation instant is the best
-- record of when the account was linked (Google sets it at link time).
update public.profiles p
   set verified_at = u.email_confirmed_at
  from auth.users u
 where u.id = p.id and p.verified_at is null
   and coalesce(u.is_anonymous, false) = false and u.email_confirmed_at is not null;
--> statement-breakpoint
/**
 * Record who invited this account: once, within 30 days of the account becoming a verified
 * Google account, never yourself. Confirmation stays with try_confirm_referral.
 */
create or replace function public.referral_claim(p_invitee uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer uuid;
  v_verified timestamptz;
begin
  select p.id into v_referrer from public.profiles p where p.referral_code = upper(trim(p_code));
  if v_referrer is null or v_referrer = p_invitee then
    return jsonb_build_object('result', 'invalid_code');
  end if;
  if exists (select 1 from public.referrals r where r.invitee_id = p_invitee) then
    return jsonb_build_object('result', 'already_recorded');
  end if;
  select p.verified_at into v_verified from public.profiles p where p.id = p_invitee;
  if v_verified is null then
    return jsonb_build_object('result', 'not_verified');
  end if;
  if v_verified <= now() - interval '30 days' then
    return jsonb_build_object('result', 'too_late');
  end if;
  insert into public.referrals (referrer_id, invitee_id) values (v_referrer, p_invitee);
  perform private.try_confirm_referral(p_invitee);
  return jsonb_build_object('result', (select r.status from public.referrals r where r.invitee_id = p_invitee));
end;
$$;
--> statement-breakpoint
revoke execute on function private.stamp_verified(uuid, boolean, timestamptz) from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function private.handle_auth_user_insert() from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function private.handle_auth_user_update() from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function public.referral_claim(uuid, text) from public, anon, authenticated, service_role;
--> statement-breakpoint
grant execute on function public.referral_claim(uuid, text) to service_role;
