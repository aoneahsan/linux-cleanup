/**
 * The 28 macleanup sections: id, recovery tier and shelf. Words live in the i18n
 * catalogue (`sections.s<id>`); this file carries only facts the UI branches on.
 */
import type { Stamp } from '@/lib/events';

export type Tier = 'routine' | 'trash' | 'permanent' | 'read';
export type ShelfId = 'dev' | 'caches' | 'storage' | 'system' | 'reports';
export type ProfileId = 'dev' | 'minimal' | 'cache-only' | 'audit' | 'deep';

export const SECTION_IDS: readonly number[] = Array.from({ length: 28 }, (_, i) => i);

/** Recovery tier per section, from the docs page "What gets deleted". */
export const TIER: Record<number, Tier> = {
  0: 'read', 1: 'routine', 2: 'routine', 3: 'routine', 4: 'routine', 5: 'routine', 6: 'routine', 7: 'routine',
  8: 'routine', 9: 'routine', 10: 'permanent', 11: 'permanent', 12: 'trash', 13: 'read', 14: 'permanent',
  15: 'read', 16: 'permanent', 17: 'permanent', 18: 'read', 19: 'routine', 20: 'read', 21: 'trash', 22: 'read',
  23: 'permanent', 24: 'trash', 25: 'permanent', 26: 'read', 27: 'routine',
};

/** The tier for a section: the CLI's stamp when it sent one, else the registry. */
export function tierFor(id: number, stamp?: Stamp): Tier {
  return stamp ?? TIER[id] ?? 'read';
}

/** The safe batch: the only sections a scheduled cleanup may hold (CONTRACTS §2). */
export const SAFE_BATCH: readonly number[] = [0, 3, 5, 7, 8, 9, 15, 18, 22, 26];

/** Sections the CLI itself treats as deep: a real run needs `deepOk`. */
export const CLI_DEEP: readonly number[] = [6, 10, 11, 14, 21, 24];

/**
 * Sections that need the typed confirmation before a real run: the union of the
 * approved dummy's list (10 11 14 16 17 23 25) and the CLI's deep set.
 */
export const DEEP_CONFIRM: readonly number[] = [6, 10, 11, 14, 16, 17, 21, 23, 24, 25];

/** Sections that need an administrator password. */
export const SUDO: readonly number[] = [6, 7, 11, 13, 14, 20, 25];

export const SHELVES: readonly { id: ShelfId; sections: readonly number[] }[] = [
  { id: 'dev', sections: [1, 2, 3, 4, 17, 23] },
  { id: 'caches', sections: [5, 6, 7, 8, 9, 14, 19] },
  { id: 'storage', sections: [10, 11, 12, 16, 21, 22, 24] },
  { id: 'system', sections: [0, 13, 20, 25, 27] },
  { id: 'reports', sections: [15, 18, 26] },
];

export const PROFILES: readonly { id: ProfileId; sections: readonly number[] }[] = [
  { id: 'dev', sections: [1, 2, 3, 4, 23] },
  { id: 'minimal', sections: [5, 7, 8, 9] },
  { id: 'cache-only', sections: [3, 5, 6, 7, 9, 19] },
  { id: 'audit', sections: [0, 12, 18, 21, 25, 26] },
  { id: 'deep', sections: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 17, 19, 23, 26] },
];

/** True when a real run of these sections needs the typed confirmation. */
export const needsTypedConfirm = (ids: readonly number[]): boolean => ids.some((id) => DEEP_CONFIRM.includes(id));

/** True when the CLI needs `deepOk` for a real run of these sections. */
export const needsDeepOk = (ids: readonly number[]): boolean => ids.some((id) => CLI_DEEP.includes(id));

/** True when a cleanup schedule may hold every one of these sections. */
export const allSafe = (ids: readonly number[]): boolean => ids.every((id) => SAFE_BATCH.includes(id));
