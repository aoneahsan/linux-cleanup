-- Custom migration: the paired privilege block for every table the previous migration
-- created. Drizzle emits no REVOKE, and Supabase's default ACL hands anon, authenticated
-- AND service_role every table privilege, TRUNCATE included (RLS never polices TRUNCATE).
-- Close all four roles first, then grant back exactly what each caller needs.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'devices', 'plans', 'subscriptions', 'plan_grants',
    'webhook_events', 'run_claims', 'run_summaries', 'run_summary_sections',
    'schedules_meta', 'teams', 'team_members', 'team_invites', 'referrals',
    'app_config', 'audit_actors', 'audit_log'
  ] loop
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

revoke all on sequence public.audit_log_id_seq from public, anon, authenticated, service_role;

-- Future objects in public start closed too; each new table ships its own grant block.
alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;

-- anon (a request with only the publishable key): the public registry rows.
grant select on public.plans, public.app_config to anon;

-- authenticated (anonymous device sessions AND Google accounts; RLS splits them):
grant select on
  public.plans, public.app_config, public.profiles, public.user_roles, public.devices,
  public.subscriptions, public.plan_grants, public.run_claims, public.run_summaries,
  public.run_summary_sections, public.schedules_meta, public.teams, public.team_members,
  public.team_invites, public.referrals
to authenticated;
-- Column grants are the boundary for privilege columns; a policy cannot police a column.
grant update (display_name) on public.profiles to authenticated;
grant update (name) on public.devices to authenticated;
grant delete on public.devices to authenticated;
grant insert (device_id, name, kind, section_ids, cadence, enabled) on public.schedules_meta to authenticated;
grant update (device_id, name, kind, section_ids, cadence, enabled, updated_at) on public.schedules_meta to authenticated;
grant delete on public.schedules_meta to authenticated;

-- service_role (Edge Functions after their own ordered gate). Reads everywhere; writes
-- only where a function writes directly. Audit tables: read only (rows are appended by
-- SECURITY DEFINER SQL); TRUNCATE is granted to nobody.
grant select on all tables in schema public to service_role;
grant insert, update on public.webhook_events to service_role;
grant update (welcome_sent_at) on public.profiles to service_role;
grant update (notified_at) on public.referrals to service_role;
