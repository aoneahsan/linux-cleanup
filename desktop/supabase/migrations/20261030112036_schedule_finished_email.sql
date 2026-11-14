ALTER TABLE "run_summaries" ADD COLUMN "schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "run_summaries" ADD COLUMN "schedule_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "run_summaries" ADD CONSTRAINT "run_summaries_schedule_id_schedules_meta_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules_meta"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- CONTRACTS.md section 3: a summary from a synced schedule may trigger the branded
-- "Scheduled run finished" email, once per summary. Columns above are written only by
-- the function below (authenticated holds no INSERT/UPDATE on run_summaries).
set check_function_bodies = off;
--> statement-breakpoint
/**
 * Link a just-recorded summary to the caller's schedule and claim its email, atomically.
 * Returns { send: true } exactly once per summary, and only when the caller asked for it
 * (email_on_schedule) and their plan includes schedules.
 */
create or replace function public.schedule_email_claim(p_summary uuid, p_schedule uuid, p_email boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_send boolean := false;
begin
  if v_user is null or private.is_anon() then
    raise exception 'signed_in_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.schedules_meta m where m.id = p_schedule and m.user_id = v_user) then
    raise exception 'invalid_schedule' using errcode = '22023';
  end if;
  update public.run_summaries set schedule_id = p_schedule
   where id = p_summary and user_id = v_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if coalesce(p_email, false) and private.has_feature('schedules') then
    update public.run_summaries set schedule_email_sent_at = now()
     where id = p_summary and user_id = v_user and schedule_email_sent_at is null;
    v_send := found;
  end if;
  return jsonb_build_object('send', v_send);
end;
$$;
--> statement-breakpoint
revoke execute on function public.schedule_email_claim(uuid, uuid, boolean) from public, anon, authenticated, service_role;
--> statement-breakpoint
grant execute on function public.schedule_email_claim(uuid, uuid, boolean) to authenticated;
