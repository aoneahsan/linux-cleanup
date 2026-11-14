-- Rollback for 20261114092255_release_broadcast (review only, never auto-applied).
drop trigger if exists app_releases_broadcast on public.app_releases;
drop function if exists private.broadcast_app_release();
