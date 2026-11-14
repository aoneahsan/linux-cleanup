/** Schedule names and specs kept on this Mac (the server mirror carries the cadence only). */
import { load } from '@/lib/storage';
import type { ScheduleSpec } from '@/lib/tauri';

export interface SavedSchedule { spec: ScheduleSpec; name: string; on: boolean }

/** Saved specs; specs saved before dayOfMonth existed read it as null. */
export const loadSavedSchedules = (): Record<string, SavedSchedule> =>
  Object.fromEntries(Object.entries(load<Record<string, SavedSchedule>>('schedules', {})).map(([k, v]) => [k, { ...v, spec: { ...v.spec, dayOfMonth: v.spec.dayOfMonth ?? null } }]));
