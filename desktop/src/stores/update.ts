/** App update state, written by the updater service (plugin-updater). */
import { create } from 'zustand';

export type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'offline' | 'endpoint' | 'signature' | 'error';

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  notes: string | null;
  progress: number;
  set: (patch: Partial<Omit<UpdateState, 'set'>>) => void;
}

export const useUpdateState = create<UpdateState>((set) => ({
  status: 'idle',
  version: null,
  notes: null,
  progress: 0,
  set: (patch) => set(patch),
}));
