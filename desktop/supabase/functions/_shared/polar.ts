import { createPolar, webhooks } from 'npm:@polar-sh/sdk@1.0.2/2026-10';
import { HttpError } from './envelope.ts';
import { env } from './supabase.ts';

/**
 * The one Polar module: client, product map, checkout and webhook reading.
 * Secrets: POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_SERVER ('sandbox'|'production'),
 * POLAR_PRODUCTS (JSON map '<plan>_<interval>' -> product id). Withholding POLAR_PRODUCTS
 * keeps checkout unavailable (the production-approval wait) without a code change.
 */

export type Interval = 'month' | 'year';

function server(): 'sandbox' | 'production' {
  const value = env('POLAR_SERVER');
  if (value !== 'sandbox' && value !== 'production') {
    throw new HttpError(500, 'internal_error', 'POLAR_SERVER must be sandbox or production.');
  }
  return value;
}

/** The SDK client for the configured environment. */
export function polarClient() {
  return createPolar({ accessToken: env('POLAR_ACCESS_TOKEN'), environment: server(), timeout: 15 });
}

/** The product map, or null when checkout is deliberately unavailable. */
export function productMap(): Record<string, string> | null {
  const raw = Deno.env.get('POLAR_PRODUCTS');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new HttpError(500, 'internal_error', 'POLAR_PRODUCTS is not valid JSON.');
  }
}

/** Reverse lookup for renewal orders whose metadata is absent: product id -> plan + interval. */
export function planForProduct(productId: string | null | undefined): { planId: string; interval: Interval } | null {
  const map = productMap();
  if (!map || !productId) return null;
  const key = Object.keys(map).find((k) => map[k] === productId);
  const match = key ? /^([a-z][a-z0-9_]*)_(month|year)$/.exec(key) : null;
  return match ? { planId: match[1], interval: match[2] as Interval } : null;
}

/** Inputs for one checkout; the amount comes from the plans row, never the client. */
export interface CheckoutInput {
  productId: string;
  amountCents: number;
  userId: string;
  email: string;
  planId: string;
  interval: Interval;
  seats: number;
  returnUrl: string;
}

/**
 * Create a hosted checkout for the signed-in account at the database price.
 * No success URL: Polar's own confirmation is the page, and access is granted only by
 * the verified webhook, never by a redirect.
 */
export async function createCheckout(input: CheckoutInput): Promise<string> {
  const checkout = await polarClient().checkouts.create({
    products: [input.productId],
    prices: { [input.productId]: [{ amount_type: 'fixed', price_amount: input.amountCents, price_currency: 'usd' }] },
    external_customer_id: input.userId,
    customer_email: input.email,
    metadata: { user_id: input.userId, plan_id: input.planId, interval: input.interval, seats: input.seats },
    return_url: input.returnUrl,
  });
  return checkout.url;
}

/** The order fields the webhook reads (a narrow view of Polar's Order). */
export interface PolarOrder {
  id: string;
  subtotal_amount: number;
  refunded_amount: number;
  currency: string;
  product_id: string | null;
  subscription_id: string | null;
  customer_id: string;
  metadata: Record<string, unknown>;
  customer: { external_id?: string | null };
  seats?: number | null;
}

/** A verified event this function handles. */
export type PolarEvent =
  | { kind: 'paid'; order: PolarOrder }
  | { kind: 'refunded'; order: PolarOrder }
  | { kind: 'ignored'; type: string };

/** Verification outcome: a 403 for a bad signature, 202 for an unknown signed type. */
export class WebhookRejected extends Error {
  constructor(readonly status: 400 | 403 | 202, message: string) {
    super(message);
  }
}

/** Verify the Standard Webhooks signature over the RAW body, then read the event. */
export async function readWebhook(rawBody: string, headers: Headers): Promise<PolarEvent> {
  let event: { type: string; data: unknown };
  try {
    event = await webhooks.validateEvent(rawBody, Object.fromEntries(headers.entries()), env('POLAR_WEBHOOK_SECRET'));
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) throw new WebhookRejected(403, 'invalid signature');
    if (error instanceof webhooks.PolarWebhookUnknownTypeError) throw new WebhookRejected(202, 'unknown event type');
    throw new WebhookRejected(400, 'malformed webhook');
  }
  if (event.type === 'order.paid') return { kind: 'paid', order: event.data as PolarOrder };
  if (event.type === 'order.refunded') return { kind: 'refunded', order: event.data as PolarOrder };
  return { kind: 'ignored', type: event.type };
}
