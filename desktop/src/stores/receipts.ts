/**
 * Local receipts and the latest findings per section. Both live only on this computer
 * (strata-storage); a synced run summary never carries a path (CONTRACTS §3).
 */
import { create } from 'zustand';
import { load, save } from '@/lib/storage';
import { tally, type RunState, type SectionRun } from '@/lib/events';

export interface ReceiptSection {
  id: number;
  title: string;
  state: SectionRun['state'];
  freedKb: number;
  plannedKb: number;
  itemCount: number;
  reason: string | null;
}

export interface Receipt {
  id: string;
  at: number;
  dryRun: boolean;
  name: string;
  profile: string | null;
  interrupted: boolean;
  cancelled: boolean;
  tally: { attempted: number; completed: number; skipped: number; failed: number };
  sections: ReceiptSection[];
  freedKb: number;
  freeBeforeKb: number | null;
  freeAfterKb: number | null;
  totalKb: number | null;
  snapshots: number;
  snapshotNote: boolean;
  elapsedS: number | null;
  reports: string[];
  log: string | null;
  errors: string[];
  claimId: string | null;
  schedule?: { id: string; name: string; ranAt: number; nextAt: number | null };
}

/** The latest preview findings for one section, kept for the review screens. */
export interface Finding {
  at: number;
  section: SectionRun;
}

const RECEIPTS_CAP = 30;
const FINDING_ITEMS_CAP = 300;

interface ReceiptsState {
  receipts: Receipt[];
  findings: Record<number, Finding>;
  record: (args: { state: RunState; dryRun: boolean; name: string; profile: string | null; cancelled: boolean; claimId: string | null; at: number; schedule?: Receipt['schedule'] }) => Receipt;
}

export const useReceipts = create<ReceiptsState>((set, get) => ({
  receipts: load<Receipt[]>('receipts', []),
  findings: load<Record<number, Finding>>('findings', {}),
  record: ({ state, dryRun, name, profile, cancelled, claimId, at, schedule }) => {
    const sections = state.order.map((id) => state.sections[id]).filter((s): s is SectionRun => Boolean(s));
    const before = state.diskBefore;
    const after = state.diskAfter;
    const receipt: Receipt = {
      id: `${at}`,
      at,
      dryRun,
      name,
      profile,
      interrupted: state.phase === 'interrupted',
      cancelled,
      tally: tally(state),
      sections: sections.map((s) => ({
        id: s.id, title: s.title, state: s.state, freedKb: s.freedKb, plannedKb: s.plannedKb, itemCount: s.itemCount, reason: s.reason,
      })),
      freedKb: state.summary?.freedKb ?? sections.reduce((n, s) => n + s.freedKb, 0),
      freeBeforeKb: state.summary?.diskFreeBeforeKb ?? before?.freeKb ?? null,
      freeAfterKb: state.summary?.diskFreeAfterKb ?? after?.freeKb ?? null,
      totalKb: before?.totalKb ?? after?.totalKb ?? null,
      snapshots: (after ?? before)?.snapshots ?? 0,
      snapshotNote: Boolean(after?.snapshotNote ?? before?.snapshotNote),
      elapsedS: state.summary?.elapsedS ?? null,
      reports: state.summary?.reports ?? [],
      log: state.summary?.log ?? null,
      errors: state.errors.map((e) => e.message).slice(0, 20),
      claimId,
      ...(schedule ? { schedule } : {}),
    };
    const receipts = [receipt, ...get().receipts].slice(0, RECEIPTS_CAP);
    save('receipts', receipts);
    let findings = get().findings;
    if (dryRun) {
      findings = { ...findings };
      for (const s of sections) findings[s.id] = { at, section: { ...s, items: s.items.slice(0, FINDING_ITEMS_CAP) } };
      save('findings', findings);
    }
    set({ receipts, findings });
    return receipt;
  },
}));
