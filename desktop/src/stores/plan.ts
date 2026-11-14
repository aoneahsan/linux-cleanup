/**
 * The selection on the Sections screen and the plan travelling preview → confirm.
 * Ledger decisions for unique rows are keyed by `<section>:<path>`.
 */
import { create } from 'zustand';
import { load, save } from '@/lib/storage';
import { SAFE_BATCH } from '@/data/sections';

export type Decision = 'keep' | 'archive' | 'delete';

export interface RunPlan {
  sections: number[];
  name: string;
  profile: string | null;
}

export interface SavedProfile {
  id: string;
  name: string;
  sections: number[];
}

interface PlanState {
  selection: number[];
  plan: RunPlan | null;
  decisions: Record<string, Decision>;
  saved: SavedProfile[];
  overviewProfile: string;
  setOverviewProfile: (id: string) => void;
  setSelection: (ids: number[]) => void;
  toggle: (id: number) => void;
  setPlan: (plan: RunPlan) => void;
  decide: (key: string, d: Decision) => void;
  decideMany: (keys: string[], d: Decision) => void;
  saveProfile: (name: string, sections: number[]) => void;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
}

const sorted = (ids: number[]) => [...new Set(ids)].sort((a, b) => a - b);

export const decisionKey = (section: number, path: string): string => `${section}:${path}`;

export const usePlan = create<PlanState>((set, get) => ({
  selection: load<number[]>('selection', [...SAFE_BATCH]),
  plan: load<RunPlan | null>('run-plan', null),
  decisions: load<Record<string, Decision>>('ledger-decisions', {}),
  saved: load<SavedProfile[]>('saved-profiles', []),
  overviewProfile: load<string>('profile', 'dev'),
  setOverviewProfile: (overviewProfile) => {
    save('profile', overviewProfile);
    set({ overviewProfile });
  },
  setSelection: (ids) => {
    const selection = sorted(ids);
    save('selection', selection);
    set({ selection });
  },
  toggle: (id) => {
    const cur = get().selection;
    get().setSelection(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  },
  setPlan: (plan) => {
    // Decisions are keyed by section and path, so they stay valid across plans.
    const next = { ...plan, sections: sorted(plan.sections) };
    save('run-plan', next);
    set({ plan: next });
  },
  decide: (key, d) => {
    const decisions = { ...get().decisions, [key]: d };
    save('ledger-decisions', decisions);
    set({ decisions });
  },
  decideMany: (keys, d) => {
    const decisions = { ...get().decisions };
    for (const k of keys) decisions[k] = d;
    save('ledger-decisions', decisions);
    set({ decisions });
  },
  saveProfile: (name, sections) => {
    const saved = [...get().saved, { id: `c${Date.now()}`, name, sections: sorted(sections) }];
    save('saved-profiles', saved);
    set({ saved });
  },
  renameProfile: (id, name) => {
    const saved = get().saved.map((p) => (p.id === id ? { ...p, name } : p));
    save('saved-profiles', saved);
    set({ saved });
  },
  deleteProfile: (id) => {
    const saved = get().saved.filter((p) => p.id !== id);
    save('saved-profiles', saved);
    set({ saved });
  },
}));
