import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, index, integer, jsonb, numeric, pgPolicy, pgTable, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { referralStatus } from './enums';
import { planGrants } from './billing';
import { profiles } from './identity';
import { ownedBySignedIn } from './rls';

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/**
 * Admin fields (allowance pools, referral numbers, the referral off switch).
 * Bounds live on the row and are enforced by a CHECK, so a form can never store
 * a value the server would misbehave on (e.g. a referral threshold of 0).
 */
export const appConfig = pgTable(
  'app_config',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').notNull(),
    isPublic: boolean('is_public').notNull().default(false),
    minValue: numeric('min_value'),
    maxValue: numeric('max_value'),
    description: text('description').notNull().default(''),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('app_config_key_format', sql`${t.key} ~ '^[a-z][a-z0-9_]{1,63}$'`),
    check(
      'app_config_bounds',
      sql`jsonb_typeof(${t.value}) <> 'number' or (
        (${t.minValue} is null or (${t.value} #>> '{}')::numeric >= ${t.minValue})
        and (${t.maxValue} is null or (${t.value} #>> '{}')::numeric <= ${t.maxValue}))`,
    ),
    pgPolicy('app_config_select_public', { for: 'select', to: [anonRole, authenticatedRole], using: sql`${t.isPublic}` }),
  ],
);

/**
 * Who an audit row is about. audit_log references these pseudonymous rows, never a user
 * directly, so account deletion anonymises the actor here (user_id → null, label →
 * "Deleted account") while every audit_log row stays byte-for-byte unchanged.
 */
export const auditActors = pgTable('audit_actors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').unique().references(() => profiles.id, { onDelete: 'set null' }),
  label: text('label').notNull(),
  createdAt: created(),
}).enableRLS();

/** Append-only. No UPDATE/DELETE/TRUNCATE grant for any role, plus a blocking trigger. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    actorRef: uuid('actor_ref').references(() => auditActors.id),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id'),
    targetRef: uuid('target_ref').references(() => auditActors.id),
    detail: jsonb('detail').notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    check('audit_log_action_format', sql`${t.action} ~ '^[a-z_]+\\.[a-z_]+$'`),
    index('audit_log_at_idx').on(t.at.desc(), t.id.desc()),
    index('audit_log_target_idx').on(t.targetRef, t.at),
  ],
).enableRLS();

/**
 * Referral ledger. Confirmed = the invitee's account exists AND its email is verified,
 * set only by private.try_confirm_referral() (fired from an auth.users trigger), never by
 * a click. No client role holds INSERT or UPDATE.
 */
export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    referrerId: uuid('referrer_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id').notNull().unique().references(() => profiles.id, { onDelete: 'cascade' }),
    status: referralStatus('status').notNull().default('pending'),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    rewardGrantId: uuid('reward_grant_id').references(() => planGrants.id, { onDelete: 'set null' }),
    createdAt: created(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
  },
  (t) => [
    check('referrals_not_self', sql`${t.referrerId} <> ${t.inviteeId}`),
    check('referrals_points_nonneg', sql`${t.pointsAwarded} >= 0`),
    index('referrals_referrer_idx').on(t.referrerId, t.status, t.confirmedAt),
    pgPolicy('referrals_select_own', { for: 'select', to: authenticatedRole, using: ownedBySignedIn(t.referrerId) }),
  ],
);
