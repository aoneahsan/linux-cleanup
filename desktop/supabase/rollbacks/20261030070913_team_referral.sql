-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
drop function if exists public.team_fleet(uuid);
drop function if exists public.team_remove(uuid, uuid, uuid);
drop function if exists public.team_accept(uuid, uuid);
drop function if exists public.team_invite(uuid, text);
drop function if exists public.team_create(uuid, text);
drop function if exists public.referral_claim(uuid, text);
drop trigger if exists linux_cleanup_on_auth_user_update on auth.users;
drop trigger if exists linux_cleanup_on_auth_user_insert on auth.users;
drop function if exists private.try_confirm_referral(uuid);
