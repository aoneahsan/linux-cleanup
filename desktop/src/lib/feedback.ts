/**
 * Acknowledgement channel: announced toasts plus an opt-in soft tick (the sound
 * axis is off by default). Every control answers within 100 ms through these.
 */
import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const TOAST_MS = 4200;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message }].slice(-4) });
    window.setTimeout(() => get().dismiss(id), TOAST_MS);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

let audio: AudioContext | null = null;

/** A soft tick, only when the sound axis is on. */
export function click(): void {
  if (document.documentElement.dataset.sound !== 'on') return;
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.05, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.08);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.09);
  } catch {
    /* audio unavailable: the toast already acknowledged the action */
  }
}

/** Show a short announced message near the status bar. */
export function toast(message: string): void {
  useToasts.getState().push(message);
  click();
}
