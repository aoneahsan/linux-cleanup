/**
 * POST /run-summary (signed-in Google accounts on a plan with history sync)
 * { claim_id|null, dry_run, device_id, os_version, disk_free_before_kb,
 *   disk_free_after_kb, sections:[{id,status,freed_kb}],
 *   schedule?: { id, name, ran_at_label, next_run_label }, email_on_schedule?: boolean }
 *   ->  { ok:true, id }
 * Strict schemas: an unknown key (a path, a file name) is refused with 422, and the
 * database has no column that could hold one. A run from a synced schedule may send the
 * branded "Scheduled run finished" email once per summary (docs/CONTRACTS.md section 3).
 */
import { requireCaller, requireSignedIn } from '../_shared/auth.ts';
import { HttpError, ok } from '../_shared/envelope.ts';
import { scheduleFinishedEmail } from '../_shared/email/compose.ts';
import { sendEmail } from '../_shared/email/send.ts';
import { serve } from '../_shared/http.ts';
import { rpc } from '../_shared/rpc.ts';
import { readBody, z } from '../_shared/validate.ts';

const KB = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

/** Display text only: no path separators, no home-folder tilde, no control characters. */
const label = (max: number) =>
  z.string().trim().min(1).max(max).regex(/^[^/\\~\p{Cc}]+$/u, 'display text only (no / \\ ~ or control characters)');

const Section = z.object({
  id: z.number().int().min(0).max(27),
  status: z.enum(['completed', 'skipped', 'failed', 'cancelled']),
  freed_kb: KB,
}).strict();

const Schedule = z.object({
  id: z.uuid(),
  name: label(80),
  ran_at_label: label(60),
  next_run_label: label(60),
}).strict();

const Body = z.object({
  claim_id: z.uuid().nullable(),
  dry_run: z.boolean(),
  device_id: z.uuid(),
  os_version: z.string().min(1).max(40).regex(/^[0-9A-Za-z .()_-]+$/, 'letters, digits and . ( ) _ - only'),
  disk_free_before_kb: KB,
  disk_free_after_kb: KB,
  sections: z.array(Section).min(1).max(64)
    .refine((list) => new Set(list.map((s) => s.id)).size === list.length, 'section ids must be unique'),
  schedule: Schedule.optional(),
  email_on_schedule: z.boolean().optional(),
}).strict();

serve('run-summary', ['POST'], async (req) => {
  const { schedule, email_on_schedule: emailOnSchedule, ...summary } = await readBody(req, Body); // 1 shape
  const caller = await requireCaller(req); // 2 authentication
  requireSignedIn(caller); // 3 authorization (plan feature + claim ownership re-checked in SQL)

  // 4 business: a referenced schedule must be the caller's own (RLS proves it), before any write.
  if (schedule) {
    const { data, error } = await caller.client.from('schedules_meta').select('id').eq('id', schedule.id).maybeSingle();
    if (error) throw new HttpError(502, 'upstream_error', 'Could not read the schedule.');
    if (!data) throw new HttpError(422, 'invalid_schedule', 'That schedule is not on this account.');
  }

  // 5 the database: the summary carries numbers only; the schedule's labels are never stored.
  const id = await rpc<string>(caller.client, 'record_run_summary', { p_summary: summary });

  if (schedule) {
    const claim = await rpc<{ send: boolean }>(caller.client, 'schedule_email_claim', {
      p_summary: id, p_schedule: schedule.id, p_email: emailOnSchedule === true,
    });
    if (claim.send) {
      await sendEmail(caller.email, scheduleFinishedEmail({
        name: schedule.name,
        ranAt: schedule.ran_at_label,
        attempted: summary.sections.length,
        completed: summary.sections.filter((s) => s.status === 'completed').length,
        freeBeforeKb: summary.disk_free_before_kb,
        freeAfterKb: summary.disk_free_after_kb,
        nextRun: schedule.next_run_label,
      }), 'schedule_finished');
    }
  }
  return ok({ id });
});
