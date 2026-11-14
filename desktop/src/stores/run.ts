/**
 * The one active CLI run (preview or real). Events from Rust are folded by the
 * pure parser in `@/lib/events`; this store only routes them by runId.
 */
import { create } from 'zustand';
import { finishStream, foldEvent, initialRunState, tally, type RunState } from '@/lib/events';
import { track } from '@/services/analytics';
import { commands, subscribe, toAppError, type AppError, type RunCliArgs } from '@/lib/tauri';
import { logger } from '@/lib/logger';
import { useReceipts, type Receipt } from '@/stores/receipts';
import { afterRun } from '@/services/afterRun';

export interface RunRequest {
  /** Always [0] on Linux: the all-safe cleanup is the one section the CLI streams. */
  sections: number[];
  dryRun: boolean;
  profile: string | null;
  /** Display name, e.g. "All-safe cleanup" or a schedule's name. */
  name: string;
  /** Allowance claim id for a real run (null for dry runs). */
  claimId: string | null;
  /** Set when the run came from a schedule (a `schedules_meta` row this account owns). */
  schedule?: { id: string; name: string; ranAt: number; nextAt: number | null };
}

interface RunStore {
  request: RunRequest | null;
  runId: string | null;
  state: RunState;
  stderr: string[];
  exitCode: number | null;
  cancelled: boolean;
  startError: AppError | null;
  sheetOpen: boolean;
  startedAt: number | null;
  /** The receipt written when this run ended. */
  receipt: Receipt | null;
  start: (req: RunRequest, opts?: { sheet?: boolean }) => Promise<string | null>;
  cancel: () => Promise<void>;
  setSheetOpen: (open: boolean) => void;
  reset: () => void;
}

const STDERR_CAP = 400;

export const useRun = create<RunStore>((set, get) => ({
  request: null,
  runId: null,
  state: initialRunState(),
  stderr: [],
  exitCode: null,
  cancelled: false,
  startError: null,
  sheetOpen: false,
  startedAt: null,
  receipt: null,
  start: async (req, opts) => {
    if (isActive(get())) return null;
    set({
      request: req, runId: null, state: initialRunState(), stderr: [], exitCode: null, cancelled: false,
      startError: null, sheetOpen: opts?.sheet ?? get().sheetOpen, startedAt: Date.now(), receipt: null,
    });
    try {
      const args: RunCliArgs = { mode: 'allsafe', dryRun: req.dryRun };
      const runId = await commands.runCli(args);
      set({ runId });
      track(req.dryRun ? 'preview_started' : 'run_started', { sections: req.sections.length });
      return runId;
    } catch (error) {
      set({ startError: toAppError(error), state: finishStream(get().state) });
      return null;
    }
  },
  cancel: async () => {
    const { runId } = get();
    if (!runId) return;
    try {
      await commands.cancelRun(runId);
    } catch (error) {
      logger.warn('cancel_run failed', toAppError(error).kind);
    }
  },
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  reset: () => {
    if (isActive(get())) return;
    set({ request: null, runId: null, state: initialRunState(), stderr: [], exitCode: null, cancelled: false, startError: null, startedAt: null, receipt: null });
  },
}));

/** True while a run has started and not exited. */
export function isActive(s: Pick<RunStore, 'request' | 'exitCode' | 'startError' | 'state'>): boolean {
  return s.request !== null && s.exitCode === null && s.startError === null && s.state.phase !== 'interrupted' && s.state.phase !== 'refused';
}

/** Wire the Rust run events into the store. Mount once (AppShell). Returns the cleanup. */
export function bindRunEvents(): () => void {
  const offs = [
    subscribe('cli-event', ({ runId, line }) => {
      const s = useRun.getState();
      if (runId !== s.runId) return;
      useRun.setState({ state: foldEvent(s.state, line) });
    }),
    subscribe('cli-stderr', ({ runId, text }) => {
      const s = useRun.getState();
      if (runId !== s.runId) return;
      useRun.setState({ stderr: [...s.stderr, text].slice(-STDERR_CAP) });
    }),
    subscribe('cli-exit', ({ runId, code, cancelled }) => {
      const s = useRun.getState();
      if (runId !== s.runId) return;
      const state = finishStream(s.state);
      const req = s.request;
      const receipt = req && state.order.length
        ? useReceipts.getState().record({ state, dryRun: req.dryRun, name: req.name, profile: req.profile, cancelled, claimId: req.claimId, at: Date.now(), ...(req.schedule ? { schedule: req.schedule } : {}) })
        : null;
      useRun.setState({ exitCode: code ?? -1, cancelled, state, receipt });
      if (req) {
        const n = tally(state);
        const base = { sections: n.attempted, completed: n.completed, skipped: n.skipped, failed: n.failed, interrupted: state.phase === 'interrupted' };
        if (req.dryRun) track('preview_finished', base);
        else track('run_finished', { ...base, cancelled });
      }
      if (receipt) void afterRun(receipt);
    }),
  ];
  return () => offs.forEach((off) => off());
}
