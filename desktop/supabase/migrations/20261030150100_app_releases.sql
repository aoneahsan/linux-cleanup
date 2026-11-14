CREATE TYPE "public"."release_channel" AS ENUM('production', 'test');--> statement-breakpoint
CREATE TYPE "public"."release_platform" AS ENUM('desktop', 'web', 'docs');--> statement-breakpoint
CREATE TYPE "public"."release_severity" AS ENUM('urgent', 'normal');--> statement-breakpoint
CREATE TABLE "app_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "release_platform" NOT NULL,
	"channel" "release_channel" NOT NULL,
	"version" text NOT NULL,
	"severity" "release_severity" NOT NULL,
	"reason" text NOT NULL,
	"min_native_version" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "app_releases_version_semver" CHECK ("app_releases"."version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
	CONSTRAINT "app_releases_min_native_semver" CHECK ("app_releases"."min_native_version" is null or "app_releases"."min_native_version" ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
	CONSTRAINT "app_releases_reason_len" CHECK (char_length("app_releases"."reason") between 1 and 280 and btrim("app_releases"."reason") <> '')
);
--> statement-breakpoint
ALTER TABLE "app_releases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_releases_latest_idx" ON "app_releases" USING btree ("platform","channel","published_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "app_releases_published_idx" ON "app_releases" USING btree ("published_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE VIEW "public"."latest_app_releases" WITH (security_invoker = false) AS (select distinct on ("app_releases"."platform", "app_releases"."channel") "id", "platform", "channel", "version", "severity", "reason", "min_native_version", "published_at" from "app_releases" order by "app_releases"."platform", "app_releases"."channel", "app_releases"."published_at" desc, "app_releases"."id" desc);--> statement-breakpoint
-- Custom part: update flow layer 2 (skill aoneahsan-cccs-update-flow, references/contract.md).
-- The table has RLS on and NO policy, and no role holds any table privilege on it: the
-- service role reaches it only through the two SECURITY DEFINER functions below. Clients
-- read the latest row per platform+channel through the view (security_invoker = false).
-- A release is never edited or deleted; a newer row corrects a mistake.
revoke all on table public.app_releases from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke all on table public.latest_app_releases from public, anon, authenticated, service_role;
--> statement-breakpoint
grant select on public.latest_app_releases to anon, authenticated;
--> statement-breakpoint

/**
 * Publish one release (admin only, re-checked here; the admin Edge Function has already
 * gated the caller). Validates every field, inserts, and appends the audit row in the
 * SAME transaction. Returns the row plus the version it supersedes, so the admin page can
 * warn (never block) when the new version is not above it.
 */
create or replace function public.publish_app_release(
  p_actor uuid, p_platform text, p_channel text, p_version text, p_severity text,
  p_reason text, p_min_native_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_semver constant text := '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$';
  v_reason text := btrim(coalesce(p_reason, ''));
  v_previous text;
  v_row public.app_releases%rowtype;
begin
  perform private.assert_admin(p_actor);
  if p_platform is null or not (p_platform = any (enum_range(null::public.release_platform)::text[]))
     or p_channel is null or not (p_channel = any (enum_range(null::public.release_channel)::text[]))
     or p_severity is null or not (p_severity = any (enum_range(null::public.release_severity)::text[]))
     or p_version is null or p_version !~ v_semver
     or (p_min_native_version is not null and p_min_native_version !~ v_semver)
     or char_length(v_reason) not between 1 and 280 then
    raise exception 'invalid_request' using errcode = '22023';
  end if;

  select r.version into v_previous
    from public.app_releases r
   where r.platform = p_platform::public.release_platform and r.channel = p_channel::public.release_channel
   order by r.published_at desc, r.id desc
   limit 1;

  -- clock_timestamp(), not now(): two publishes in one transaction must still order.
  insert into public.app_releases (platform, channel, version, severity, reason, min_native_version, published_at, created_by)
  values (p_platform::public.release_platform, p_channel::public.release_channel, p_version,
          p_severity::public.release_severity, v_reason, p_min_native_version, clock_timestamp(), p_actor)
  returning * into v_row;

  perform private.audit(p_actor, 'release.publish', 'app_release', v_row.id::text, null,
    jsonb_build_object('platform', v_row.platform, 'channel', v_row.channel, 'version', v_row.version,
      'severity', v_row.severity, 'reason', v_row.reason, 'min_native_version', v_row.min_native_version,
      'previous_version', v_previous));

  return jsonb_build_object(
    'release', jsonb_build_object('id', v_row.id, 'platform', v_row.platform, 'channel', v_row.channel,
      'version', v_row.version, 'severity', v_row.severity, 'reason', v_row.reason,
      'min_native_version', v_row.min_native_version, 'published_at', v_row.published_at),
    'previous_version', v_previous);
end;
$$;
--> statement-breakpoint

/**
 * The newest releases first (admin only): at most 20 per page, keyset cursor
 * "published_at|id", optional platform/channel filters. Returns { items, next_cursor }.
 */
create or replace function public.list_app_releases(
  p_actor uuid, p_platform text, p_channel text, p_cursor text, p_limit integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_at timestamptz;
  v_id uuid;
  v_rows jsonb;
begin
  perform private.assert_admin(p_actor);
  if (p_platform is not null and not (p_platform = any (enum_range(null::public.release_platform)::text[])))
     or (p_channel is not null and not (p_channel = any (enum_range(null::public.release_channel)::text[])))
     or (p_cursor is not null and p_cursor !~ '^[^|]{1,40}\|[0-9a-f-]{36}$') then
    raise exception 'invalid_request' using errcode = '22023';
  end if;
  v_at := nullif(split_part(coalesce(p_cursor, ''), '|', 1), '')::timestamptz;
  v_id := nullif(split_part(coalesce(p_cursor, ''), '|', 2), '')::uuid;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.published_at desc, x.id desc), '[]'::jsonb) into v_rows from (
    select r.id, r.platform, r.channel, r.version, r.severity, r.reason, r.min_native_version, r.published_at,
           coalesce((select p.email from public.profiles p where p.id = r.created_by), 'Deleted account') as published_by
      from public.app_releases r
     where (p_platform is null or r.platform = p_platform::public.release_platform)
       and (p_channel is null or r.channel = p_channel::public.release_channel)
       and (v_at is null or (r.published_at, r.id) < (v_at, v_id))
     order by r.published_at desc, r.id desc
     limit v_limit + 1) x;

  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(e order by n) from jsonb_array_elements(v_rows) with ordinality t(e, n) where n <= v_limit), '[]'::jsonb),
    'next_cursor', case when jsonb_array_length(v_rows) > v_limit then
      (v_rows -> (v_limit - 1) ->> 'published_at') || '|' || (v_rows -> (v_limit - 1) ->> 'id') end);
end;
$$;
--> statement-breakpoint
revoke execute on function public.publish_app_release(uuid, text, text, text, text, text, text) from public, anon, authenticated, service_role;
--> statement-breakpoint
revoke execute on function public.list_app_releases(uuid, text, text, text, integer) from public, anon, authenticated, service_role;
--> statement-breakpoint
grant execute on function public.publish_app_release(uuid, text, text, text, text, text, text) to service_role;
--> statement-breakpoint
grant execute on function public.list_app_releases(uuid, text, text, text, integer) to service_role;
