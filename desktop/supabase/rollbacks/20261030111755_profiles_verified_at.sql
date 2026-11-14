-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content.
-- WARNING: rolling back re-opens F-SEC-004 (the referral window measured from the anonymous
-- profile's creation). Restore the earlier private.handle_auth_user_insert/update and
-- public.referral_claim by re-running their `create or replace` blocks from
-- 20261030070906_auth_triggers.sql and 20261030070913_team_referral.sql FIRST (they must not
-- call stamp_verified or read verified_at), then:
drop function if exists private.stamp_verified(uuid, boolean, timestamptz);
-- DESTRUCTIVE (the verification timestamps):
alter table public.profiles drop column if exists verified_at;
