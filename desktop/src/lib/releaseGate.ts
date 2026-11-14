/**
 * Update flow, layer 2: the pure gate decision (skill aoneahsan-cccs-update-flow,
 * references/contract.md). No I/O, no clocks, no storage: the caller passes the running
 * version, the release record it read (or null when the read failed or found nothing),
 * the notice it stored earlier, and this start's id. The pre-approved test pins it.
 *
 * | Record            | Running vs record | Stored notice                     | Result             |
 * |-------------------|-------------------|-----------------------------------|--------------------|
 * | none / failed     | -                 | none, or stored this start        | none (fail open)   |
 * | none / failed     | below stored      | stored by an EARLIER start        | block              |
 * | any               | running >= record | any                               | none; clear stored |
 * | urgent            | older             | -                                 | block now          |
 * | normal            | older             | none, or stored this start        | notice; store it   |
 * | normal            | older             | stored by an earlier start, unmet | block              |
 *
 * An invalid version anywhere is never a block: a bad record counts as no record, a bad
 * stored notice is cleared, and a running version that is not x.y.z fails open.
 */

export type ReleaseSeverity = 'urgent' | 'normal';

/** The release record as the client reads it from `latest_app_releases`. */
export interface ReleaseRecord {
  version: string;
  severity: ReleaseSeverity;
  reason: string;
  minNativeVersion?: string | null;
}

/** The normal-release notice kept in the device area of strata-storage. */
export interface StoredNotice {
  version: string;
  reason: string;
  storedAt: number;
  /** The start (page load / cold start) that stored it; another start id means a new start. */
  startId: string;
}

export interface GateInput {
  running: string;
  record: ReleaseRecord | null;
  stored: StoredNotice | null;
  /** This start's id: a module-level value created once per page load or cold start. */
  startId: string;
  /** When the notice would be stored (epoch ms); passed in so this stays pure. */
  now: number;
}

export type GateDecision =
  | { action: 'none'; clearStored: boolean }
  | { action: 'notice'; version: string; reason: string; store: StoredNotice }
  | { action: 'block'; version: string; reason: string; severity: ReleaseSeverity };

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** True for a strict `x.y.z` version (digits only, no leading zeros, no prerelease). */
export function isSemver(value: unknown): value is string {
  return typeof value === 'string' && SEMVER.test(value);
}

/** Compare two digit strings of any length without converting them to numbers. */
function compareDigits(a: string, b: string): number {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

/**
 * Compare two strict semver versions: -1, 0 or 1. Returns null when either is invalid,
 * so a caller can never mistake garbage for "older".
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 | null {
  if (!isSemver(a) || !isSemver(b)) return null;
  const pa = a.split('.');
  const pb = b.split('.');
  for (let i = 0; i < 3; i++) {
    const c = compareDigits(pa[i] as string, pb[i] as string);
    if (c !== 0) return c < 0 ? -1 : 1;
  }
  return 0;
}

const none = (clearStored: boolean): GateDecision => ({ action: 'none', clearStored });

/** Decide what the gate shows now: nothing, the normal-release notice, or the block. */
export function decide({ running, record, stored, startId, now }: GateInput): GateDecision {
  if (!isSemver(running)) return none(false);

  // A stored notice that is unreadable, or already met by this build, is cleared.
  const storedValid = stored !== null && isSemver(stored.version);
  const storedUnmet = storedValid && compareSemver(running, stored.version) === -1;
  const storedEarlier = storedUnmet && stored.startId !== startId;
  const clear = stored !== null && !storedUnmet;

  const validRecord = record !== null && isSemver(record.version)
    && (record.severity === 'urgent' || record.severity === 'normal') ? record : null;

  if (!validRecord) {
    // Offline or nothing published: fail open, unless a known release is already due.
    if (storedEarlier) return { action: 'block', version: stored.version, reason: stored.reason, severity: 'normal' };
    return none(clear);
  }

  if (compareSemver(running, validRecord.version) !== -1) return none(stored !== null);

  if (validRecord.severity === 'urgent') {
    return { action: 'block', version: validRecord.version, reason: validRecord.reason, severity: 'urgent' };
  }

  // A normal release known since an earlier start, and still unmet, blocks from this start.
  if (storedEarlier) return { action: 'block', version: stored.version, reason: stored.reason, severity: 'normal' };

  const keep = storedUnmet && stored.startId === startId && stored.version === validRecord.version;
  const store: StoredNotice = keep
    ? stored
    : { version: validRecord.version, reason: validRecord.reason, storedAt: now, startId };
  return { action: 'notice', version: validRecord.version, reason: validRecord.reason, store };
}
