-- Reviewed rollback companion. NEVER auto-applied: using it means writing a NEW forward
-- migration with this content. Deploy an `admin` function without the releases.* actions
-- and an app build without the release gate first, or every check fails open forever.
drop function if exists public.list_app_releases(uuid, text, text, text, integer);
drop function if exists public.publish_app_release(uuid, text, text, text, text, text, text);
drop view if exists public.latest_app_releases;
-- DESTRUCTIVE (every published release record; the audit rows of each publish stay):
drop table if exists public.app_releases;
drop type if exists public.release_severity;
drop type if exists public.release_channel;
drop type if exists public.release_platform;
