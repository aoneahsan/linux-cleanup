/**
 * POST /polar-checkout { plan_id, interval, seats? }  ->  { ok:true, url }
 * For the signed-in (Google) account only. The amount is read from the plans row and
 * sent to Polar as the checkout price; the webhook re-prices the order against the same
 * row before granting anything.
 */
import { requireCaller, requireSignedIn } from '../_shared/auth.ts';
import { HttpError, ok } from '../_shared/envelope.ts';
import { serve } from '../_shared/http.ts';
import { createCheckout, productMap } from '../_shared/polar.ts';
import { readBody, z } from '../_shared/validate.ts';

const Body = z.object({
  plan_id: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  interval: z.enum(['month', 'year']),
  seats: z.number().int().min(1).max(1000).optional(),
}).strict();

serve('polar-checkout', ['POST'], async (req) => {
  const body = await readBody(req, Body); // 1 shape
  const caller = await requireCaller(req); // 2 authentication
  requireSignedIn(caller); // 3 authorization: a real account, never an anonymous device

  // 4 business validity, from the plans row (RLS: active plans only).
  const { data: plan, error } = await caller.client.from('plans')
    .select('id, price_month_cents, price_year_cents, per_seat, min_seats')
    .eq('id', body.plan_id).maybeSingle();
  if (error) throw new HttpError(502, 'upstream_error', 'Could not read the plan.');
  if (!plan) throw new HttpError(404, 'not_found', 'That plan is not available.');
  const unit = body.interval === 'month' ? plan.price_month_cents : plan.price_year_cents;
  if (unit <= 0) throw new HttpError(422, 'not_purchasable', 'That plan has no price for this period.');
  const seats = plan.per_seat ? (body.seats ?? plan.min_seats) : 1;
  if (plan.per_seat && seats < plan.min_seats) {
    throw new HttpError(422, 'seats_below_minimum', `This plan starts at ${plan.min_seats} seats.`);
  }

  const products = productMap();
  const productId = products?.[`${plan.id}_${body.interval}`];
  if (!productId) throw new HttpError(503, 'billing_unavailable', 'Card payments are not open yet.');

  const site = Deno.env.get('APP_WEBSITE_URL') ?? 'https://linux-cleanup.aoneahsan.com';
  try {
    const url = await createCheckout({
      productId, amountCents: unit * seats, userId: caller.id, email: caller.email,
      planId: plan.id, interval: body.interval, seats, returnUrl: new URL('/pricing', site).toString(),
    });
    return ok({ url });
  } catch {
    throw new HttpError(502, 'upstream_error', 'The payment provider did not open a checkout. Please try again.');
  }
});
