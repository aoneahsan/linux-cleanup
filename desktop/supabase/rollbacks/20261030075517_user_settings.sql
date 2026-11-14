-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content.
-- DESTRUCTIVE: drops every account's synced shortcuts, appearance and legal-notice flag.
drop trigger if exists touch_updated_at on public.user_settings;
drop table if exists public.user_settings;
