-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
drop function if exists private.is_admin(uuid);
drop function if exists private.config_int(text);
drop function if exists private.has_feature(text);
drop function if exists private.effective_plan_id(uuid);
drop function if exists private.my_team_id();
drop function if exists private.month_key(timestamptz);
drop function if exists private.is_anon();
-- Policies in 20261030070849 call these: roll that migration back first.
