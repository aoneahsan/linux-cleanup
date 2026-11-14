import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/** Vite config for the macleanup desktop webview (Tauri 2). */
export default defineConfig({
  logLevel: 'info',
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5929,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 5901 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: {
    sourcemap: false,
    reportCompressedSize: true,
    target: 'safari16',
    rolldownOptions: {
      checks: { pluginTimings: false },
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'aria', test: /node_modules[\\/](react-aria-components|react-aria|react-stately|@react-aria|@react-stately|@react-types|@internationalized|@swc)[\\/]/ },
            { name: 'tanstack', test: /node_modules[\\/]@tanstack[\\/]/ },
            { name: 'forms', test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/_shared/*.test.ts'],
    exclude: ['**/node_modules/**'],
    // Edge Functions import npm packages with Deno `npm:` specifiers; Node tests resolve the same modules.
    alias: {
      'npm:@polar-sh/sdk@1.0.2/2026-10': '@polar-sh/sdk/2026-10',
      'npm:@supabase/supabase-js@2.118.0': '@supabase/supabase-js',
    },
  },
});
