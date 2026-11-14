import { describe, expect, it } from 'vitest';
import { autoBackupEligible, receiptFromSummary } from '@/lib/backupRestore';
import type { BackupSummary } from '@/services/backups';

const summary: BackupSummary = {
  schema: 1, receipt_id: '1761840000000', at: 1761840000000, kind: 'manual', dry_run: false, interrupted: false, cancelled: false,
  os_version: '15.1', app_version: '5.2.2', freed_kb: 2048, free_before_kb: 1000, free_after_kb: 3048, total_kb: 500000,
  snapshots: 1, elapsed_s: 12, tally: { attempted: 2, completed: 1, skipped: 1, failed: 0 },
  sections: [{ id: 3, status: 'completed', freed_kb: 2048, planned_kb: 2048, item_count: 4 }, { id: 23, status: 'skipped', freed_kb: 0, planned_kb: 10, item_count: 1 }],
};

describe('receiptFromSummary', () => {
  it('keeps the numbers and marks the receipt restored', () => {
    const r = receiptFromSummary(summary, 'Restored receipt');
    expect(r).toMatchObject({ id: summary.receipt_id, at: summary.at, freedKb: 2048, freeAfterKb: 3048, restored: true, backedUp: true });
    expect(r.tally).toEqual(summary.tally);
    expect(r.sections.map((s) => [s.id, s.state, s.freedKb])).toEqual([[3, 'completed', 2048], [23, 'skipped', 0]]);
  });
  it('carries no title, reason, report, log or path', () => {
    const r = receiptFromSummary(summary, 'Restored receipt');
    expect(r.sections.every((s) => s.title === '' && s.reason === null)).toBe(true);
    expect([r.reports, r.errors, r.log]).toEqual([[], [], null]);
  });
});

describe('autoBackupEligible', () => {
  it('backs up real runs only, never a preview, a restored copy or one already backed up', () => {
    expect(autoBackupEligible({ dryRun: false })).toBe(true);
    expect(autoBackupEligible({ dryRun: true })).toBe(false);
    expect(autoBackupEligible({ dryRun: false, restored: true })).toBe(false);
    expect(autoBackupEligible({ dryRun: false, backedUp: true })).toBe(false);
  });
});
