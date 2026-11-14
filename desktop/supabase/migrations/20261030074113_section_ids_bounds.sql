-- Linux section ids are 0..15 (0 = the all-safe cleanup the CLI runs; the rest are reserved for
-- modes the CLI may expose to the desktop later). The first migration bounded them at 1..999,
-- which refused id 0. Forward fix: the check constraint (generated) and claim_run (same grants).
ALTER TABLE "run_summary_sections" DROP CONSTRAINT "run_summary_sections_id";--> statement-breakpoint
ALTER TABLE "run_summary_sections" ADD CONSTRAINT "run_summary_sections_id" CHECK ("run_summary_sections"."section_id" between 0 and 15);
--> statement-breakpoint
create or replace function public.claim_run(p_device_id uuid, p_sections smallint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_anon boolean := private.is_anon();
  v_before jsonb;
  v_pool public.run_pool;
  v_claim uuid;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_device_id is null or p_sections is null
     or cardinality(p_sections) not between 1 and 64
     or exists (select 1 from unnest(p_sections) s where s is null or s not between 0 and 15) then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('linux_cleanup.claim.device:' || p_device_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('linux_cleanup.claim.user:' || v_user::text, 0));
  perform private.register_device(v_user, p_device_id);

  v_before := private.allowance_facts(v_user, p_device_id, v_anon);
  v_pool := case
    when (v_before -> 'plan' ->> 'unlimited')::boolean then 'plan'
    when (v_before -> 'device' ->> 'used')::integer < (v_before -> 'device' ->> 'limit')::integer then 'device'
    when not v_anon
      and (v_before -> 'account' ->> 'used')::integer < (v_before -> 'account' ->> 'limit')::integer then 'account'
    else null
  end;

  if v_pool is null then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached', 'before', v_before, 'allowance', v_before);
  end if;

  insert into public.run_claims (device_id, user_id, month, pool, sections)
  values (p_device_id, v_user, v_before ->> 'month', v_pool,
          (select array_agg(distinct s order by s) from unnest(p_sections) s))
  returning id into v_claim;

  return jsonb_build_object(
    'ok', true, 'claim_id', v_claim, 'pool', v_pool, 'before', v_before,
    'allowance', private.allowance_facts(v_user, p_device_id, v_anon)
  );
end;
$$;
revoke execute on function public.claim_run(uuid, smallint[]) from public, anon, authenticated, service_role;
grant execute on function public.claim_run(uuid, smallint[]) to authenticated;
