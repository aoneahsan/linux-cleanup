-- Custom migration: push every published release to open clients (update flow layer 2 and the
-- layer-1 updater check), so no client reads the record on a timer (realtime-not-polling law).
--
-- On each new app_releases row, one Realtime Broadcast goes to the public topic `app-releases`
-- with event `release_published`. The payload is what the latest_app_releases view already
-- publishes to anon (platform, channel, version, severity, reason, min_native_version): no
-- admin id. Clients re-read the view when it arrives; the broadcast is a wake-up, not the source.
-- Additive and idempotent. Rollback: supabase/rollbacks/20261114092255_release_broadcast.sql.

create or replace function private.broadcast_app_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'platform', new.platform,
      'channel', new.channel,
      'version', new.version,
      'severity', new.severity,
      'reason', new.reason,
      'min_native_version', new.min_native_version
    ),
    'release_published',
    'app-releases',
    false
  );
  return new;
exception when others then
  -- A broadcast failure must never undo a publish: clients still read the record on start and focus.
  raise warning 'app release broadcast failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function private.broadcast_app_release() from public, anon, authenticated, service_role;

drop trigger if exists app_releases_broadcast on public.app_releases;
create trigger app_releases_broadcast
  after insert on public.app_releases
  for each row execute function private.broadcast_app_release();
