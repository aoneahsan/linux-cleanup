# macleanup desktop — project context

Last Updated: 2026-11-02

## Identity

The macleanup desktop app for macOS: a Tauri 2 + React window over the same `macleanup.sh` the public CLI ships. Plans (Free, Pro, Team) are sold here. Program record: `../docs/features/macleanup-5/`. Completion category (owner, 2026-10-30): **Other — desktop app + CLI**.

## Supabase

- ref: `epcuzfzldixtftnbudba` (eu-west-3), url `https://epcuzfzldixtftnbudba.supabase.co`
- account: webdeveloperahsan@gmail.com (holds a PAT)
- registered in FilesHub: yes, Supabase project id 24, linked to FilesHub project `macleanup` (id 72) on 2026-10-30
- Applied: 12 migrations (2026-10-30), 12 Edge Functions, function secrets `FILESHUB_API_KEY`, `APP_WEBSITE_URL`. Polar (2026-11-02): production checkout live after Polar approved the org; sandbox purchase, plan grant and returned payment proven (`docs/features/polar-billing/POLAR-SETUP.md`). Google provider on since 2026-11-02 (owner's OAuth client, vault `google_cloud`; loopback redirects `http://127.0.0.1/**`). Release emails (2026-11-02, owner): important product updates go to every account as account emails; release news and optional updates are opt-in only through the FilesHub list "macleanup news" (website form with double opt-in, Account → Emails switch via the `news` function); contract in `docs/CONTRACTS.md`. Analytics: GA4 live on the website and desktop 5.3.3 (2026-11-02); the CLI counts nothing.
- Live probes 2026-10-30: anonymous claim with section 0 → 200 (device pool); another anonymous user reads 0 rows; direct insert → 403; section 28 → 422; email sign-up → 403 (Google-only hook); delete-account without a token → 401.

## Owner decisions (2026-10-30)

- Support email: aoneahsan@gmail.com (Terms, Privacy, Polar, receipts).
- Updater key: the new key generated 2026-10-30 is permanent; 4.6.x desktop installs reinstall once from the download page.
- Prices (approved 2026-10-29, admin fields): Free $0 (15 + 15 real runs a month); Pro $4/month or $36/year, history sync up to 5 Macs; Team $3/seat/month or $30/seat/year, minimum 3 seats.

## Known limits

- The device pool is keyed on a device id the app generates. A reinstall gets a new id and a new monthly pool. Runs cost nothing to serve, so this is accepted as generous free-tier behaviour, not defended against.
