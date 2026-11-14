/**
 * This window's assistant conversation. Kept in memory only: a question is the
 * person's own words, so it is never written to storage or sent anywhere but the
 * ask itself. Leaving and coming back to the screen keeps it; quitting clears it.
 */
import { create } from 'zustand';
import type { AssistantLevel } from '@/services/assistant';

export interface Exchange {
  id: number;
  q: string;
  a: string | null;
  sources: string[];
  level: AssistantLevel;
}

const KEEP = 8;
let nextId = 1;

interface AssistantState {
  history: Exchange[];
  /** Add a question awaiting its answer; returns its id. */
  ask: (q: string, level: AssistantLevel) => number;
  answer: (id: number, a: string, sources: string[], level: AssistantLevel) => void;
  drop: (id: number) => void;
  clear: () => void;
}

export const useAssistant = create<AssistantState>((set, get) => ({
  history: [],
  ask: (q, level) => {
    const id = nextId++;
    set({ history: [...get().history, { id, q, a: null, sources: [], level }].slice(-KEEP) });
    return id;
  },
  answer: (id, a, sources, level) => set({ history: get().history.map((x) => (x.id === id ? { ...x, a, sources, level } : x)) }),
  drop: (id) => set({ history: get().history.filter((x) => x.id !== id) }),
  clear: () => set({ history: [] }),
}));
