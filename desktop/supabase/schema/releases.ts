import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, pgView, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { profiles } from './identity';

/**
 * Update flow, layer 2 (house law, every product): the admin-published release record.
 * The app reads the latest row for its platform and channel at start, every 15 minutes
 * and on resume; an urgent release above the running version blocks at once, a normal
 * one is announced and blocks from the next start (src/lib/releaseGate.ts).
 */

/**
 * Every surface linux-cleanup ships (the update-flow law covers the website and docs too):
 * `desktop` (the Tauri app), `web` (linux-cleanup.aoneahsan.com), `docs` (linux-cleanup-docs.aoneahsan.com).
 * The website and docs read the view with the publishable (anon) key. A new surface is an
 * `alter type ... add value`.
 */
export const releasePlatform = pgEnum('release_platform', ['desktop', 'web', 'docs']);

/** A build reads the channel it names; verification uses `test` only, never `production`. */
export const releaseChannel = pgEnum('release_channel', ['production', 'test']);

/** Urgent blocks now; normal blocks from the next start. */
export const releaseSeverity = pgEnum('release_severity', ['urgent', 'normal']);

const SEMVER = sql.raw(`'^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$'`);

/**
 * One row per published release. NEVER edited: no role holds UPDATE or DELETE, and a
 * mistake is corrected by publishing a newer row. RLS is on with no policy, so clients
 * read only the `latest_app_releases` view; admins write only through
 * public.publish_app_release() (service role, admin re-checked, audited in-transaction).
 */
export const appReleases = pgTable(
  'app_releases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platform: releasePlatform('platform').notNull(),
    channel: releaseChannel('channel').notNull(),
    version: text('version').notNull(),
    severity: releaseSeverity('severity').notNull(),
    reason: text('reason').notNull(),
    minNativeVersion: text('min_native_version'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    // The publishing admin. Set null only when that account is deleted; the audit row keeps the act.
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('app_releases_version_semver', sql`${t.version} ~ ${SEMVER}`),
    check('app_releases_min_native_semver', sql`${t.minNativeVersion} is null or ${t.minNativeVersion} ~ ${SEMVER}`),
    check('app_releases_reason_len', sql`char_length(${t.reason}) between 1 and 280 and btrim(${t.reason}) <> ''`),
    index('app_releases_latest_idx').on(t.platform, t.channel, t.publishedAt.desc(), t.id.desc()),
    index('app_releases_published_idx').on(t.publishedAt.desc(), t.id.desc()),
  ],
).enableRLS();

/**
 * The latest release per platform and channel, minus `created_by`. security_invoker is
 * false on purpose: it reads the policy-less table as its owner, and anon + authenticated
 * hold SELECT on the view only. A client reads one row (eq platform, eq channel, limit 1).
 */
export const latestAppReleases = pgView('latest_app_releases')
  .with({ securityInvoker: false })
  .as((qb) => qb
    .selectDistinctOn([appReleases.platform, appReleases.channel], {
      id: appReleases.id,
      platform: appReleases.platform,
      channel: appReleases.channel,
      version: appReleases.version,
      severity: appReleases.severity,
      reason: appReleases.reason,
      minNativeVersion: appReleases.minNativeVersion,
      publishedAt: appReleases.publishedAt,
    })
    .from(appReleases)
    .orderBy(appReleases.platform, appReleases.channel, sql`${appReleases.publishedAt} desc`, sql`${appReleases.id} desc`));
