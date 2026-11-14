import { sql } from 'drizzle-orm';
import {
  bigint, boolean, check, index, pgPolicy, pgTable, primaryKey, smallint, text, timestamp, uuid,
} from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';
import { runPool, scheduleKind, sectionStatus } from './enums';
import { profiles } from './identity';
import { ownedBy, ownedBySignedIn, signedIn } from './rls';

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const MONTH_KEY = sql.raw(`'^[0-9]{4}-(0[1-9]|1[0-2])$'`);

/**
 * One row per REAL run (previews never claim). Counted per device and per account per
 * UTC month. device_id has no FK on purpose: the device pool survives account deletion,
 * and the row then carries no personal data (user_id is nulled).
 * Written only by public.claim_run().
 */
export const runClaims = pgTable(
  'run_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id').notNull(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    month: text('month').notNull(),
    pool: runPool('pool').notNull(),
    sections: smallint('sections').array().notNull(),
    createdAt: created(),
  },
  (t) => [
    check('run_claims_month_format', sql`${t.month} ~ ${MONTH_KEY}`),
    check('run_claims_sections_len', sql`cardinality(${t.sections}) between 1 and 64`),
    index('run_claims_device_month_idx').on(t.deviceId, t.month, t.pool),
    index('run_claims_user_month_idx').on(t.userId, t.month, t.pool),
    pgPolicy('run_claims_select_own', { for: 'select', to: authenticatedRole, using: ownedBy(t.userId) }),
  ],
);

/**
 * A synced run receipt, as numbers only. There is NO column for a path or a file name,
 * and none may ever be added: file paths never leave the computer.
 * Written only by public.record_run_summary() (Pro history sync).
 */
export const runSummaries = pgTable(
  'run_summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').notNull(),
    claimId: uuid('claim_id').unique().references(() => runClaims.id, { onDelete: 'set null' }),
    dryRun: boolean('dry_run').notNull(),
    osVersion: text('os_version').notNull(),
    diskFreeBeforeKb: bigint('disk_free_before_kb', { mode: 'number' }).notNull(),
    diskFreeAfterKb: bigint('disk_free_after_kb', { mode: 'number' }).notNull(),
    freedKb: bigint('freed_kb', { mode: 'number' }).notNull().default(0),
    // Set when the run came from a synced schedule; the schedule's name is never stored here.
    scheduleId: uuid('schedule_id').references(() => schedulesMeta.id, { onDelete: 'set null' }),
    // The "Scheduled run finished" email went out for this summary (sent at most once).
    scheduleEmailSentAt: timestamp('schedule_email_sent_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    check('run_summaries_os_len', sql`char_length(${t.osVersion}) between 1 and 40`),
    check('run_summaries_kb_nonneg', sql`${t.diskFreeBeforeKb} >= 0 and ${t.diskFreeAfterKb} >= 0 and ${t.freedKb} >= 0`),
    index('run_summaries_user_created_idx').on(t.userId, t.createdAt.desc(), t.id),
    index('run_summaries_device_created_idx').on(t.deviceId, t.createdAt),
    pgPolicy('run_summaries_select_own', { for: 'select', to: authenticatedRole, using: ownedBySignedIn(t.userId) }),
  ],
);

/** Per-section numbers of one summary (a list, so a table — never an array of objects). */
export const runSummarySections = pgTable(
  'run_summary_sections',
  {
    summaryId: uuid('summary_id').notNull().references(() => runSummaries.id, { onDelete: 'cascade' }),
    sectionId: smallint('section_id').notNull(),
    status: sectionStatus('status').notNull(),
    freedKb: bigint('freed_kb', { mode: 'number' }).notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.summaryId, t.sectionId] }),
    check('run_summary_sections_id', sql`${t.sectionId} between 0 and 15`),
    check('run_summary_sections_kb', sql`${t.freedKb} >= 0`),
    pgPolicy('run_summary_sections_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`exists (select 1 from public.run_summaries s where s.id = ${t.summaryId} and s.user_id = (select auth.uid())) and ${signedIn}`,
    }),
  ],
);

/**
 * Pro sync of schedule SPECS (what and when), never paths. The systemd user timer itself lives
 * on the computer. Writes require the `schedules` feature of the caller's effective plan.
 */
export const schedulesMeta = pgTable(
  'schedules_meta',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().default(sql`auth.uid()`).references(() => profiles.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').notNull(),
    name: text('name').notNull(),
    kind: scheduleKind('kind').notNull(),
    sectionIds: smallint('section_ids').array().notNull(),
    cadence: text('cadence').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: created(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('schedules_meta_name_len', sql`char_length(${t.name}) between 1 and 80`),
    check('schedules_meta_sections_len', sql`cardinality(${t.sectionIds}) between 1 and 64`),
    check(
      'schedules_meta_cadence',
      sql`${t.cadence} ~ '^(daily|weekly:[0-6]|monthly:([1-9]|1[0-9]|2[0-8]))@([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
    index('schedules_meta_user_idx').on(t.userId, t.createdAt),
    pgPolicy('schedules_meta_select_own', { for: 'select', to: authenticatedRole, using: ownedBySignedIn(t.userId) }),
    pgPolicy('schedules_meta_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${ownedBySignedIn(t.userId)} and (select private.has_feature('schedules'))`,
    }),
    pgPolicy('schedules_meta_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: ownedBySignedIn(t.userId),
      withCheck: sql`${ownedBySignedIn(t.userId)} and (select private.has_feature('schedules'))`,
    }),
    pgPolicy('schedules_meta_delete_own', { for: 'delete', to: authenticatedRole, using: ownedBySignedIn(t.userId) }),
  ],
);
