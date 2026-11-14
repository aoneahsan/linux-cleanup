/**
 * POST /polar-webhook (Polar -> server; verify_jwt = false, the signature is the auth).
 * Raw body -> Standard Webhooks signature (403 bad, 400 malformed, 202 unknown type) ->
 * idempotency on the delivery id -> the order priced and applied in SQL -> branded email.
 * order.paid grants or extends the plan at the database price; order.refunded (a payment
 * the bank or Polar returned) ends the period it paid for and emails "payment returned".
 */
import { fail, json } from '../_shared/envelope.ts';
import { receiptEmail, returnedEmail } from '../_shared/email/compose.ts';
import { sendEmail } from '../_shared/email/send.ts';
import { serve } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import { planForProduct, type PolarOrder, readWebhook, WebhookRejected } from '../_shared/polar.ts';
import { rpc } from '../_shared/rpc.ts';
import { serviceClient, type SupabaseClient } from '../_shared/supabase.ts';

async function emailOf(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from('profiles').select('email').eq('id', userId).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

async function onPaid(db: SupabaseClient, order: PolarOrder): Promise<string> {
  const meta = order.metadata ?? {};
  const fromProduct = planForProduct(order.product_id);
  const result = await rpc<Record<string, unknown>>(db, 'apply_paid_order', {
    p_order: {
      order_id: order.id,
      user_id: (meta.user_id as string | undefined) ?? order.customer?.external_id ?? null,
      plan_id: (meta.plan_id as string | undefined) ?? fromProduct?.planId ?? null,
      interval: (meta.interval as string | undefined) ?? fromProduct?.interval ?? null,
      seats: Number(meta.seats ?? order.seats ?? 1),
      subtotal_cents: order.subtotal_amount,
      currency: order.currency,
      polar_subscription_id: order.subscription_id,
      polar_customer_id: order.customer_id,
    },
  });
  if (result.result === 'granted') {
    const to = await emailOf(db, result.user_id as string);
    if (to) {
      await sendEmail(to, receiptEmail({
        planName: result.plan_name as string, interval: result.interval as string,
        amountCents: result.amount_cents as number, currency: result.currency as string,
        periodStart: result.period_start as string, periodEnd: result.period_end as string,
        seats: result.seats as number,
      }), 'receipt');
    }
  }
  return result.result as string;
}

async function onRefunded(db: SupabaseClient, order: PolarOrder): Promise<string> {
  const result = await rpc<Record<string, unknown>>(db, 'apply_returned_order', {
    p_order_id: order.id, p_returned_cents: order.refunded_amount,
  });
  if (result.result === 'returned') {
    const to = await emailOf(db, result.user_id as string);
    if (to) {
      await sendEmail(to, returnedEmail({
        planName: result.plan_name as string, interval: result.interval as string,
        amountCents: result.returned_cents as number, currency: result.currency as string,
        planNow: result.plan_now as string,
      }), 'payment_returned');
    }
  }
  return result.result as string;
}

serve('polar-webhook', ['POST'], async (req) => {
  const raw = await req.text();
  let event;
  try {
    event = await readWebhook(raw, req.headers);
  } catch (error) {
    if (error instanceof WebhookRejected) {
      if (error.status === 202) return json({ ok: true, ignored: true }, 202);
      return fail(error.status, error.status === 403 ? 'forbidden' : 'invalid_request', error.message);
    }
    throw error;
  }
  if (event.kind === 'ignored') return json({ ok: true, ignored: true }, 202);

  const deliveryId = req.headers.get('webhook-id') ?? `order:${event.order.id}:${event.kind}`;
  const db = serviceClient();
  const { error: insertError } = await db.from('webhook_events')
    .insert({ id: deliveryId, type: `order.${event.kind}` });
  if (insertError) {
    const { data: seen } = await db.from('webhook_events').select('processed_at').eq('id', deliveryId).maybeSingle();
    if (seen?.processed_at) return json({ ok: true, duplicate: true }, 202);
  }

  const result = event.kind === 'paid' ? await onPaid(db, event.order) : await onRefunded(db, event.order);
  await db.from('webhook_events').update({ processed_at: new Date().toISOString(), result }).eq('id', deliveryId);
  log('info', 'polar-webhook.applied', { kind: event.kind, result });
  return json({ ok: true, result }, 202);
});
