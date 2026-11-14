/**
 * Update flow layer 1: check for a signed update at start, the moment a desktop release is
 * published (Realtime broadcast, services/releaseBroadcast) and when the window comes back
 * (at most once a minute). With automatic updates on, download and install it at once, then
 * relaunch at a quiet moment only — no run live, and the window hidden or
 * unfocused for 2 minutes or idle for 10. With them off, the Updates screen keeps
 * its "ready, relaunch" card and nothing happens by itself.
 */
import { checkForUpdate, installUpdate, relaunch } from '@/services/updater';
import { env } from '@/config/env';
import { isQuietMoment, mayRecheck } from '@/lib/updatePolicy';
import { onReleasePublished } from '@/services/releaseBroadcast';
import { useSettings } from '@/stores/settings';
import { useUpdateState } from '@/stores/update';
import { isActive, useRun } from '@/stores/run';
import { logger } from '@/lib/logger';

const QUIET_POLL_MS = 30_000;
const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

/** One scheduled check; installs straight away when automatic updates are on. */
async function tick(): Promise<void> {
  const status = useUpdateState.getState().status;
  if (status === 'checking' || status === 'downloading' || status === 'ready') return;
  await checkForUpdate();
  if (useSettings.getState().settings.updatesAuto && useUpdateState.getState().status === 'available') await installUpdate();
}

/** Bind the schedule and the quiet-relaunch watcher once (AppShell). Returns the cleanup. */
export function bindAutoUpdate(): () => void {
  let hiddenSince: number | null = document.hidden || !document.hasFocus() ? Date.now() : null;
  let lastActivity = Date.now();
  let relaunching = false;

  const away = () => { hiddenSince ??= Date.now(); };
  const back = () => { if (!document.hidden) hiddenSince = null; lastActivity = Date.now(); };
  const onVisibility = () => { if (document.hidden) away(); else { back(); onReturn(); } };
  const onActivity = () => { lastActivity = Date.now(); };

  // A local idle watch (no network): it only decides when an already-downloaded update relaunches.
  const quiet = window.setInterval(() => {
    if (relaunching || useUpdateState.getState().status !== 'ready' || !useSettings.getState().settings.updatesAuto) return;
    if (!isQuietMoment({ runLive: isActive(useRun.getState()), hiddenSince, lastActivity, now: Date.now() })) return;
    relaunching = true;
    void relaunch().catch((error: unknown) => {
      relaunching = false;
      logger.warn('quiet relaunch failed', error instanceof Error ? error.message : String(error));
    });
  }, QUIET_POLL_MS);

  let lastCheck: number | null = null;
  const run = () => {
    lastCheck = Date.now();
    void tick().catch((error: unknown) => logger.warn('update check failed', error instanceof Error ? error.message : String(error)));
  };
  run();
  const offRelease = onReleasePublished((release) => {
    if (!release || (release.platform === 'desktop' && release.channel === env.releaseChannel)) run();
  });
  const onReturn = () => {
    if (!document.hidden && mayRecheck(lastCheck, Date.now())) run();
  };

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', away);
  window.addEventListener('focus', back);
  for (const ev of ACTIVITY) window.addEventListener(ev, onActivity, { passive: true });
  return () => {
    window.clearInterval(quiet);
    offRelease();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', away);
    window.removeEventListener('focus', back);
    for (const ev of ACTIVITY) window.removeEventListener(ev, onActivity);
  };
}
