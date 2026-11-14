-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Disable [auth.hook.before_user_created] in config.toml
-- (and `supabase config push`) BEFORE dropping the function, or every sign-up fails.
drop function if exists public.hook_before_user_created(jsonb);
