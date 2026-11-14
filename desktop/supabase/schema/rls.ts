import { sql, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Shared RLS predicates. Every predicate wraps `auth.*` in a sub-select so the
 * planner evaluates it once per statement instead of once per row.
 * `private.is_anon()` is created by the first custom migration, before any policy.
 */

/** The caller owns the row: `(select auth.uid()) = <column>`. */
export const ownedBy = (column: AnyPgColumn): SQL => sql`(select auth.uid()) = ${column}`;

/** The caller signed in with a real identity (Google), not an anonymous device session. */
export const signedIn: SQL = sql`(select private.is_anon()) is false`;

/** The caller owns the row AND is signed in (account-scoped data). */
export const ownedBySignedIn = (column: AnyPgColumn): SQL =>
  sql`${ownedBy(column)} and ${signedIn}`;
