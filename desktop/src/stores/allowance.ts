/**
 * The monthly real-run allowance, as the `allowance` function reports it
 * (CONTRACTS §3). Null until the server answers; previews never touch it.
 */
import { create } from 'zustand';

export interface Allowance {
  month: string;
  resets_at: string;
  device: { used: number; limit: number };
  account: { used: number; limit: number } | null;
  plan: { id: string; name: string; unlimited: boolean };
}

interface AllowanceState {
  allowance: Allowance | null;
  /** The server answered 403 device_owned: this device id belongs to another account. */
  deviceOwned: boolean;
  setAllowance: (a: Allowance | null) => void;
  setDeviceOwned: (v: boolean) => void;
}

export const useAllowance = create<AllowanceState>((set) => ({
  allowance: null,
  deviceOwned: false,
  setAllowance: (allowance) => set({ allowance }),
  setDeviceOwned: (deviceOwned) => set({ deviceOwned }),
}));

/** Runs left across every pool the user can use. */
export function runsLeft(a: Allowance): number {
  const device = Math.max(0, a.device.limit - a.device.used);
  const account = a.account ? Math.max(0, a.account.limit - a.account.used) : 0;
  return device + account;
}

/** Status-bar summary, or null before the server has answered. */
export function useAllowanceSummary(): { unlimited: boolean; left: number } | null {
  const a = useAllowance((s) => s.allowance);
  if (!a) return null;
  return { unlimited: a.plan.unlimited, left: runsLeft(a) };
}
