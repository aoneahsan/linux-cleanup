/**
 * The sections the desktop runs, as facts the UI branches on. Words live in the i18n catalogue
 * (`sections.s<id>`). The linux-cleanup CLI exposes one cleanup to `--json-events`: the all-safe
 * run (section 0, `lib/events.ts` MODE_SECTION). Section 1 is the read-only scan.
 */
import type { Stamp } from '@/lib/events';

export type Tier = 'routine' | 'trash' | 'permanent' | 'read';

/** The all-safe cleanup: regenerable caches and logs, past their thresholds, outside protected paths. */
export const ALL_SAFE = 0;
/** The read-only survey of the paths the CLI checks. */
export const SCAN = 1;

export const SECTION_IDS: readonly number[] = [ALL_SAFE];

/** Recovery tier per section: the CLI stamps the all-safe run `routine` (caches that regenerate). */
export const TIER: Record<number, Tier> = { [ALL_SAFE]: 'routine', [SCAN]: 'read' };

/** The tier for a section: the CLI's stamp when it sent one, else the registry. */
export function tierFor(id: number, stamp?: Stamp): Tier {
  return stamp ?? TIER[id] ?? 'read';
}

/** The only sections a scheduled cleanup may hold. */
export const SAFE_BATCH: readonly number[] = [ALL_SAFE];

/** True when a cleanup schedule may hold every one of these sections. */
export const allSafe = (ids: readonly number[]): boolean => ids.every((id) => SAFE_BATCH.includes(id));
