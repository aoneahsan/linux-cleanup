import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle authors the schema; the Supabase CLI applies it (`supabase db push`).
 * `drizzle-kit generate` is offline: it diffs `schema/` against `migrations/meta/`
 * and writes flat, timestamp-prefixed SQL the Supabase CLI reads.
 * Banned here: `drizzle-kit push`, `drizzle-kit migrate`, the `@rc` line.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './schema/index.ts',
  out: './migrations',
  schemaFilter: ['public'],
  entities: { roles: { provider: 'supabase' } },
  migrations: { prefix: 'supabase' },
  strict: true,
  verbose: true,
});
