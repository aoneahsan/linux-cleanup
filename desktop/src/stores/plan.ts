/**
 * The plan travelling dry run → confirm. On Linux there is one plan: the all-safe cleanup
 * (section 0). The CLI decides every path itself (thresholds, protected roots); the desktop
 * shows its decisions and never edits them, so there are no per-path choices to store.
 */
import { create } from 'zustand';
import { ALL_SAFE } from '@/data/sections';
import { translate } from '@/i18n';

export interface RunPlan {
  sections: number[];
  name: string;
  profile: string | null;
}

/** The all-safe plan, named in the current language. */
export function allSafePlan(): RunPlan {
  return { sections: [ALL_SAFE], name: translate('sections.allSafe'), profile: null };
}

interface PlanState {
  plan: RunPlan;
  setPlan: (plan: RunPlan) => void;
}

export const usePlan = create<PlanState>((set) => ({
  plan: allSafePlan(),
  setPlan: (plan) => set({ plan }),
}));
