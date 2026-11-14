/**
 * Typed access to the client-safe environment (docs/CONTRACTS.md §4). The Supabase
 * pair is optional: without it the app runs local-only and account screens name
 * the missing variables.
 */
const read = (v: string | undefined): string => (typeof v === 'string' ? v.trim() : '');

const supabaseUrl = read(import.meta.env.VITE_SUPABASE_URL);
const supabaseKey = read(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

/** Names of the Supabase variables that are not set (never their values). */
export const missingSupabaseVars: string[] = [
  ...(supabaseUrl ? [] : ['VITE_SUPABASE_URL']),
  ...(supabaseKey ? [] : ['VITE_SUPABASE_PUBLISHABLE_KEY']),
];

export const env = {
  supabaseUrl,
  supabaseKey,
  accountsConfigured: missingSupabaseVars.length === 0,
  websiteUrl: read(import.meta.env.VITE_APP_WEBSITE_URL) || 'https://linux-cleanup.aoneahsan.com',
  docsUrl: read(import.meta.env.VITE_DOCS_URL) || 'https://linux-cleanup-docs.aoneahsan.com',
  appVersion: __APP_VERSION__,
  /** The release-record channel this build reads (update flow layer 2). Test builds set `test`. */
  releaseChannel: (read(import.meta.env.VITE_RELEASE_CHANNEL) === 'test' ? 'test' : 'production') as 'production' | 'test',
  /** Analytics ids: each tool loads only when its id is set. */
  ga4Id: read(import.meta.env.VITE_GA4_MEASUREMENT_ID),
  amplitudeKey: read(import.meta.env.VITE_AMPLITUDE_API_KEY),
  clarityId: read(import.meta.env.VITE_CLARITY_PROJECT_ID),
} as const;

/** Support contact shown in Account and Help. */
export const SUPPORT_EMAIL = 'aoneahsan@gmail.com';
