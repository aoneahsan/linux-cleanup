-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
drop function if exists public.admin_audit_list(uuid, text, bigint, integer);
drop function if exists public.admin_config_set(uuid, text, jsonb, text);
drop function if exists public.admin_config_get(uuid);
drop function if exists public.admin_grants_list(uuid, uuid, boolean, text, integer);
drop function if exists public.admin_plan_upsert(uuid, jsonb, text);
drop function if exists public.admin_plans_list(uuid);
drop function if exists public.admin_override_limits(uuid, uuid, jsonb, text);
drop function if exists public.admin_set_plan(uuid, uuid, text, timestamptz, text);
drop function if exists public.admin_grant_revoke(uuid, uuid, text);
drop function if exists public.admin_grant_create(uuid, uuid, text, timestamptz, timestamptz, text);
drop function if exists public.admin_user_view(uuid, uuid);
drop function if exists public.admin_users_list(uuid, text, text, integer);
drop function if exists public.admin_stats(uuid);
drop function if exists private.page_size(integer);
drop function if exists private.assert_admin(uuid);
