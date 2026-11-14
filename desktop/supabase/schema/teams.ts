import { sql } from 'drizzle-orm';
import {
  check, index, pgPolicy, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';
import { teamRole } from './enums';
import { profiles } from './identity';
import { signedIn } from './rls';

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/**
 * `private.my_team_id()` (SECURITY DEFINER, first custom migration) returns the caller's
 * team. Policies compare against it instead of sub-selecting team_members, which would
 * recurse into team_members' own policy. A list proves the policy by filtering team_id.
 */
const inMyTeam = (teamIdSql: ReturnType<typeof sql>) =>
  sql`${teamIdSql} = (select private.my_team_id()) and ${signedIn}`;

/** A Team-plan workspace. `seats` is set from the paid order; min 3 is enforced server-side. */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerId: uuid('owner_id').notNull().unique().references(() => profiles.id, { onDelete: 'cascade' }),
    seats: smallint('seats').notNull().default(3),
    createdAt: created(),
  },
  (t) => [
    check('teams_name_len', sql`char_length(${t.name}) between 1 and 80`),
    check('teams_seats', sql`${t.seats} between 1 and 1000`),
    pgPolicy('teams_select_member', { for: 'select', to: authenticatedRole, using: inMyTeam(sql`${t.id}`) }),
  ],
);

/** Seats in use. One team per account (unique user_id) keeps fleet scoping unambiguous. */
export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().unique().references(() => profiles.id, { onDelete: 'cascade' }),
    role: teamRole('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    pgPolicy('team_members_select_member', { for: 'select', to: authenticatedRole, using: inMyTeam(sql`${t.teamId}`) }),
  ],
);

/**
 * A pending seat. Accepted only by a signed-in account whose verified email equals `email`;
 * the email itself is the bearer check, so no token is stored.
 */
export const teamInvites = pgTable(
  'team_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    invitedBy: uuid('invited_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: created(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull().default(sql`now() + interval '14 days'`),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedBy: uuid('accepted_by').references(() => profiles.id, { onDelete: 'set null' }),
    // When the invite email last went out; a repeat invite re-sends at most once per 24 h.
    lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
  },
  (t) => [
    check('team_invites_email_lower', sql`${t.email} = lower(${t.email}) and char_length(${t.email}) between 3 and 254`),
    uniqueIndex('team_invites_open_unique').on(t.teamId, t.email).where(sql`${t.acceptedAt} is null`),
    index('team_invites_email_idx').on(t.email),
    pgPolicy('team_invites_select_team', { for: 'select', to: authenticatedRole, using: inMyTeam(sql`${t.teamId}`) }),
    pgPolicy('team_invites_select_invitee', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${t.email} = lower((select auth.jwt()) ->> 'email') and ${signedIn}`,
    }),
  ],
);
