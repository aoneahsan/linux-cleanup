/**
 * The one parser for the macleanup `--json-events` NDJSON stream (schema v1,
 * `macleanup/docs/json-events.md`). Pure: it folds parsed event objects into a
 * run state. No I/O, no clocks, no React — so the pre-approved test can pin it.
 */

export const SCHEMA_VERSION = 1;

/** Item lists are kept per section up to this many rows; the count stays exact. */
export const ITEM_CAP = 2000;

export type Stamp = 'routine' | 'trash' | 'permanent' | 'read';
export type ItemAction = 'delete' | 'trash' | 'archive' | 'report' | 'skip';
export type SectionStatus = 'completed' | 'skipped' | 'failed';
export type SectionState = 'pending' | 'running' | SectionStatus;

export interface PlannedSection {
  id: number;
  title: string;
  stamp: Stamp;
  sudo: boolean;
  deep: boolean;
}

export interface DiskReading {
  totalKb: number;
  freeKb: number;
  purgeableKb: number | null;
  snapshots: number;
  snapshotNote: boolean;
}

export interface RunItem {
  path: string;
  kb: number;
  action: ItemAction;
  unique: boolean;
  /** 5.2.0+: days since last opened or changed; null when unknown or not sent. */
  ageDays: number | null;
  /** 5.2.0+: section 0's toolchain inventory names the tool and its version. */
  tool?: string;
  version?: string;
}

export interface SectionRun extends PlannedSection {
  state: SectionState;
  items: RunItem[];
  itemCount: number;
  plannedKb: number;
  done: number;
  total: number | null;
  freedKb: number;
  reason: string | null;
}

export interface RunSummary {
  attempted: number[];
  completed: number[];
  skipped: number[];
  failed: number[];
  freedKb: number;
  diskFreeBeforeKb: number;
  diskFreeAfterKb: number;
  elapsedS: number;
  reports: string[];
  log: string | null;
  dryRun: boolean;
}

export type RunPhase = 'waiting' | 'running' | 'finished' | 'interrupted' | 'refused';

export interface RunState {
  phase: RunPhase;
  version: string | null;
  dryRun: boolean | null;
  profile: string | null;
  order: number[];
  sections: Record<number, SectionRun>;
  current: number | null;
  diskBefore: DiskReading | null;
  diskAfter: DiskReading | null;
  errors: { id: number | null; message: string }[];
  summary: RunSummary | null;
  /** Set when the stream announced a schema major version this app does not know. */
  refusedVersion: number | null;
  lastTs: number | null;
}

/** The reason the schema requires for a section a stream never finished. */
export const INTERRUPTED_REASON = 'interrupted';

