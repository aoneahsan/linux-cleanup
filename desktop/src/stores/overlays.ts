/** Shell overlay state: the ⌘K palette and the page tour. */
import { create } from 'zustand';

interface OverlayState {
  paletteOpen: boolean;
  themeOpen: boolean;
  setThemeOpen: (open: boolean) => void;
  tourSteps: number;
  tourHint: boolean;
  tourStarter: (() => void) | null;
  openPalette: () => void;
  setPaletteOpen: (open: boolean) => void;
  registerTour: (steps: number, start: (() => void) | null, hint: boolean) => void;
  clearHint: () => void;
  startTour: () => void;
}

export const useOverlays = create<OverlayState>((set, get) => ({
  paletteOpen: false,
  themeOpen: false,
  setThemeOpen: (themeOpen) => set({ themeOpen, paletteOpen: false }),
  tourSteps: 0,
  tourHint: false,
  tourStarter: null,
  openPalette: () => set({ paletteOpen: true }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  registerTour: (tourSteps, tourStarter, tourHint) => set({ tourSteps, tourStarter, tourHint }),
  clearHint: () => set({ tourHint: false }),
  startTour: () => {
    set({ tourHint: false });
    get().tourStarter?.();
  },
}));
