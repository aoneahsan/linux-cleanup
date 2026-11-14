# Packages — macleanup desktop

Last Updated: 2026-11-02 · installed with yarn (node-modules linker), latest stable via npm-check-updates.

| Package | Version | Kind | Why |
|---|---|---|---|
| `@polar-sh/sdk` | 1.0.2 | dev | Vitest resolves the Edge Functions' `npm:@polar-sh/sdk@1.0.2/2026-10` import (Polar signature test); provisioning by API |
| `@hookform/resolvers` | 6.0.2 | runtime | zod resolver for react-hook-form |
| `@supabase/supabase-js` | 2.118.0 | runtime | account client (optional; local-only without env) |
| `@tanstack/react-query` | 5.105.0 | runtime | server/local command data |
| `@tanstack/react-router` | 1.170.46 | runtime | routing + typed URL search state |
| `@tanstack/react-table` | 9.3.1 | runtime | admin/user tables (W4) |
| `@tauri-apps/api` | 2.12.4 | runtime | invoke + events |
| `@tauri-apps/plugin-notification` | 2.8.0 | runtime | run-finished notifications (W3) |
| `@tauri-apps/plugin-opener` | 2.7.2 | runtime | open URLs in the system browser |
| `@tauri-apps/plugin-process` | 2.4.0 | runtime | relaunch after update (W3) |
| `@tauri-apps/plugin-updater` | 2.14.1 | runtime | update check/install (W3) |
| `@tauri-apps/plugin-window-state` | 2.5.0 | runtime | remembered window size (W3) |
| `d3-scale` | 4.0.2 | runtime | disk gauge scale |
| `driver.js` | 1.10.2 | runtime | page tours behind src/lib/tour.ts |
| `react` | 19.3.1 | runtime | UI |
| `react-aria-components` | 1.22.1 | runtime | every interactive primitive |
| `react-dom` | 19.3.1 | runtime | UI |
| `react-hook-form` | 7.91.0 | runtime | forms |
| `strata-storage` | 3.1.1 | runtime | the only storage layer |
| `zod` | 4.6.7 | runtime | schemas + search validation |
| `zustand` | 5.0.16 | runtime | client state |
| `@tailwindcss/vite` | 4.3.3 | dev | Tailwind v4 |
| `@tauri-apps/cli` | 2.12.4 | dev | tauri CLI |
| `@types/d3-scale` | 4.0.9 | dev | types |
| `@types/node` | 26.6.6 | dev | types for config/tests |
| `@types/react` | 19.3.0 | dev | types |
| `@types/react-dom` | 19.3.0 | dev | types |
| `@vitejs/plugin-react` | 6.1.2 | dev | React for Vite |
| `eslint` | 10.13.0 | dev | lint (ESLint 10) |
| `eslint-plugin-jsx-a11y` | 6.10.2 | dev | a11y lint (accepted ^9 peer on ESLint 10) |
| `eslint-plugin-react-hooks` | 7.1.1 | dev | hooks lint |
| `globals` | 17.13.0 | dev | lint globals |
| `tailwindcss` | 4.3.3 | dev | styles |
| `typescript` | 6.0.3 | dev | ~6.0.3 per known-issues ledger (TS7 blocked) |
| `typescript-eslint` | 8.72.1 | dev | TS lint |
| `vite` | 8.3.5 | dev | bundler |
| `vitest` | 5.0.5 | dev | tests |

Pins: `typescript` stays on ~6.0.x while the global known-issues ledger lists TypeScript 7 peers as broken. `eslint-plugin-jsx-a11y` declares an ESLint ^9 peer; accepted on ESLint 10 per the ledger.
