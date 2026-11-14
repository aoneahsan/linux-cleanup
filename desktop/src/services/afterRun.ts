/**
 * After a run ends: sync its numbers (never a path) for signed-in Google accounts,
 * and post the opt-in macOS notification with the receipt's totals.
 */
import { translate } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { callFunction, getDeviceId, refreshAllowance } from '@/services/account';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';
import { commands, isTauri } from '@/lib/tauri';
import { logger } from '@/lib/logger';
import type { Receipt } from '@/stores/receipts';

async function syncSummary(r: Receipt): Promise<void> {
  if (!useSession.getState().signedIn || !useSettings.getState().settings.syncHistory) return;
  const sys = await commands.systemInfo();
  const body: Record<string, unknown> = {
    claim_id: r.claimId,
    dry_run: r.dryRun,
    device_id: await getDeviceId(),
    os_version: sys.os_version,
    sections: r.sections
      .filter((s) => s.state === 'completed' || s.state === 'skipped' || s.state === 'failed')
      .map((s) => ({ id: s.id, status: s.state, freed_kb: Math.max(0, Math.round(s.freedKb)) })),
  };
  // Optional numbers are left out when unknown, never sent as null.
  if (r.freeBeforeKb !== null) body.disk_free_before_kb = Math.round(r.freeBeforeKb);
  if (r.freeAfterKb !== null) body.disk_free_after_kb = Math.round(r.freeAfterKb);
  if (r.schedule) {
    body.schedule = {
      id: r.schedule.id,
      name: r.schedule.name,
      ran_at_label: formatDateTime(r.schedule.ranAt),
      next_run_label: r.schedule.nextAt ? formatDateTime(r.schedule.nextAt) : translate('schedules.noNext'),
    };
    body.email_on_schedule = useSettings.getState().settings.emailOnSchedule;
  }
  await callFunction('run-summary', { body });
}

async function notify(r: Receipt): Promise<void> {
  if (!isTauri() || !useSettings.getState().settings.notify) return;
  const n = await import('@tauri-apps/plugin-notification');
  let granted = await n.isPermissionGranted();
  if (!granted) granted = (await n.requestPermission()) === 'granted';
  if (!granted) return;
  n.sendNotification({
    title: translate('shell.brand'),
    body: translate('flow.live.toastDone', { completed: r.tally.completed, attempted: r.tally.attempted }),
  });
}

/** Run every post-run step; failures are logged by kind, never thrown at the UI. */
export async function afterRun(r: Receipt, opts: { notify?: boolean } = {}): Promise<void> {
  const steps: Promise<unknown>[] = [syncSummary(r)];
  if (opts.notify !== false) steps.push(notify(r));
  if (!r.dryRun && !r.schedule) steps.push(refreshAllowance());
  const results = await Promise.allSettled(steps);
  for (const res of results) if (res.status === 'rejected') logger.warn('after-run step failed', res.reason instanceof Error ? res.reason.message : 'unknown');
}
