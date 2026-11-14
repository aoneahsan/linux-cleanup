/**
 * GET  /news            ->  { ok, status }   whether this account's address gets optional updates
 * POST /news { on }     ->  { ok, status }   turn them on or off (the Account screen switch)
 * Signed-in Google accounts only: the address is the verified one on the session, never a body field.
 */
import { requireCaller, requireSignedIn } from '../_shared/auth.ts';
import { ok } from '../_shared/envelope.ts';
import { serve } from '../_shared/http.ts';
import { newsStatus, setNews } from '../_shared/news.ts';
import { readBody, z } from '../_shared/validate.ts';

const Body = z.object({ on: z.boolean() }).strict();

serve('news', ['GET', 'POST'], async (req) => {
  const body = req.method === 'POST' ? await readBody(req, Body) : null; // 1 shape
  const caller = await requireCaller(req); // 2 authentication
  requireSignedIn(caller); // 3 authorization: a real account with a verified address
  const status = body ? await setNews(caller.email, body.on) : await newsStatus(caller.email);
  return ok({ status });
});