/** A fresh, empty run state. */
export function initialRunState(): RunState {
  return {
    phase: 'waiting',
    version: null,
    dryRun: null,
    profile: null,
    order: [],
    sections: {},
    current: null,
    diskBefore: null,
    diskAfter: null,
    errors: [],
    summary: null,
    refusedVersion: null,
    lastTs: null,
  };
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

const STAMPS: readonly Stamp[] = ['routine', 'trash', 'permanent', 'read'];
const ACTIONS: readonly ItemAction[] = ['delete', 'trash', 'archive', 'report', 'skip'];
const FREES_SPACE: ReadonlySet<ItemAction> = new Set<ItemAction>(['delete', 'trash']);
const STATUSES: readonly SectionStatus[] = ['completed', 'skipped', 'failed'];

function asStamp(v: unknown): Stamp {
  return STAMPS.includes(v as Stamp) ? (v as Stamp) : 'read';
}

function blankSection(id: number, title = '', stamp: Stamp = 'read'): SectionRun {
  return {
    id, title, stamp, sudo: false, deep: false, state: 'pending', items: [], itemCount: 0,
    plannedKb: 0, done: 0, total: null, freedKb: 0, reason: null,
  };
}

function disk(e: Obj): DiskReading {
  return {
    totalKb: num(e.total_kb),
    freeKb: num(e.free_kb),
    purgeableKb: numOrNull(e.purgeable_kb),
    snapshots: num(e.snapshots),
    snapshotNote: e.snapshot_note === true,
  };
}

/** Return a copy of the state with one section replaced (or created when absent). */
function withSection(s: RunState, id: number, patch: (sec: SectionRun) => SectionRun): RunState {
  const existing = s.sections[id] ?? blankSection(id);
  const order = s.order.includes(id) ? s.order : [...s.order, id];
  return { ...s, order, sections: { ...s.sections, [id]: patch(existing) } };
}

/**
 * Fold one parsed event object into the run state. Unknown types and unknown
 * fields are ignored, as the schema requires; a higher major `v` refuses the run.
 */
export function foldEvent(state: RunState, event: unknown): RunState {
  if (!isObj(event) || state.phase === 'refused' || state.phase === 'finished') return state;
  const v = num(event.v, SCHEMA_VERSION);
  if (v > SCHEMA_VERSION) return { ...state, phase: 'refused', refusedVersion: v };
  const s: RunState = { ...state, lastTs: numOrNull(event.ts) ?? state.lastTs };
  const id = num(event.id, -1);

  switch (event.type) {
    case 'plan': {
      const planned = Array.isArray(event.sections) ? event.sections.filter(isObj) : [];
      const sections: Record<number, SectionRun> = {};
      const order: number[] = [];
      for (const p of planned) {
        const pid = num(p.id, -1);
        if (pid < 0) continue;
        order.push(pid);
        sections[pid] = {
          ...blankSection(pid, str(p.title) ?? '', asStamp(p.stamp)),
          sudo: p.sudo === true,
          deep: p.deep === true,
        };
      }
      return {
        ...s, phase: 'running', version: str(event.version), dryRun: event.dry_run === true,
        profile: str(event.profile), order, sections,
      };
    }
    case 'disk':
      return event.phase === 'after' ? { ...s, diskAfter: disk(event) } : { ...s, diskBefore: disk(event) };
    case 'section_start':
      if (id < 0) return s;
      return {
        ...withSection(s, id, (sec) => ({
          ...sec, state: 'running', title: str(event.title) ?? sec.title,
          stamp: event.stamp === undefined ? sec.stamp : asStamp(event.stamp),
        })),
        current: id,
      };
    case 'item': {
      if (id < 0) return s;
      const action = ACTIONS.includes(event.action as ItemAction) ? (event.action as ItemAction) : 'report';
      const item: RunItem = { path: str(event.path) ?? '', kb: num(event.kb), action, unique: event.unique === true, ageDays: numOrNull(event.age_days) };
      const tool = str(event.tool);
      const version = str(event.version);
      if (tool) item.tool = tool;
      if (version) item.version = version;
      return withSection(s, id, (sec) => ({
        ...sec,
        items: sec.items.length < ITEM_CAP ? [...sec.items, item] : sec.items,
        itemCount: sec.itemCount + 1,
        // Only removals free space: report and skip items change nothing, and an archive
        // item is followed by the delete of the same path, which carries the size.
        plannedKb: sec.plannedKb + (FREES_SPACE.has(item.action) ? item.kb : 0),
      }));
    }
    case 'progress':
      if (id < 0) return s;
      return withSection(s, id, (sec) => ({ ...sec, done: num(event.done, sec.done), total: numOrNull(event.total) }));
    case 'section_result': {
      if (id < 0) return s;
      const status = STATUSES.includes(event.status as SectionStatus) ? (event.status as SectionStatus) : 'failed';
      return {
        ...withSection(s, id, (sec) => ({
          ...sec, state: status, freedKb: num(event.freed_kb), reason: str(event.reason),
          itemCount: Math.max(sec.itemCount, num(event.items, sec.itemCount)),
          // In a preview, freed_kb is the script's own estimate for the section; some
          // sections estimate whole folders without naming each path, so it can exceed
          // the sum of the listed items. Show the larger, never the smaller.
          plannedKb: s.dryRun ? Math.max(sec.plannedKb, num(event.freed_kb)) : sec.plannedKb,
        })),
        current: s.current === id ? null : s.current,
      };
    }
    case 'error':
      return { ...s, errors: [...s.errors, { id: id < 0 ? null : id, message: str(event.message) ?? '' }] };
    case 'summary':
      return {
        ...s, phase: 'finished', current: null,
        summary: {
          attempted: ids(event.attempted), completed: ids(event.completed), skipped: ids(event.skipped),
          failed: ids(event.failed), freedKb: num(event.freed_kb),
          diskFreeBeforeKb: num(event.disk_free_before_kb), diskFreeAfterKb: num(event.disk_free_after_kb),
          elapsedS: num(event.elapsed_s), reports: strs(event.reports), log: str(event.log),
          dryRun: event.dry_run === true,
        },
      };
    default:
      return s;
  }
}

/**
 * Close a stream whose process has exited. Without a `summary` the run was
 * interrupted: every section lacking a `section_result` becomes failed with
 * reason "interrupted".
 */
export function finishStream(state: RunState): RunState {
  if (state.phase === 'finished' || state.phase === 'refused') return state;
  const sections: Record<number, SectionRun> = {};
  for (const id of state.order) {
    const sec = state.sections[id];
    if (!sec) continue;
    const open = sec.state === 'pending' || sec.state === 'running';
    sections[id] = open ? { ...sec, state: 'failed', reason: INTERRUPTED_REASON } : sec;
  }
  return { ...state, phase: 'interrupted', current: null, sections };
}

/** Parse NDJSON text (one or more lines) and fold every valid line. Bad lines are skipped. */
export function foldLines(state: RunState, text: string): RunState {
  let next = state;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      next = foldEvent(next, JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return next;
}

/** Totals for a receipt, from the summary when present, else from section results. */
export function tally(state: RunState): { attempted: number; completed: number; skipped: number; failed: number } {
  if (state.summary) {
    const { attempted, completed, skipped, failed } = state.summary;
    return { attempted: attempted.length, completed: completed.length, skipped: skipped.length, failed: failed.length };
  }
  const secs = state.order.map((id) => state.sections[id]).filter((x): x is SectionRun => Boolean(x));
  return {
    attempted: secs.length,
    completed: secs.filter((x) => x.state === 'completed').length,
    skipped: secs.filter((x) => x.state === 'skipped').length,
    failed: secs.filter((x) => x.state === 'failed').length,
  };
}
