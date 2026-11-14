-- Rollback for 20261030074113_section_ids_bounds (review only, never auto-applied).
-- Restores the 1..999 bound, which refuses section 0. Only apply as a new forward migration.
alter table public.run_summary_sections drop constraint if exists run_summary_sections_id;
alter table public.run_summary_sections add constraint run_summary_sections_id check (section_id between 1 and 999);
