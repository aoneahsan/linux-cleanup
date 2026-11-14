/**
 * POST /claim-run { device_id, sections }  ->  { ok:true, claim_id, pool, allowance }
 *                                           | { ok:false, reason:'limit_reached', allowance }
 * Only REAL runs call this; previews never do. public.claim_run() decides the pool
 * atomically; this function formats the result and cross-checks the decision.
 */
import { type AllowanceFacts, choosePool, monthKey, type Pool, toAllowance } from '../_shared/allowance.ts';
import { requireCaller } from '../_shared/auth.ts';
import { json, ok } from '../_shared/envelope.ts';
import { serve } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import { rpc } from '../_shared/rpc.ts';
import { readBody, z } from '../_shared/validate.ts';

const Body = z.object({
  device_id: z.uuid(),
  sections: z.array(z.number().int().min(0).max(27)).min(1).max(64),
}).strict();

interface ClaimResult {
  ok: boolean;
  claim_id?: string;
  pool?: Pool;
  before: AllowanceFacts;
  allowance: AllowanceFacts;
}

serve('claim-run', ['POST'], async (req) => {
  const body = await readBody(req, Body); // 1 shape
  const caller = await requireCaller(req); // 2 authentication
  // 3 authorization + 4 business (plan, pools, month) + 5 write: one atomic SQL call.
  const result = await rpc<ClaimResult>(caller.client, 'claim_run', {
    p_device_id: body.device_id,
    p_sections: body.sections,
  });

  const expected = choosePool(result.before);
  if (expected !== (result.ok ? result.pool : null)) {
    log('warn', 'claim-run.pool_drift', { expected, actual: result.pool ?? null });
  }
  if (monthKey(new Date()) !== result.before.month) {
    log('info', 'claim-run.month_boundary', { db_month: result.before.month });
  }

  if (!result.ok) return json({ ok: false, reason: 'limit_reached', allowance: toAllowance(result.allowance) });
  return ok({ claim_id: result.claim_id, pool: result.pool, allowance: toAllowance(result.allowance) });
});
