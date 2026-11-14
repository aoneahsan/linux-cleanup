/**
 * Update flow timing rules, pure (no clocks, no storage, no Tauri). Layer 1 checks
 * for a signed update at start and every 6 hours and, when automatic updates are
 * on, relaunches only at a quiet moment. Layer 2 counts starts so a normal release
 * seen at an earlier start blocks from the next one. The pre-approved test pins it.
 */
import { isSemver, type StoredNotice } from '@/lib/releaseGate';

/** Layer 1: how often the updater asks GitHub Releases. */
export const UPDATE_CHECK_EVERY_MS = 6 * 60 * 60_000;
/** Layer 1: the window must be hidden or unfocused this long before a quiet relaunch. */
export const QUIET_HIDDEN_MS = 2 * 60_000;
/** Layer 1: or the person must have been idle this long. */
export const QUIET_IDLE_MS = 10 * 60_000;
/** Layer 2: the release record is read this often while the app is open. */
export const GATE_CHECK_EVERY_MS = 15 * 60_000;
/** Layer 2: a window coming back re-reads the record at most once in this gap. */
export const GATE_FOCUS_GAP_MS = 60_000;

export interface QuietInput {
  /** A preview or real run is live: never relaunch under it. */
  runLive: boolean;
  /** When the window was last hidden or lost focus (epoch ms), or null while it is in front. */
  hiddenSince: number | null;
  /** The last pointer or key activity in the window (epoch ms). */
  lastActivity: number;
  now: number;
}

/**
 * True when an installed update may relaunch the app: no run is live, and the window
 * has been hidden or unfocused for 2 minutes, or nobody has touched it for 10.
 */
export function isQuietMoment({ runLive, hiddenSince, lastActivity, now }: QuietInput): boolean {
  if (runLive) return false;
  if (hiddenSince !== null && now - hiddenSince >= QUIET_HIDDEN_MS) return true;
  return now - lastActivity >= QUIET_IDLE_MS;
}

/** True when a recheck is allowed: never more than once per `gap` (focus and visibility). */
export function mayRecheck(lastCheck: number | null, now: number, gap = GATE_FOCUS_GAP_MS): boolean {
  return lastCheck === null || now - lastCheck >= gap;
}

/** This start's number from the stored count: the stored value plus one, or 1 when unreadable. */
export function nextStartCount(stored: unknown): number {
  return typeof stored === 'number' && Number.isSafeInteger(stored) && stored >= 0 ? stored + 1 : 1;
}

/**
 * Read a stored notice back from storage. Anything that is not a well-formed notice
 * reads as null, so a damaged value can never block (decide() clears an invalid version).
 */
export function readStoredNotice(raw: unknown): StoredNotice | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isSemver(r.version) || typeof r.reason !== 'string' || typeof r.startId !== 'string') return null;
  if (typeof r.storedAt !== 'number' || !Number.isFinite(r.storedAt)) return null;
  return { version: r.version, reason: r.reason, storedAt: r.storedAt, startId: r.startId };
}
