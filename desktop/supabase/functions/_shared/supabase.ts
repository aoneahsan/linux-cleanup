import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { HttpError } from './envelope.ts';

export type { SupabaseClient };

/** Read a required environment variable or refuse with a names-only 500. */
export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, 'internal_error', `Server is missing ${name}.`);
  return value;
}

/** The hosted key dictionaries (SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS) hold JSON. */
function keyFrom(dictionaryName: string): string {
  const key = (JSON.parse(env(dictionaryName)) as Record<string, string>)['default'];
  if (!key) throw new HttpError(500, 'internal_error', `Server is missing ${dictionaryName}.default.`);
  return key;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Runs AS THE CALLER: RLS applies. The default for every read and write a user owns. */
export function userClient(authorization: string): SupabaseClient {
  return createClient(env('SUPABASE_URL'), keyFrom('SUPABASE_PUBLISHABLE_KEYS'), {
    ...noSession,
    global: { headers: { Authorization: authorization } },
  });
}

/**
 * Bypasses RLS. Only after the function's own gate has authenticated and authorised the
 * caller, and only for: admin operations, webhook application, account deletion, and the
 * team/referral SQL that takes the caller as an explicit argument.
 */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), keyFrom('SUPABASE_SECRET_KEYS'), noSession);
}
