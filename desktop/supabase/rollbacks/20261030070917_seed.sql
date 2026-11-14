-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Anything destructive here is an owner decision every time.
-- Seed rows are data an admin may have edited since; removing them is an owner decision.
-- delete from public.app_config where key in ('device_real_runs_per_month', 'account_extra_real_runs_per_month',
--   'referral_enabled', 'referral_points_per_confirmed', 'referral_pro_month_threshold', 'referral_pro_months_cap_per_year');
select 'no automatic rollback for seed rows' as note;
