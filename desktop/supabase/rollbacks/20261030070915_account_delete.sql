-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
drop function if exists public.account_delete_data(uuid);
