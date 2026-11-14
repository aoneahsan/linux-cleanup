/**
 * Update flow layer 2 (CONTRACTS "Releases"): read the newest `desktop` release record
 * for this build's channel after the first paint, the moment a release is published
 * (Realtime broadcast), and when the window comes back (at most once a minute); decide with
 * the pure `decide()`. A failed read fails open, except that a normal release
 * stored by an earlier start still blocks. The stored notice lives in
 * strata-storage with this start's number, so "from the next start" works.
 */
import { env } from '@/config/env';
import { decide } from '@/lib/releaseGate';
import { mayRecheck, nextStartCount, readStoredNotice } from '@/lib/updatePolicy';
import { onReleasePublished } from '@/services/releaseBroadcast';
import { load, remove, save } from '@/lib/storage';
import { openExternal } from '@/lib/open';
import { logger } from '@/lib/logger';
import { fetchLatestRelease } from '@/services/releases';
import { RELEASES_URL, relaunch, updateNow } from '@/services/updater';
import { useReleaseGate } from '@/stores/releaseGate';
import { isActive, useRun } from '@/stores/run';

const NOTICE_KEY = 'release-notice';
const START_KEY = 'release-start-count';

/** This start's number: counted once per page load / cold start. */
const START = nextStartCount(load<unknown>(START_KEY, null));
save(START_KEY, START);
export const START_ID = String(START);

/** Read the record and apply the decision. Never throws. */
export async function checkRelease(): Promise<void> {
  const gate = useReleaseGate.getState();
  // A press of Update is in flight: keep what is on screen until it ends.
  if (gate.phase !== 'idle' && gate.phase !== 'failed') return;
  const latest = await fetchLatestRelease(env.releaseChannel);
  const record = latest.ok ? latest.record : null;
  const decision = decide({
    running: env.appVersion,
    record,
    stored: readStoredNotice(load<unknown>(NOTICE_KEY, null)),
    startId: START_ID,
    now: Date.now(),
  });
  if (decision.action === 'none' && decision.clearStored) remove(NOTICE_KEY);
  if (decision.action === 'notice') save(NOTICE_KEY, decision.store);
  useReleaseGate.getState().set({
    decision,
    record: latest.ok ? record : gate.record,
    readOk: latest.ok,
    lastChecked: Date.now(),
  });
}

/** Hide the normal-release notice for this start ("Later"). The next start blocks. */
export function dismissNotice(): void {
  const d = useReleaseGate.getState().decision;
  if (d?.action === 'notice') useReleaseGate.getState().set({ dismissed: d.version });
}

/** Wait until no preview or real run is live: a relaunch never cuts a run short. */
function runFinished(): Promise<void> {
  if (!isActive(useRun.getState())) return Promise.resolve();
  return new Promise((resolve) => {
    const off = useRun.subscribe((s) => {
      if (isActive(s)) return;
      off();
      resolve();
    });
  });
}

/**
 * The Update button on the block and the notice: layer 1 (check → download and
 * install → relaunch). Where the updater cannot run, the download page opens.
 */
export async function runUpdate(): Promise<void> {
  const set = useReleaseGate.getState().set;
  set({ phase: 'downloading', progress: 0 });
  try {
    const result = await updateNow((progress) => set({ progress }));
    if (result === 'unavailable') {
      await openExternal(RELEASES_URL);
      set({ phase: 'failed' });
      return;
    }
    if (isActive(useRun.getState())) {
      set({ phase: 'waitingRun', progress: 100 });
      await runFinished();
    }
    set({ phase: 'relaunching', progress: 100 });
    await relaunch();
  } catch (error) {
    logger.warn('required update failed', error instanceof Error ? error.message : String(error));
    set({ phase: 'failed' });
  }
}

/** Bind once (AppShell): after first paint, on every published release, on return. Returns the cleanup. */
export function bindReleaseGate(): () => void {
  const check = () => void checkRelease().catch((error: unknown) => logger.warn('release check failed', error instanceof Error ? error.message : String(error)));
  let first = 0;
  const frame = window.requestAnimationFrame(() => { first = window.setTimeout(check, 0); });
  const offRelease = onReleasePublished((release) => {
    if (!release || (release.platform === 'desktop' && release.channel === env.releaseChannel)) check();
  });
  const onReturn = () => {
    if (document.hidden) return;
    if (mayRecheck(useReleaseGate.getState().lastChecked, Date.now())) check();
  };
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);
  return () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(first);
    offRelease();
    document.removeEventListener('visibilitychange', onReturn);
    window.removeEventListener('focus', onReturn);
  };
}
