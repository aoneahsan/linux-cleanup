-- Custom migration: account deletion, step 1 of 2 (step 2 is auth.admin.deleteUser in the
-- delete-account Edge Function, which cascades profiles -> every owned row).
-- Audit rows are KEPT and never touched: the pseudonymous audit_actors row is anonymised.
-- run_claims keep counting the device pool with user_id nulled (no personal data left).
set check_function_bodies = off;

create or replace function public.account_delete_data(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teams integer;
begin
  update public.audit_actors set user_id = null, label = 'Deleted account' where user_id = p_user;
  -- An owned team goes with its owner; members simply lose the seat.
  delete from public.teams t where t.owner_id = p_user;
  get diagnostics v_teams = row_count;
  delete from public.team_invites i where i.email = (select p.email from public.profiles p where p.id = p_user);
  insert into public.audit_log (actor_ref, action, target_type, detail)
  values (null, 'account.delete', 'profile', jsonb_build_object('teams_deleted', v_teams));
  return jsonb_build_object('teams_deleted', v_teams);
end;
$$;

revoke execute on function public.account_delete_data(uuid) from public, anon, authenticated, service_role;
grant execute on function public.account_delete_data(uuid) to service_role;
