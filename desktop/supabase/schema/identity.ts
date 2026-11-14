import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase';
import { platformRole } from './enums';
import { ownedBy, ownedBySignedIn } from './rls';

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * One row per auth user (anonymous devices included), created by a trigger on auth.users.
 * Client-writable column: display_name only (column grant). limits_override is an admin field.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
    email: text('email'),
    displayName: text('display_name'),
    referralCode: text('referral_code').unique(),
    limitsOverride: jsonb('limits_override'),
    welcomeSentAt: timestamp('welcome_sent_at', { withTimezone: true }),
    // When this account became a verified, non-anonymous (Google) account; set by the auth trigger.
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    check('profiles_display_name_len', sql`char_length(${t.displayName}) between 1 and 80`),
    check('profiles_limits_override_object', sql`${t.limitsOverride} is null or jsonb_typeof(${t.limitsOverride}) = 'object'`),
    index('profiles_created_idx').on(t.createdAt, t.id),
    pgPolicy('profiles_select_own', { for: 'select', to: authenticatedRole, using: ownedBySignedIn(t.id) }),
    pgPolicy('profiles_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: ownedBySignedIn(t.id),
      withCheck: ownedBySignedIn(t.id),
    }),
  ],
);

/**
 * Platform staff only. Absence of a row = ordinary user. Written by the seed trigger
 * and by service-role SQL; clients may read their own row to decide what to draw.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
    role: platformRole('role').notNull(),
    grantedBy: uuid('granted_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: created(),
  },
  (t) => [pgPolicy('user_roles_select_own', { for: 'select', to: authenticatedRole, using: ownedBy(t.userId) })],
);

/**
 * Synced preferences of a signed-in account: rebindable shortcuts, appearance axes and the
 * account half of the legal notice flag. Anonymous devices keep these local. Clients write
 * it insert-then-update (never PostgREST upsert: an upsert needs UPDATE on every column it
 * sends, and user_id is deliberately not updatable). Account deletion cascades the row.
 */
export const userSettings = pgTable(
  'user_settings',
  {
    userId: uuid('user_id').primaryKey().default(sql`auth.uid()`).references(() => authUsers.id, { onDelete: 'cascade' }),
    shortcuts: jsonb('shortcuts').notNull().default(sql`'{}'::jsonb`),
    appearance: jsonb('appearance').notNull().default(sql`'{}'::jsonb`),
    legalNoticeSeenAt: timestamp('legal_notice_seen_at', { withTimezone: true }),
    updatedAt: updated(),
  },
  (t) => [
    check('user_settings_shortcuts_object', sql`jsonb_typeof(${t.shortcuts}) = 'object' and octet_length(${t.shortcuts}::text) <= 16384`),
    check('user_settings_appearance_object', sql`jsonb_typeof(${t.appearance}) = 'object' and octet_length(${t.appearance}::text) <= 4096`),
    pgPolicy('user_settings_select_own', { for: 'select', to: authenticatedRole, using: ownedBySignedIn(t.userId) }),
    pgPolicy('user_settings_insert_own', { for: 'insert', to: authenticatedRole, withCheck: ownedBySignedIn(t.userId) }),
    pgPolicy('user_settings_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: ownedBySignedIn(t.userId),
      withCheck: ownedBySignedIn(t.userId),
    }),
  ],
);

/**
 * A computer. `id` is the random device id the app generates once and keeps locally.
 * Registered (and re-bound to the current caller) by the allowance functions.
 * Anonymous sessions may read and rename their own device: device-scoped rights.
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name'),
    osVersion: text('os_version'),
    createdAt: created(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    // One-time handoff to the next session on this computer (sha256 of a server-issued code).
    handoffCodeHash: text('handoff_code_hash'),
    handoffExpiresAt: timestamp('handoff_expires_at', { withTimezone: true }),
  },
  (t) => [
    check('devices_name_len', sql`char_length(${t.name}) between 1 and 80`),
    check('devices_os_len', sql`char_length(${t.osVersion}) between 1 and 40`),
    index('devices_user_idx').on(t.userId, t.lastSeenAt),
    pgPolicy('devices_select_own', { for: 'select', to: authenticatedRole, using: ownedBy(t.userId) }),
    pgPolicy('devices_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: ownedBy(t.userId),
      withCheck: ownedBy(t.userId),
    }),
    pgPolicy('devices_delete_own', { for: 'delete', to: authenticatedRole, using: ownedBy(t.userId) }),
  ],
);
