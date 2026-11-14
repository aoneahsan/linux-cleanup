import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Closed sets only. The plan KEY is deliberately not an enum: plans are rows,
 * so a new tier is an admin action, never a migration.
 */

/** Platform staff ladder: exactly the two rungs something checks. */
export const platformRole = pgEnum('platform_role', ['admin', 'superadmin']);

/** Which allowance pool paid for a real run. */
export const runPool = pgEnum('run_pool', ['device', 'account', 'plan']);

/** Outcome of one section inside a run summary. */
export const sectionStatus = pgEnum('section_status', ['completed', 'skipped', 'failed', 'cancelled']);

/** Billing period of a paid order. */
export const billingInterval = pgEnum('billing_interval', ['month', 'year']);

/** A paid period: active, ended naturally or by an admin, or returned by the bank/provider. */
export const subscriptionStatus = pgEnum('subscription_status', ['active', 'ended', 'returned']);

/** Where a plan grant came from (its provenance). */
export const grantSource = pgEnum('grant_source', ['admin', 'referral']);

/** A team member's role inside the team (product role, never a platform role). */
export const teamRole = pgEnum('team_role', ['owner', 'member']);

/** A referral is pending until the invitee's account exists AND its email is verified. */
export const referralStatus = pgEnum('referral_status', ['pending', 'confirmed']);

/** What a synced schedule does on the computer. */
export const scheduleKind = pgEnum('schedule_kind', ['run', 'preview']);
