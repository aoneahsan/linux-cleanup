import { sql } from 'drizzle-orm';
import {
  boolean, check, index, integer, pgPolicy, pgTable, smallint, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { billingInterval, grantSource, subscriptionStatus } from './enums';
import { profiles } from './identity';
import { ownedBySignedIn } from './rls';
import { teams } from './teams';

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/**
 * The plan registry. A tier is a ROW: limits and prices are admin fields on it.
 * A null run limit means "use the app_config default"; real_runs_unlimited lifts both pools.
 */
export const plans = pgTable(
  'plans',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    rank: smallint('rank').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    priceMonthCents: integer('price_month_cents').notNull().default(0),
    priceYearCents: integer('price_year_cents').notNull().default(0),
    perSeat: boolean('per_seat').notNull().default(false),
    minSeats: smallint('min_seats').notNull().default(1),
    realRunsUnlimited: boolean('real_runs_unlimited').notNull().default(false),
    deviceRealRunsPerMonth: integer('device_real_runs_per_month'),
    accountExtraRealRunsPerMonth: integer('account_extra_real_runs_per_month'),
    maxSyncedMachines: smallint('max_synced_machines').notNull().default(0),
    historySync: boolean('history_sync').notNull().default(false),
    schedules: boolean('schedules').notNull().default(false),
    exports: boolean('exports').notNull().default(false),
    fleetReports: boolean('fleet_reports').notNull().default(false),
    createdAt: created(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('plans_id_format', sql`${t.id} ~ '^[a-z][a-z0-9_]{1,31}$'`),
    check('plans_name_len', sql`char_length(${t.name}) between 1 and 40`),
    check('plans_prices_nonneg', sql`${t.priceMonthCents} between 0 and 1000000 and ${t.priceYearCents} between 0 and 10000000`),
    check('plans_min_seats', sql`${t.minSeats} between 1 and 1000`),
    check('plans_run_limits', sql`coalesce(${t.deviceRealRunsPerMonth}, 0) between 0 and 100000 and coalesce(${t.accountExtraRealRunsPerMonth}, 0) between 0 and 100000`),
    check('plans_machines', sql`${t.maxSyncedMachines} between 0 and 1000`),
    pgPolicy('plans_select_active', { for: 'select', to: [anonRole, authenticatedRole], using: sql`${t.isActive}` }),
  ],
);

/**
 * One row per PAID ORDER (one paid period). A renewal is a new row starting where the
 * previous one ends, so a returned payment ends exactly the time it paid for.
 * Written only by the Polar webhook's SQL (service role).
 */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull().references(() => plans.id),
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    interval: billingInterval('interval').notNull(),
    seats: smallint('seats').notNull().default(1),
    status: subscriptionStatus('status').notNull().default('active'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    polarOrderId: text('polar_order_id').notNull().unique(),
    polarSubscriptionId: text('polar_subscription_id'),
    polarCustomerId: text('polar_customer_id'),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    check('subscriptions_period', sql`${t.periodEnd} > ${t.periodStart}`),
    check('subscriptions_seats', sql`${t.seats} between 1 and 1000`),
    index('subscriptions_user_period_idx').on(t.userId, t.periodEnd),
    index('subscriptions_team_idx').on(t.teamId, t.periodEnd),
    pgPolicy('subscriptions_select_own', { for: 'select', to: authenticatedRole, using: ownedBySignedIn(t.userId) }),
  ],
);

/**
 * A plan given without a payment (admin grant, referral reward), with its provenance.
 * A grant EXTENDS: it starts where the user's current paid/granted time of that plan ends.
 */
export const planGrants = pgTable(
  'plan_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    planId: text('plan_id').notNull().references(() => plans.id),
    source: grantSource('source').notNull(),
    grantedBy: uuid('granted_by').references(() => profiles.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [
    check('plan_grants_window', sql`${t.endsAt} > ${t.startsAt}`),
    check('plan_grants_reason_len', sql`char_length(${t.reason}) between 1 and 500`),
    index('plan_grants_user_idx').on(t.userId, t.endsAt),
    index('plan_grants_created_idx').on(t.createdAt, t.id),
    pgPolicy('plan_grants_select_own', { for: 'select', to: authenticatedRole, using: ownedBySignedIn(t.userId) }),
  ],
);

/** Webhook idempotency: one row per delivery id. Service role only (RLS on, no policy). */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull().default('polar'),
    type: text('type').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    result: text('result'),
  },
  (t) => [index('webhook_events_received_idx').on(t.receivedAt)],
).enableRLS();
