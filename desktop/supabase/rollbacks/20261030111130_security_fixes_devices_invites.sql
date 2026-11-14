-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content.
-- WARNING: rolling back re-opens F-SEC-002 (device re-homing) and F-SEC-003 (free teams,
-- unlimited invite emails). Restoring the earlier private.register_device, team_create and
-- team_invite means re-running their `create or replace` blocks from
-- 20261030070908_allowance.sql and 20261030070913_team_referral.sql in the new migration.
drop function if exists public.export_my_data();
drop function if exists public.device_handoff_complete(uuid, text);
drop function if exists public.device_handoff_begin(uuid);
-- DESTRUCTIVE (data only in these columns: pending hand-over codes, invite send times):
alter table public.team_invites drop column if exists last_sent_at;
alter table public.devices drop column if exists handoff_expires_at;
alter table public.devices drop column if exists handoff_code_hash;
