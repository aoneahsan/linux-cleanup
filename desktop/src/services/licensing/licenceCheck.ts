/**
 * The dormant white-label licence check. Our own builds leave `VITE_WHITE_LABEL_KEY`
 * empty, so nothing here runs and no request is made. A branded build we ship for a
 * licence holder carries its key and checks it once at start and once each time the
 * window comes back (never on a timer). A revoked or unknown key shows the inactive
 * view; a network failure, a timeout or a server error leaves the app working and the
 * next start tries again. The answer lives only in memory.
 *
 * The desktop webview has no domain of its own, so no `host` is sent: the key is
 * the licence's proof here.
 */
import { create } from 'zustand';

const VERIFY_API = 'https://fileshub.zaions.com/api/licensing/v1/licenses/verify';
/** Our public page where anyone can check a licence key. */
export const VERIFY_PAGE = 'https://linux-cleanup.aoneahsan.com/verify-license';
const TIMEOUT_MS = 5000;
/** Verdicts that mean the build is not covered by an active licence. */
const INACTIVE = new Set(['revoked', 'not_found', 'invalid_format']);

const key = (import.meta.env.VITE_WHITE_LABEL_KEY ?? '').trim();

/** True only in a white-label build. */
export const licenceCheckEnabled = key.length > 0;

interface LicenceState {
  inactive: boolean;
  set: (inactive: boolean) => void;
}

export const useLicence = create<LicenceState>((set) => ({ inactive: false, set: (inactive) => set({ inactive }) }));

/** The verify page for this build's key. */
export const verifyPageUrl = (): string => `${VERIFY_PAGE}?key=${encodeURIComponent(key)}`;

/** One verify call. Fails open: only a clear verdict changes what is shown. */
export async function checkLicence(): Promise<void> {
  if (!licenceCheckEnabled) return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${VERIFY_API}?key=${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status >= 500) return;
    const body = (await res.json()) as { data?: { verdict?: string } };
    const verdict = body.data?.verdict;
    if (typeof verdict === 'string') useLicence.getState().set(INACTIVE.has(verdict));
  } catch {
    // Offline, timed out or unreadable: keep working and check again on the next start.
  } finally {
    window.clearTimeout(timer);
  }
}

/** Check at start and when the window returns. Returns the unbind for the shell's effect. */
export function bindLicenceCheck(): () => void {
  if (!licenceCheckEnabled) return () => undefined;
  void checkLicence();
  const onReturn = () => { if (document.visibilityState === 'visible') void checkLicence(); };
  document.addEventListener('visibilitychange', onReturn);
  return () => document.removeEventListener('visibilitychange', onReturn);
}
