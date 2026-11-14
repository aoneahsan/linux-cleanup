/**
 * Scheduled runs report back (CONTRACTS §2): at launch and every 15 minutes, read
 * each unread stream the LaunchAgent wrote, fold it with the one event parser into
 * a "scheduled" receipt, sync its numbers when signed in, then ack the file.
 */
import { finishStream, foldLines, initialRunState } from '@/lib/events';
import { commands, isTauri } from '@/lib/tauri';
import { nextRun } from '@/lib/nextRun';
import { logger } from '@/lib/logger';
import { translate } from '@/i18n';
import { useReceipts } from '@/stores/receipts';
import { loadSavedSchedules } from '@/services/schedulesLocal';
import { afterRun } from '@/services/afterRun';

const EVERY_MS = 15 * 60_000;
let busy = false;

/** Ingest every unread scheduled run once; returns how many were recorded. */
export async function ingestScheduleRuns(): Promise<number> {
  if (busy || !isTauri()) return 0;
  busy = true;
  let n = 0;
  try {
    const files = await commands.listScheduleRuns();
    const saved = loadSavedSchedules();
    for (const f of files) {
      try {
        const lines = await commands.readScheduleRun(f.file);
        // A stream without `summary` follows the parser's "interrupted" rule.
        const state = finishStream(foldLines(initialRunState(), lines.join('\n')));
        const local = saved[f.scheduleId];
        const name = local?.name ?? translate('schedules.unnamed');
        const nextAt = local?.on ? nextRun(local.spec, Date.now()) : null;
        if (state.order.length) {
          const receipt = useReceipts.getState().record({
            state, dryRun: state.dryRun ?? local?.spec.kind !== 'cleanup', name, profile: null, cancelled: false, claimId: null,
            at: f.startedMs, schedule: { id: f.scheduleId, name, ranAt: f.startedMs, nextAt },
          });
          await afterRun(receipt, { notify: false });
          n += 1;
        }
        await commands.ackScheduleRun(f.file);
      } catch (error) {
        logger.warn('schedule run ingest failed', error instanceof Error ? error.message : 'unknown');
      }
    }
  } catch (error) {
    logger.warn('list_schedule_runs failed', error instanceof Error ? error.message : 'unknown');
  } finally {
    busy = false;
  }
  return n;
}

/** Ingest now and every 15 minutes while the app is open. Returns the cleanup. */
export function bindScheduleIngest(): () => void {
  void ingestScheduleRuns();
  const timer = window.setInterval(() => void ingestScheduleRuns(), EVERY_MS);
  return () => window.clearInterval(timer);
}
