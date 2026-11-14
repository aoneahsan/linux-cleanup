/**
 * The Supabase client, created only when both client-safe variables exist
 * (CONTRACTS §4). Without them the app is local-only and account screens say so.
 * Auth persists through strata-storage, never raw web storage.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';
import { load, remove, save } from '@/lib/storage';

const authStorage = {
  getItem: (key: string): string | null => load<string | null>(`auth:${key}`, null),
  setItem: (key: string, value: string): void => save(`auth:${key}`, value),
  removeItem: (key: string): void => remove(`auth:${key}`),
};

let client: SupabaseClient | null = null;

/** The client, or null in local-only mode. */
export function supabase(): SupabaseClient | null {
  if (!env.accountsConfigured) return null;
  client ??= createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
  });
  return client;
}
