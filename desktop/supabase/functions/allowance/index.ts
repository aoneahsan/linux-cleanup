/**
 * GET /allowance?device_id=  ->  { ok, month, resets_at, device, account, plan }
 * Registers the device for the caller (anonymous device sessions included) and reports
 * the current UTC month's pools. Reading never claims a run.
 */
import { type AllowanceFacts, toAllowance } from '../_shared/allowance.ts';
import { requireCaller } from '../_shared/auth.ts';
import { ok } from '../_shared/envelope.ts';
import { serve } from '../_shared/http.ts';
import { rpc } from '../_shared/rpc.ts';
import { readQuery, z } from '../_shared/validate.ts';

const Query = z.object({ device_id: z.uuid() });

serve('allowance', ['GET'], async (req) => {
  const { device_id } = readQuery(req, Query); // 1 shape
  const caller = await requireCaller(req); // 2 authentication; 3 authorization = own device, in SQL
  const facts = await rpc<AllowanceFacts>(caller.client, 'get_allowance', { p_device_id: device_id });
  return ok({ ...toAllowance(facts) });
});
