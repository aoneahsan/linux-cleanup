import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

// Money whose wrongness is invisible: a forged delivery that verifies would grant a paid plan, and a misread
// product would grant the wrong one. The fixture is a real sandbox `order.paid` payload (Pro monthly, 400 cents,
// delivered 2026-11-02), so the SDK's schema check runs against what Polar actually sends.

const SECRET = 'test-signing-secret-linux-cleanup';
const PRODUCTS = { pro_month: 'prod-pro-m', pro_year: 'prod-pro-y', team_month: 'prod-team-m', team_year: 'prod-team-y' };
const vars: Record<string, string> = { POLAR_WEBHOOK_SECRET: SECRET, POLAR_PRODUCTS: JSON.stringify(PRODUCTS) };

// The Edge Function reads Deno.env; Node gets the same two values.
(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => vars[k] } };

type PolarModule = typeof import('./polar.ts');
let polar: PolarModule;
beforeAll(async () => { polar = await import('./polar.ts'); });

const paidBody = readFileSync(new URL('./fixtures/polar-order-paid.json', import.meta.url), 'utf8');

/** Standard Webhooks headers: HMAC-SHA256 over `id.timestamp.body`, keyed with the secret's bytes. */
function signed(body: string, secret = SECRET, stamp = Math.floor(Date.now() / 1000)): Headers {
  const sig = createHmac('sha256', Buffer.from(secret, 'utf8')).update(`msg_1.${stamp}.${body}`).digest('base64');
  return new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': String(stamp), 'webhook-signature': `v1,${sig}` });
}

async function rejection(body: string, headers: Headers): Promise<number | 'accepted'> {
  try {
    await polar.readWebhook(body, headers);
    return 'accepted';
  } catch (error) {
    if (error instanceof polar.WebhookRejected) return error.status;
    throw error;
  }
}

describe('a Polar delivery is verified before anything is read', () => {
  it('reads a real signed order.paid by its price before discount and tax', async () => {
    const event = await polar.readWebhook(paidBody, signed(paidBody));
    expect(event.kind).toBe('paid');
    if (event.kind !== 'paid') return;
    expect(event.order.subtotal_amount).toBe(400);
    expect(event.order.currency).toBe('usd');
  });
  it('refuses a changed body and a delivery signed with another secret (403)', async () => {
    const changed = paidBody.replace('"subtotal_amount": 400', '"subtotal_amount": 1');
    expect(changed).not.toBe(paidBody);
    expect(await rejection(changed, signed(paidBody))).toBe(403);
    expect(await rejection(paidBody, signed(paidBody, 'another-secret'))).toBe(403);
    expect(await rejection(paidBody, new Headers())).toBe(403);
  });
  it('acknowledges a signed event type it does not handle, without reading it (202)', async () => {
    const body = JSON.stringify({ type: 'order.teleported', timestamp: new Date().toISOString(), data: {} });
    expect(await rejection(body, signed(body))).toBe(202);
  });
});

describe('a renewal without metadata is mapped back to its plan', () => {
  it('maps each configured product to its plan and period, and nothing else', () => {
    expect(polar.planForProduct('prod-pro-y')).toEqual({ planId: 'pro', interval: 'year' });
    expect(polar.planForProduct('prod-team-m')).toEqual({ planId: 'team', interval: 'month' });
    expect(polar.planForProduct('prod-unknown')).toBeNull();
    expect(polar.planForProduct(null)).toBeNull();
  });
});
