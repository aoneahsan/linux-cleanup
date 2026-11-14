/**
 * Turn a restored receipt-backup summary back into a local receipt. Pure. A backup
 * holds numbers, ids and statuses only, so the restored receipt carries no section
 * title (the catalogue supplies it), no skip reason, report, log or path.
 */
import type { BackupSummary } from '@/services/backups';
import type { Receipt } from '@/stores/receipts';

/** Should a finished receipt be backed up automatically? Real runs only, never a restored copy. */
export const autoBackupEligible = (r: Pick<Receipt, 'dryRun' | 'restored' | 'backedUp'>): boolean => !r.dryRun && !r.restored && !r.backedUp;

/** Rebuild a receipt from its backup summary; `name` is the label the history shows. */
export function receiptFromSummary(s: BackupSummary, name: string): Receipt {
  return {
    id: s.receipt_id,
    at: s.at,
    dryRun: s.dry_run,
    name,
    profile: null,
    interrupted: s.interrupted,
    cancelled: s.cancelled,
    tally: { ...s.tally },
    sections: s.sections.map((x) => ({ id: x.id, title: '', state: x.status, freedKb: x.freed_kb, plannedKb: x.planned_kb, itemCount: x.item_count, reason: null })),
    freedKb: s.freed_kb,
    freeBeforeKb: s.free_before_kb,
    freeAfterKb: s.free_after_kb,
    totalKb: s.total_kb,
    snapshots: s.snapshots,
    snapshotNote: false,
    elapsedS: s.elapsed_s,
    reports: [],
    log: null,
    errors: [],
    claimId: null,
    restored: true,
    backedUp: true,
  };
}
