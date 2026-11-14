-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
-- DESTRUCTIVE: drops every linux-cleanup table and all their rows.
drop table if exists public.referrals, public.audit_log, public.audit_actors, public.app_config,
  public.schedules_meta, public.run_summary_sections, public.run_summaries, public.run_claims,
  public.webhook_events, public.plan_grants, public.subscriptions, public.plans,
  public.team_invites, public.team_members, public.teams, public.devices, public.user_roles,
  public.profiles cascade;
drop type if exists public.billing_interval, public.grant_source, public.platform_role,
  public.referral_status, public.run_pool, public.schedule_kind, public.section_status,
  public.subscription_status, public.team_role;
