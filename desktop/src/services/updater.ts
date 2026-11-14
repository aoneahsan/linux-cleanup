/**
 * App updates through plugin-updater (signed, GitHub Releases), update flow layer 1.
 * A failed check never blocks a run: it lands in the named `offline` state and
 * nothing else. The schedule (start + every 6 hours, quiet relaunch) is
 * `@/services/autoUpdate`; the release gate's Update button is `updateNow()`.
 */
import type { Update } from '@tauri-apps/plugin-updater';
import { useUpdateState } from '@/stores/update';
import { isTauri } from '@/lib/tauri';
import { logger } from '@/lib/logger';
import { load, save } from '@/lib/storage';

let pending: Update | null = null;

/** Name the failure: offline, a bad endpoint answer, a signature mismatch, or anything else. */
export function failureKind(error: unknown): 'offline' | 'endpoint' | 'signature' | 'error' {
  const msg = error instanceof Error ? error.message : String(error);
  if (/signature|minisign|public key/i.test(msg)) return 'signature';
  if (/status code|endpoint|404|403|500|json|parse|invalid.*manifest/i.test(msg)) return 'endpoint';
  if (!navigator.onLine || /network|dns|connect|timed? ?out|offline|error sending request|unreachable/i.test(msg)) return 'offline';
  return 'error';
}

/** Check for a signed update. */
export async function checkForUpdate(): Promise<void> {
  const set = useUpdateState.getState().set;
  if (!isTauri()) return;
  set({ status: 'checking' });
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    save('update-last-check', Date.now());
    pending = await check();
    if (pending) set({ status: 'available', version: pending.version, notes: pending.body ?? null });
    else set({ status: 'current', version: null });
  } catch (error) {
    save('update-last-check', Date.now());
    logger.warn('update check failed', error instanceof Error ? error.message : String(error));
    set({ status: failureKind(error) });
  }
}

/** Download and install the pending update, reporting progress. */
export async function installUpdate(): Promise<void> {
  const set = useUpdateState.getState().set;
  if (!pending) return;
  let total = 0;
  let got = 0;
  set({ status: 'downloading', progress: 0 });
  try {
    await pending.downloadAndInstall((e) => {
      if (e.event === 'Started') total = e.data.contentLength ?? 0;
      if (e.event === 'Progress') {
        got += e.data.chunkLength;
        set({ progress: total ? Math.min(100, (got / total) * 100) : 0 });
      }
    });
    set({ status: 'ready', progress: 100 });
  } catch (error) {
    logger.warn('update install failed', error instanceof Error ? error.message : String(error));
    const kind = failureKind(error);
    set({ status: kind === 'offline' ? 'offline' : kind });
  }
}

/** The public download page: the fallback when the in-app update cannot run. */
export const RELEASES_URL = 'https://github.com/aoneahsan/macleanup/releases/latest';

/**
 * The release gate's Update: check → download and install → (caller relaunches).
 * Reuses an update already found or installed. `unavailable` means the updater
 * cannot do it here (not the desktop app, or GitHub offers nothing newer), so the
 * caller opens the download page instead. Errors are thrown for the failed state.
 */
export async function updateNow(onProgress: (pct: number) => void): Promise<'installed' | 'unavailable'> {
  if (!isTauri()) return 'unavailable';
  const st = useUpdateState.getState();
  if (st.status === 'ready') return 'installed';
  if (!pending) {
    const { check } = await import('@tauri-apps/plugin-updater');
    pending = await check();
    save('update-last-check', Date.now());
  }
  if (!pending) return 'unavailable';
  st.set({ status: 'available', version: pending.version, notes: pending.body ?? null });
  let total = 0;
  let got = 0;
  st.set({ status: 'downloading', progress: 0 });
  try {
    await pending.downloadAndInstall((e) => {
      if (e.event === 'Started') total = e.data.contentLength ?? 0;
      if (e.event === 'Progress') {
        got += e.data.chunkLength;
        const pct = total ? Math.min(100, (got / total) * 100) : 0;
        st.set({ progress: pct });
        onProgress(pct);
      }
    });
  } catch (error) {
    const kind = failureKind(error);
    st.set({ status: kind });
    throw error;
  }
  st.set({ status: 'ready', progress: 100 });
  return 'installed';
}

/** Relaunch onto the installed version. */
export async function relaunch(): Promise<void> {
  const { relaunch: go } = await import('@tauri-apps/plugin-process');
  await go();
}

/** When the last check ran (ms), or null. */
export const lastCheck = (): number | null => load<number | null>('update-last-check', null);
