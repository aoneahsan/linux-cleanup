/**
 * POST /delete-account { confirm: "DELETE" }  ->  { ok:true }
 * Step 1 (SQL): anonymise the caller's audit actor, remove an owned team, append an
 * audit row. Step 2: delete the auth user, which cascades every owned row. Audit rows
 * stay, with the actor anonymised. Receipts and logs on the computer are untouched.
 */
import { requireCaller } from '../_shared/auth.ts';
import { HttpError, ok } from '../_shared/envelope.ts';
import { serve } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import { rpc } from '../_shared/rpc.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { readBody, z } from '../_shared/validate.ts';
import { setNews } from '../_shared/news.ts';

const Body = z.object({ confirm: z.literal('DELETE') }).strict();

serve('delete-account', ['POST'], async (req) => {
  await readBody(req, Body); // 1 shape
  const caller = await requireCaller(req); // 2 authentication; 3 authorization = only yourself
  const db = serviceClient(); // deleting an auth user needs the secret key, inside this function only
  // Optional release emails end with the account. Best effort: a FilesHub hiccup must not keep the account.
  if (!caller.isAnonymous && caller.email) {
    await setNews(caller.email, false).catch(() => log('warn', 'delete-account.news_off_failed', {}));
  }
  await rpc(db, 'account_delete_data', { p_user: caller.id });
  const { error } = await db.auth.admin.deleteUser(caller.id);
  if (error) {
    log('error', 'delete-account.auth_delete_failed', { user: caller.id });
    throw new HttpError(502, 'upstream_error', 'Your data was removed, but the sign-in record was not. Please try again.');
  }
  return ok({});
});
