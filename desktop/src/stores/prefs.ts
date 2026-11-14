/**
 * Small device-local flags (legal bar seen, tours seen, onboarding done), each
 * persisted through strata-storage under its own key.
 */
import { create } from 'zustand';
import { load, save } from '@/lib/storage';

interface PrefsState {
  legalSeen: boolean;
  onboarded: boolean;
  toursSeen: Record<string, boolean>;
  markLegalSeen: () => void;
  markOnboarded: () => void;
  markTourSeen: (page: string) => void;
  mergeToursSeen: (remote: Record<string, boolean>) => void;
}

/** Device-local preference flags. */
export const usePrefs = create<PrefsState>((set, get) => ({
  legalSeen: load('legal-seen', false),
  onboarded: load('onboarded', false),
  toursSeen: load<Record<string, boolean>>('tours-seen', {}),
  markLegalSeen: () => {
    save('legal-seen', true);
    set({ legalSeen: true });
  },
  markOnboarded: () => {
    save('onboarded', true);
    set({ onboarded: true });
  },
  mergeToursSeen: (remote) => {
    const toursSeen = { ...get().toursSeen, ...remote };
    save('tours-seen', toursSeen);
    set({ toursSeen });
  },
  markTourSeen: (page) => {
    const toursSeen = { ...get().toursSeen, [page]: true };
    save('tours-seen', toursSeen);
    set({ toursSeen });
  },
}));
