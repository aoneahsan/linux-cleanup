-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
drop function if exists public.record_run_summary(jsonb);
drop function if exists public.claim_run(uuid, smallint[]);
drop function if exists public.get_allowance(uuid);
drop function if exists private.allowance_facts(uuid, uuid, boolean);
drop function if exists private.register_device(uuid, uuid);
