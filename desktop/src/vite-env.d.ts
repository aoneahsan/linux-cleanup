/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_APP_WEBSITE_URL?: string;
  readonly VITE_DOCS_URL?: string;
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly VITE_AMPLITUDE_API_KEY?: string;
  readonly VITE_CLARITY_PROJECT_ID?: string;
  readonly VITE_RELEASE_CHANNEL?: string;
  readonly VITE_WHITE_LABEL_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** package.json version, injected by vite.config.ts. */
declare const __APP_VERSION__: string;
