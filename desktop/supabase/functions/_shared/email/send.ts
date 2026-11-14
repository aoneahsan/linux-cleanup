import { log } from '../log.ts';
import type { RenderedEmail } from './layout.ts';

const FILESHUB_SEND = 'https://fileshub.zaions.com/api/v1/emails/send';

/**
 * Hand one rendered email to FilesHub (queued: a 202 means accepted, not delivered).
 * Fire-and-forget by design: a failure is logged and never breaks the caller's flow.
 * Server-side calls send no Origin, so the key must allow no-origin callers; X-App-Id
 * is sent as the audit tag. Returns whether FilesHub accepted it.
 */
export async function sendEmail(to: string, email: RenderedEmail, kind: string): Promise<boolean> {
  const key = Deno.env.get('FILESHUB_API_KEY');
  if (!key) {
    log('warn', 'email.skipped', { kind, reason: 'FILESHUB_API_KEY missing' });
    return false;
  }
  try {
    const res = await fetch(FILESHUB_SEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': key,
        'X-App-Id': Deno.env.get('FILESHUB_APP_ID') ?? 'linux-cleanup-edge-functions',
      },
      body: JSON.stringify({
        to,
        from_name: 'linux-cleanup',
        subject: email.subject,
        body_html: email.html,
        body_text: email.text,
        queue: true,
      }),
    });
    // Two error shapes exist on this plane ({message} and {success:false,...}); branch on both.
    const body = await res.json().catch(() => ({})) as { success?: boolean };
    const accepted = (res.status === 202 || res.status === 201) && body.success !== false;
    if (!accepted) log('warn', 'email.refused', { kind, status: res.status });
    return accepted;
  } catch (error) {
    log('warn', 'email.failed', { kind, message: error instanceof Error ? error.message : String(error) });
    return false;
  }
}
