-- Custom migration: seed rows. Idempotent and NON-overwriting (on conflict do nothing):
-- once an admin edits a price, limit or setting, re-applying this file changes nothing.
-- Figures: the owner's answer of 2026-11-14 (mirror macleanup): Pro $4/month or $36/year;
-- Team $3/seat/month or $30/seat/year, min 3 seats ($90/year for three); Pro and Team sync up
-- to 5 machines; Free syncs none (history sync is Pro-only). Every figure is an admin field.

insert into public.plans (id, name, description, rank, is_active, price_month_cents, price_year_cents,
  per_seat, min_seats, real_runs_unlimited, device_real_runs_per_month, account_extra_real_runs_per_month,
  max_synced_machines, history_sync, schedules, exports, fleet_reports)
values
  ('free', 'Free', 'The full all-safe cleanup, every protected-path refusal and unlimited dry runs.', 0, true, 0, 0,
   false, 1, false, null, null, 0, false, false, false, false),
  ('pro', 'Pro', 'No monthly run limit, synced receipts, schedules, reports across your machines and exports.', 10, true, 400, 3600,
   false, 1, true, null, null, 5, true, true, true, false),
  ('team', 'Team', 'Pro for every seat, plus one report across the team’s machines.', 20, true, 300, 3000,
   true, 3, true, null, null, 5, true, true, true, true)
on conflict (id) do nothing;

insert into public.app_config (key, value, is_public, min_value, max_value, description)
values
  ('device_real_runs_per_month', '15'::jsonb, true, 0, 100000,
   'Real runs each computer gets every UTC month, signed in or not.'),
  ('account_extra_real_runs_per_month', '15'::jsonb, true, 0, 100000,
   'Extra real runs each UTC month for a signed-in account, after the device pool.'),
  ('referral_enabled', 'true'::jsonb, true, null, null,
   'Off switch for the referral programme. Off: no new confirmations, points or rewards.'),
  ('referral_points_per_confirmed', '10'::jsonb, true, 0, 1000,
   'Points for each confirmed friend (account exists and email verified).'),
  ('referral_pro_month_threshold', '3'::jsonb, true, 1, 100,
   'Every this-many confirmed friends add one month of Pro.'),
  ('referral_pro_months_cap_per_year', '4'::jsonb, true, 0, 12,
   'Most Pro months the referral programme grants one account in a rolling year.')
on conflict (key) do nothing;
