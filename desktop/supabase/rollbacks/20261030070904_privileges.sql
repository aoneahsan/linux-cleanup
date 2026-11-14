-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
-- Reopening grants is a security regression; the only sane rollback is a corrected grant
-- block. Restore Supabase's defaults only on an explicit owner decision:
-- alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
select 'no automatic rollback for privileges' as note;
