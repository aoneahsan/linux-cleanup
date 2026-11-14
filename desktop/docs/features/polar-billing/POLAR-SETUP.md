# Polar billing — setup record

Last Updated: 2026-11-02

macleanup sells the desktop app's Pro and Team plans through Polar, the merchant of record. Setup follows the house
standard (`aoneahsan-cccs-polar-payments`), which replaces Polar's generic setup prompt: no test product, no TODO
stubs, no `/checkout?products=` route, no success page, no customer-portal route, no framework adapter, no
embedded checkout.

## State (2026-11-02)

| | Sandbox | Production |
|---|---|---|
| Organization | `macleanup` (e632cc52-7592-4045-992b-a148f209780e), `active` | `macleanup` (07af3244-d29e-401e-86e3-9151784c422b), **approved and `active` (2026-11-02)** |
| Products | `pro_month` 098ca21f… · `pro_year` 8f9c1bc0… · `team_month` 55ee2036… · `team_year` 629f91c9… | `pro_month` 399000f2-a889-4ba9-830c-bd82b5f9ab4d · `pro_year` e65f4ee6-7997-4ca9-98b9-32539685711f · `team_month` dadfe94c-30cc-4c12-ac6b-7b80e348f3d3 · `team_year` e44b2b41-60bf-4486-9f77-7b4d99fb3638 |
| Webhook endpoint | f1625781-4187-4182-ac8e-a6bd8ff093ea | e1300b7b-5b20-4371-a61f-a256fc5006bc |
| Function secrets | used for the proof only | **all set, live since 2026-11-02 10:43 UTC** |

Products are recurring at the live `plans` rows (2026-11-02): Pro $4 a month / $36 a year; Team $3 / $30 per seat,
minimum 3 seats (checkout sends unit price × seats). Webhook: `https://epcuzfzldixtftnbudba.supabase.co/functions/v1/polar-webhook`,
format `raw`, events `order.paid` and `order.refunded`.

## Files

- `supabase/functions/_shared/polar.ts` — one client (`npm:@polar-sh/sdk@1.0.2/2026-10`, `POLAR_SERVER`), product
  map, hosted checkout (price from the plans row, `external_customer_id` = account id, `return_url` → /pricing),
  raw-body verification (403 bad signature, 202 unknown type, 400 malformed).
- `supabase/functions/polar-checkout/index.ts` — signed-in Google account; 503 `billing_unavailable` without
  `POLAR_PRODUCTS`.
- `supabase/functions/polar-webhook/index.ts` — idempotent on `webhook-id`; `apply_paid_order` prices the order
  (subtotal before discount and tax = plan row × seats) and extends the plan; `apply_returned_order` ends the time a
  returned payment covered; branded receipt and "payment returned" emails.
- `supabase/functions/_shared/polar.test.ts` + `fixtures/polar-order-paid.json` (a real sandbox delivery) — signed
  delivery read at 400 cents; changed body, other secret, unsigned → 403; unknown signed type → 202; product → plan.
  Watched failing on a planted signature bypass (2026-11-02).
- `vite.config.ts` — Vitest aliases for the two `npm:` specifiers.
- App: `src/pages/account/PlansPage.tsx` opens Polar's page in the browser; one consent line, no refund wording.

## Environment keys (names only)

Supabase function secrets: `POLAR_ACCESS_TOKEN`, `POLAR_SERVER`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCTS`.
Values: `~/.secrets/polar-macleanup/` (from FilesHub payment account 14 `macleanup-polar`); created values backed up to
the vault project `macleanup`, `general.bk_polar_macleanup_*`, read back 2026-11-02.

## Sandbox proof (2026-11-02, non-admin test accounts)

1. `t1+1` → `polar-checkout` Pro monthly → Polar's hosted page; test card 4242 → checkout `succeeded`, order paid
   400 cents → `order.paid` 202 → `granted`; subscription active to 2026-12-02; allowance reports `pro`.
2. `t1+2` → Team monthly, 3 seats → 900 cents → `granted`; team created with 3 seats; allowance reports `team`.
3. Refund of the Pro order → `order.refunded` 202 → `returned`; the subscription ended; `t1+1` back on Free.
4. Unsigned POST → 403. A discounted ($0) subscription cannot be confirmed without a card: Polar requires a payment
   method for renewals.
5. Cleaned up: sandbox subscriptions revoked, discount deleted, the test subscription and team rows removed.

## Production go-live (done 2026-11-02)

1. `GET /v1/organizations/07af3244-…` status is no longer `created`.
2. Set `POLAR_PRODUCTS` from `~/.secrets/polar-macleanup/production-products.json`; `polar-checkout` as `t1+1`
   returns a `polar.sh/checkout/…` URL whose page shows the right plan and price. Stop there.
3. Done: Pro monthly ($4) and Team yearly × 3 ($90) checkouts open on polar.sh as `t1+1`; no payment made. Org avatar uploaded through Polar's Files API (its checkout CSP loads images only from Polar storage).

## Customer portal

Polar hosts the customer portal and emails buyers its link; macleanup has no portal route.
