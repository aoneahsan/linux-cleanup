-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Deploy a run-summary without the `schedule` branch first.
drop function if exists public.schedule_email_claim(uuid, uuid, boolean);
-- DESTRUCTIVE (the schedule links and email-sent stamps on summaries):
alter table public.run_summaries drop constraint if exists run_summaries_schedule_id_schedules_meta_id_fk;
alter table public.run_summaries drop column if exists schedule_email_sent_at;
alter table public.run_summaries drop column if exists schedule_id;
