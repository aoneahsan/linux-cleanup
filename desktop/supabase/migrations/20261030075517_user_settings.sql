CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY DEFAULT auth.uid() NOT NULL,
	"shortcuts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"appearance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legal_notice_seen_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_shortcuts_object" CHECK (jsonb_typeof("user_settings"."shortcuts") = 'object' and octet_length("user_settings"."shortcuts"::text) <= 16384),
	CONSTRAINT "user_settings_appearance_object" CHECK (jsonb_typeof("user_settings"."appearance") = 'object' and octet_length("user_settings"."appearance"::text) <= 4096)
);
--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "user_settings_select_own" ON "user_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((select auth.uid()) = "user_settings"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "user_settings_insert_own" ON "user_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((select auth.uid()) = "user_settings"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
CREATE POLICY "user_settings_update_own" ON "user_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((select auth.uid()) = "user_settings"."user_id" and (select private.is_anon()) is false) WITH CHECK ((select auth.uid()) = "user_settings"."user_id" and (select private.is_anon()) is false);--> statement-breakpoint
-- Paired privilege block (Drizzle emits no REVOKE). Close all four roles, TRUNCATE included,
-- then grant back exactly what the client needs. user_id is insertable but never updatable,
-- so clients write insert-then-update: a PostgREST upsert would need UPDATE on user_id.
-- No DELETE grant: account deletion cascades the row from auth.users.
revoke all on table public.user_settings from public, anon, authenticated, service_role;--> statement-breakpoint
grant select on public.user_settings to authenticated;--> statement-breakpoint
grant insert (user_id, shortcuts, appearance, legal_notice_seen_at) on public.user_settings to authenticated;--> statement-breakpoint
grant update (shortcuts, appearance, legal_notice_seen_at) on public.user_settings to authenticated;--> statement-breakpoint
grant select on public.user_settings to service_role;--> statement-breakpoint
-- updated_at is bumped by the server on every update (private.touch_updated_at, auth_triggers migration).
drop trigger if exists touch_updated_at on public.user_settings;--> statement-breakpoint
create trigger touch_updated_at before update on public.user_settings
  for each row execute function private.touch_updated_at();
