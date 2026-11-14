CREATE TYPE "public"."billing_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."grant_source" AS ENUM('admin', 'referral');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('admin', 'superadmin');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."run_pool" AS ENUM('device', 'account', 'plan');--> statement-breakpoint
CREATE TYPE "public"."schedule_kind" AS ENUM('run', 'preview');--> statement-breakpoint
CREATE TYPE "public"."section_status" AS ENUM('completed', 'skipped', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'ended', 'returned');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"os_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_name_len" CHECK (char_length("devices"."name") between 1 and 80),
	CONSTRAINT "devices_os_len" CHECK (char_length("devices"."os_version") between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"referral_code" text,
	"limits_override" jsonb,
	"welcome_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_referral_code_unique" UNIQUE("referral_code"),
	CONSTRAINT "profiles_display_name_len" CHECK (char_length("profiles"."display_name") between 1 and 80),
	CONSTRAINT "profiles_limits_override_object" CHECK ("profiles"."limits_override" is null or jsonb_typeof("profiles"."limits_override") = 'object')
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" "platform_role" NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '14 days' NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by" uuid,
	CONSTRAINT "team_invites_email_lower" CHECK ("team_invites"."email" = lower("team_invites"."email") and char_length("team_invites"."email") between 3 and 254)
);
--> statement-breakpoint
ALTER TABLE "team_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id"),
	CONSTRAINT "team_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"seats" smallint DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_owner_id_unique" UNIQUE("owner_id"),
	CONSTRAINT "teams_name_len" CHECK (char_length("teams"."name") between 1 and 80),
	CONSTRAINT "teams_seats" CHECK ("teams"."seats" between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plan_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"source" "grant_source" NOT NULL,
	"granted_by" uuid,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_grants_window" CHECK ("plan_grants"."ends_at" > "plan_grants"."starts_at"),
	CONSTRAINT "plan_grants_reason_len" CHECK (char_length("plan_grants"."reason") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "plan_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rank" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"price_month_cents" integer DEFAULT 0 NOT NULL,
	"price_year_cents" integer DEFAULT 0 NOT NULL,
	"per_seat" boolean DEFAULT false NOT NULL,
	"min_seats" smallint DEFAULT 1 NOT NULL,
	"real_runs_unlimited" boolean DEFAULT false NOT NULL,
	"device_real_runs_per_month" integer,
	"account_extra_real_runs_per_month" integer,
	"max_synced_machines" smallint DEFAULT 0 NOT NULL,
	"history_sync" boolean DEFAULT false NOT NULL,
	"schedules" boolean DEFAULT false NOT NULL,
	"exports" boolean DEFAULT false NOT NULL,
	"fleet_reports" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_id_format" CHECK ("plans"."id" ~ '^[a-z][a-z0-9_]{1,31}$'),
	CONSTRAINT "plans_name_len" CHECK (char_length("plans"."name") between 1 and 40),
	CONSTRAINT "plans_prices_nonneg" CHECK ("plans"."price_month_cents" between 0 and 1000000 and "plans"."price_year_cents" between 0 and 10000000),
	CONSTRAINT "plans_min_seats" CHECK ("plans"."min_seats" between 1 and 1000),
	CONSTRAINT "plans_run_limits" CHECK (coalesce("plans"."device_real_runs_per_month", 0) between 0 and 100000 and coalesce("plans"."account_extra_real_runs_per_month", 0) between 0 and 100000),
	CONSTRAINT "plans_machines" CHECK ("plans"."max_synced_machines" between 0 and 1000)
);
--> statement-breakpoint
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"team_id" uuid,
	"interval" "billing_interval" NOT NULL,
	"seats" smallint DEFAULT 1 NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"polar_order_id" text NOT NULL,
	"polar_subscription_id" text,
	"polar_customer_id" text,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_polar_order_id_unique" UNIQUE("polar_order_id"),
	CONSTRAINT "subscriptions_period" CHECK ("subscriptions"."period_end" > "subscriptions"."period_start"),
	CONSTRAINT "subscriptions_seats" CHECK ("subscriptions"."seats" between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'polar' NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"result" text
);
--> statement-breakpoint
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "run_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"user_id" uuid,
	"month" text NOT NULL,
	"pool" "run_pool" NOT NULL,
	"sections" smallint[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_claims_month_format" CHECK ("run_claims"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "run_claims_sections_len" CHECK (cardinality("run_claims"."sections") between 1 and 64)
);
--> statement-breakpoint
ALTER TABLE "run_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "run_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"claim_id" uuid,
	"dry_run" boolean NOT NULL,
	"os_version" text NOT NULL,
	"disk_free_before_kb" bigint NOT NULL,
	"disk_free_after_kb" bigint NOT NULL,
	"freed_kb" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_summaries_claim_id_unique" UNIQUE("claim_id"),
	CONSTRAINT "run_summaries_os_len" CHECK (char_length("run_summaries"."os_version") between 1 and 40),
	CONSTRAINT "run_summaries_kb_nonneg" CHECK ("run_summaries"."disk_free_before_kb" >= 0 and "run_summaries"."disk_free_after_kb" >= 0 and "run_summaries"."freed_kb" >= 0)
);
--> statement-breakpoint
ALTER TABLE "run_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "run_summary_sections" (
	"summary_id" uuid NOT NULL,
	"section_id" smallint NOT NULL,
	"status" "section_status" NOT NULL,
	"freed_kb" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "run_summary_sections_summary_id_section_id_pk" PRIMARY KEY("summary_id","section_id"),
	CONSTRAINT "run_summary_sections_id" CHECK ("run_summary_sections"."section_id" between 1 and 999),
	CONSTRAINT "run_summary_sections_kb" CHECK ("run_summary_sections"."freed_kb" >= 0)
);
--> statement-breakpoint
ALTER TABLE "run_summary_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schedules_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"device_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "schedule_kind" NOT NULL,
	"section_ids" smallint[] NOT NULL,
	"cadence" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedules_meta_name_len" CHECK (char_length("schedules_meta"."name") between 1 and 80),
	CONSTRAINT "schedules_meta_sections_len" CHECK (cardinality("schedules_meta"."section_ids") between 1 and 64),
	CONSTRAINT "schedules_meta_cadence" CHECK ("schedules_meta"."cadence" ~ '^(daily|weekly:[0-6]|monthly:([1-9]|1[0-9]|2[0-8]))@([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "schedules_meta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"min_value" numeric,
	"max_value" numeric,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "app_config_key_format" CHECK ("app_config"."key" ~ '^[a-z][a-z0-9_]{1,63}$'),
	CONSTRAINT "app_config_bounds" CHECK (jsonb_typeof("app_config"."value") <> 'number' or (
        ("app_config"."min_value" is null or ("app_config"."value" #>> '{}')::numeric >= "app_config"."min_value")
        and ("app_config"."max_value" is null or ("app_config"."value" #>> '{}')::numeric <= "app_config"."max_value")))
);
--> statement-breakpoint
ALTER TABLE "app_config" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_actors_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "audit_actors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_ref" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_ref" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_log_action_format" CHECK ("audit_log"."action" ~ '^[a-z_]+\.[a-z_]+$')
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"reward_grant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	CONSTRAINT "referrals_invitee_id_unique" UNIQUE("invitee_id"),
	CONSTRAINT "referrals_not_self" CHECK ("referrals"."referrer_id" <> "referrals"."invitee_id"),
	CONSTRAINT "referrals_points_nonneg" CHECK ("referrals"."points_awarded" >= 0)
);
--> statement-breakpoint
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_accepted_by_profiles_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_granted_by_profiles_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grants" ADD CONSTRAINT "plan_grants_revoked_by_profiles_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_claims" ADD CONSTRAINT "run_claims_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_summaries" ADD CONSTRAINT "run_summaries_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_summaries" ADD CONSTRAINT "run_summaries_claim_id_run_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."run_claims"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_summary_sections" ADD CONSTRAINT "run_summary_sections_summary_id_run_summaries_id_fk" FOREIGN KEY ("summary_id") REFERENCES "public"."run_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules_meta" ADD CONSTRAINT "schedules_meta_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_config" ADD CONSTRAINT "app_config_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_actors" ADD CONSTRAINT "audit_actors_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_ref_audit_actors_id_fk" FOREIGN KEY ("actor_ref") REFERENCES "public"."audit_actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_target_ref_audit_actors_id_fk" FOREIGN KEY ("target_ref") REFERENCES "public"."audit_actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_profiles_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_invitee_id_profiles_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_reward_grant_id_plan_grants_id_fk" FOREIGN KEY ("reward_grant_id") REFERENCES "public"."plan_grants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_user_idx" ON "devices" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "profiles_created_idx" ON "profiles" USING btree ("created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_invites_open_unique" ON "team_invites" USING btree ("team_id","email") WHERE "team_invites"."accepted_at" is null;--> statement-breakpoint
CREATE INDEX "team_invites_email_idx" ON "team_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "plan_grants_user_idx" ON "plan_grants" USING btree ("user_id","ends_at");--> statement-breakpoint
CREATE INDEX "plan_grants_created_idx" ON "plan_grants" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_period_idx" ON "subscriptions" USING btree ("user_id","period_end");--> statement-breakpoint
CREATE INDEX "subscriptions_team_idx" ON "subscriptions" USING btree ("team_id","period_end");--> statement-breakpoint
CREATE INDEX "webhook_events_received_idx" ON "webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "run_claims_device_month_idx" ON "run_claims" USING btree ("device_id","month","pool");--> statement-breakpoint
CREATE INDEX "run_claims_user_month_idx" ON "run_claims" USING btree ("user_id","month","pool");--> statement-breakpoint
CREATE INDEX "run_summaries_user_created_idx" ON "run_summaries" USING btree ("user_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "run_summaries_device_created_idx" ON "run_summaries" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "schedules_meta_user_idx" ON "schedules_meta" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_ref","at");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id","status","confirmed_at");--> statement-breakpoint
CREATE POLICY "devices_select_own" ON "devices" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "devices"."user_id");--> statement-breakpoint
CREATE POLICY "devices_update_own" ON "devices" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "devices"."user_id") WITH CHECK ((select auth.uid()) = "devices"."user_id");--> statement-breakpoint
CREATE POLICY "devices_delete_own" ON "devices" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "devices"."user_id");--> statement-breakpoint
CREATE POLICY "profiles_select_own" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "profiles"."id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "profiles"."id" and (select private.is_anon()) is false) WITH CHECK ((select auth.uid()) = "profiles"."id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "user_roles_select_own" ON "user_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "user_roles"."user_id");--> statement-breakpoint
CREATE POLICY "team_invites_select_team" ON "team_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("team_invites"."team_id" = (select private.my_team_id()) and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "team_invites_select_invitee" ON "team_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("team_invites"."email" = lower((select auth.jwt()) ->> 'email') and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "team_members_select_member" ON "team_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("team_members"."team_id" = (select private.my_team_id()) and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "teams_select_member" ON "teams" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("teams"."id" = (select private.my_team_id()) and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "plan_grants_select_own" ON "plan_grants" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "plan_grants"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "plans_select_active" ON "plans" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("plans"."is_active");--> statement-breakpoint
CREATE POLICY "subscriptions_select_own" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "subscriptions"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "run_claims_select_own" ON "run_claims" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "run_claims"."user_id");--> statement-breakpoint
CREATE POLICY "run_summaries_select_own" ON "run_summaries" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "run_summaries"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "run_summary_sections_select_own" ON "run_summary_sections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select 1 from public.run_summaries s where s.id = "run_summary_sections"."summary_id" and s.user_id = (select auth.uid())) and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "schedules_meta_select_own" ON "schedules_meta" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "schedules_meta"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "schedules_meta_insert_own" ON "schedules_meta" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "schedules_meta"."user_id" and (select private.is_anon()) is false and (select private.has_feature('schedules')));--> statement-breakpoint
CREATE POLICY "schedules_meta_update_own" ON "schedules_meta" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "schedules_meta"."user_id" and (select private.is_anon()) is false) WITH CHECK ((select auth.uid()) = "schedules_meta"."user_id" and (select private.is_anon()) is false and (select private.has_feature('schedules')));--> statement-breakpoint
CREATE POLICY "schedules_meta_delete_own" ON "schedules_meta" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((select auth.uid()) = "schedules_meta"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "app_config_select_public" ON "app_config" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING ("app_config"."is_public");--> statement-breakpoint
CREATE POLICY "referrals_select_own" ON "referrals" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "referrals"."referrer_id" and (select private.is_anon()) is false);