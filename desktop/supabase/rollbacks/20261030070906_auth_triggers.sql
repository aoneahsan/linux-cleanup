-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
drop trigger if exists audit_log_no_truncate on public.audit_log;
drop trigger if exists audit_log_no_update_delete on public.audit_log;
drop trigger if exists touch_updated_at on public.app_config;
drop trigger if exists touch_updated_at on public.schedules_meta;
drop trigger if exists touch_updated_at on public.plans;
drop trigger if exists touch_updated_at on public.profiles;
drop function if exists private.audit(uuid, text, text, text, uuid, jsonb);
drop function if exists private.actor_ref(uuid);
drop function if exists private.audit_log_is_append_only();
drop function if exists private.touch_updated_at();
drop function if exists private.handle_auth_user_update();
drop function if exists private.handle_auth_user_insert();
drop function if exists private.seed_admin_role(uuid, text, timestamptz);
-- Backfilled profiles and seeded roles are kept (removing them is destructive).
