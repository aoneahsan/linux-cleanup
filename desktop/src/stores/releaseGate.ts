/**
 * What the release gate (update flow layer 2) shows right now, written only by
 * `@/services/releaseCheck`. The decision itself is the pure `decide()`.
 */
import { create } from 'zustand';
import type { GateDecision, ReleaseRecord } from '@/lib/releaseGate';

/** The Update action's progress on the block or the notice. */
export type GatePhase = 'idle' | 'downloading' | 'waitingRun' | 'relaunching' | 'failed';

interface ReleaseGateState {
  decision: GateDecision | null;
  /** The newest record the last successful read returned (null: none published, or not read yet). */
  record: ReleaseRecord | null;
  /** True when the last read reached the server. */
  readOk: boolean;
  lastChecked: number | null;
  /** The version whose notice "Later" hid for this start. */
  dismissed: string | null;
  phase: GatePhase;
  progress: number;
  set: (patch: Partial<Omit<ReleaseGateState, 'set'>>) => void;
}

export const useReleaseGate = create<ReleaseGateState>((set) => ({
  decision: null,
  record: null,
  readOk: false,
  lastChecked: null,
  dismissed: null,
  phase: 'idle',
  progress: 0,
  set: (patch) => set(patch),
}));
