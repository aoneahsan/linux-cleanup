/**
 * Pro receipt backups from the app side: one "back up this receipt" action shared
 * by the receipt page and the automatic backup after a real run. The summary is
 * built by `@/services/backups` from its allow-list (numbers, ids, statuses; never
 * a path). Automatic backup skips silently when offline, signed out or not on a
 * plan that includes backups; the server is the authority on the plan either way.
 */
import { AccountError, hasCode } from '@/services/account';
import { queryClient } from '@/services/queryClient';
import { autoBackupEligible } from '@/lib/backupRestore';
import { commands } from '@/lib/tauri';
import { logger } from '@/lib/logger';
import { useReceipts, type Receipt } from '@/stores/receipts';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';

/** The TanStack Query key of the backups list (invalidated after every write). */
export const backupsKey = ['backups'] as const;

export type BackupOutcome = 'done' | 'duplicate' | 'plan' | 'full' | 'signin' | 'owned' | 'offline' | 'error';

/** Back up one receipt and name the outcome; a receipt the server already holds counts as backed up. */
export async function backupOne(r: Receipt): Promise<BackupOutcome> {
  try {
    const [sys, { backupReceipt }] = await Promise.all([commands.systemInfo(), import('@/services/backups')]);
    await backupReceipt(r, sys.os_version);
    useReceipts.getState().markBackedUp([r.id]);
    void queryClient.invalidateQueries({ queryKey: backupsKey });
    return 'done';
  } catch (error) {
    if (hasCode(error, 'duplicate_backup')) {
      useReceipts.getState().markBackedUp([r.id]);
      return 'duplicate';
    }
    if (hasCode(error, 'plan_required')) return 'plan';
    if (hasCode(error, 'limit_reached')) return 'full';
    if (hasCode(error, 'signed_in_required')) return 'signin';
    if (hasCode(error, 'device_owned')) return 'owned';
    if (error instanceof AccountError && error.kind === 'offline') return 'offline';
    logger.warn('receipt backup failed', error instanceof Error ? error.message : 'unknown');
    return 'error';
  }
}

/** True when this account may back up at all (signed in on a paid plan). */
export const mayBackUp = (): boolean => {
  const s = useSession.getState();
  return s.signedIn && s.plan !== 'free';
};

/** Back up each new real-run receipt when it lands, if the person switched it on (AppShell). */
export function bindAutoBackup(): () => void {
  return useReceipts.subscribe((s, prev) => {
    const r = s.receipts[0];
    if (!r || r === prev.receipts[0] || prev.receipts.some((x) => x.id === r.id)) return;
    if (!useSettings.getState().settings.autoBackup || !autoBackupEligible(r) || !mayBackUp() || !navigator.onLine) return;
    void backupOne(r).then((outcome) => {
      if (outcome !== 'done' && outcome !== 'duplicate') logger.info('automatic backup skipped', outcome);
    });
  });
}
