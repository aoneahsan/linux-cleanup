import { HttpError } from './envelope.ts';
import { log } from './log.ts';

/**
 * The "linux-cleanup releases" list on FilesHub email marketing: optional release news, opt-in only.
 * Server-side calls (no Origin) with the project's server key; FilesHub keeps consent, suppression
 * and the unsubscribe link. Important product updates are account emails and never go through here.
 */
const BASE = 'https://fileshub.zaions.com/api/v1';

export type NewsStatus = 'none' | 'active' | 'pending_confirmation' | 'unsubscribed' | 'blocked';

interface Contact { id: string; email: string; status: string }

function config(): { key: string; list: string } {
  const key = Deno.env.get('FILESHUB_API_KEY');
  const list = Deno.env.get('FILESHUB_NEWS_LIST');
  if (!key || !list) throw new HttpError(503, 'news_unavailable', 'Release emails are not set up yet.');
  return { key, list };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { key } = config();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'X-API-Key': key, Accept: 'application/json', 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({})) as { success?: boolean; data?: T; code?: string };
  if (!res.ok || body.success === false) {
    log('warn', 'news.fileshub_refused', { path: path.split('?')[0].replace(/[0-9A-Z]{26}/g, ':id'), status: res.status, code: body.code });
    throw new HttpError(502, 'upstream_error', 'Could not reach the email service. Please try again.');
  }
  return body.data as T;
}

/** The caller's contact on the list, matched exactly (the search is a prefix match), or null. */
async function findContact(email: string): Promise<Contact | null> {
  const { list } = config();
  const rows = await call<Contact[]>(`/email-lists/${list}/contacts?q=${encodeURIComponent(email)}&per_page=10`);
  return rows.find((row) => row.email.toLowerCase() === email) ?? null;
}

function statusOf(contact: Contact | null): NewsStatus {
  if (!contact) return 'none';
  if (contact.status === 'active' || contact.status === 'pending_confirmation' || contact.status === 'unsubscribed') {
    return contact.status;
  }
  return 'blocked'; // bounced, complained or erased: FilesHub will not mail this address again
}

/** Whether the caller's address gets optional updates. */
export async function newsStatus(email: string): Promise<NewsStatus> {
  return statusOf(await findContact(email));
}

/** Turn optional updates on or off for a signed-in account's verified Google address. */
export async function setNews(email: string, on: boolean): Promise<NewsStatus> {
  const { list } = config();
  const contact = await findContact(email);
  const status = statusOf(contact);
  if (on) {
    if (status === 'none') {
      await call(`/email-lists/${list}/contacts`, {
        method: 'POST',
        body: JSON.stringify({
          email, consent_basis: 'opt_in', source_platform: 'linux-cleanup-desktop',
          reason: 'Turned on release emails on the desktop app Account screen (verified Google address).',
        }),
      });
    } else if (status === 'unsubscribed' && contact) {
      await call(`/email-contacts/${contact.id}/resubscribe`, {
        method: 'POST', body: JSON.stringify({ reason: 'Turned release emails back on in the desktop app Account screen.' }),
      });
    } else if (status === 'blocked') {
      throw new HttpError(409, 'news_blocked', 'This address cannot get release emails.');
    }
  } else if (contact && (status === 'active' || status === 'pending_confirmation')) {
    await call(`/email-contacts/${contact.id}/unsubscribe`, { method: 'POST', body: '{}' });
  }
  return newsStatus(email);
}
