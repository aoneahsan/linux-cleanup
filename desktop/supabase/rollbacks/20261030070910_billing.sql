-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
drop function if exists public.apply_returned_order(text, integer);
drop function if exists public.apply_paid_order(jsonb);
