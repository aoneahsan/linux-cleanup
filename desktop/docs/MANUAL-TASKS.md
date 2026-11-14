# Manual tasks — macleanup desktop

Last Updated: 2026-11-02

The agent appends rows; a row moves to Completed only on the owner's confirmation.

## ⏳ Pending

| # | Task | Why only you | Detailed runbook | Status |
|---|---|---|---|---|
| 4 | First launch of the unsigned app on a Mac: System Settings → Privacy & Security → Open Anyway; then **Account → Sign in with Google** once | Gatekeeper prompt on a real Mac; a real Google sign-in cannot be automated | `../macleanup-docs` desktop-app install page | Pending — Google sign-in is proven up to Google's own page (2026-11-02); your first sign-in is the end-to-end proof. Tell me when you have done it |
| 7 | Create Amplitude and Microsoft Clarity projects for macleanup and add their IDs to the FilesHub vault project `macleanup` (`amplitude.api_key`, `clarity.project_id`). GA4 is done | Analytics consoles are owner-only | `docs/CONTRACTS.md` → Analytics; the agent then sets the env IDs and ships them in the next release | Pending — GA4 live since 2026-11-02 (website and desktop 5.3.3) |
| 8 | Add macleanup.aoneahsan.com and macleanup-docs.aoneahsan.com to Google Search Console and Bing Webmaster Tools (or confirm the aoneahsan.com domain property covers them) and submit each `sitemap.xml` | Search consoles are owner-only | `production-projects/search-audit-owner-handoff/reports-for-dot-agent/projects/macleanup/` (p51 branch) — the GSC agent retests from it | Pending |

## Withdrawn

- Rows 5 (release-workflow secrets) and 9 (GitHub billing hold for Actions), withdrawn 2026-11-02: GitHub Actions is retired in every repo (house rule 2026-10-31). Releases run from a Mac (`docs/release/LOCAL-RELEASE.md`), the website deploys with Wrangler and the docs publish to `gh-pages`.

## ✅ Completed

- 2026-11-02 — Row 1, Supabase project: owner, "update those manual tasks which i have completed". Evidence: ref `epcuzfzldixtftnbudba` in the FilesHub vault (account 13), 17 migrations and 12 Edge Functions live, used by every account flow.
- 2026-11-02 — Row 7, GA4 part: the owner added the Firebase web app `macleanupai` to the vault (`firebase.measurement_id` G-PK0XPGEKMQ). Website: gtag loads and a `g/collect` hit is sent live; the legal bar names usage counting; the Privacy Policy explains it. Desktop 5.3.3 sends counts with a random per-install ID. Amplitude and Clarity remain in row 7.

- 2026-11-02 — Row 3, Google OAuth client: owner, "google oauth client created, google auth enabled in supabase, all info saved in fileshub". Verified: vault `google_cloud` holds the web client id and secret; Supabase Auth has the Google provider on with that client (`/auth/v1/settings` → `google: true`); the app's loopback redirect `http://127.0.0.1:<port>/callback` is accepted and a foreign one falls back to the site URL; Google's sign-in page opens for the client with no client or redirect error; the signup hook admits Google accounts.

- 2026-11-02 — Row 10, Polar review: owner, "polar org got approved" (production org `macleanup` status `active`). Row 11 closed the same day: `POLAR_PRODUCTS` set; as a non-admin account, a production Pro monthly checkout ($4) and a 3-seat Team yearly checkout ($90) open on polar.sh with the right product, price and macleanup avatar. No real charge was asked for: the full lifecycle is proven in the sandbox (`payment-validation.md`).
- 2026-11-02 — Row 2, Polar organizations: owner, "macleanup polar orgs created and added in fileshub" (sandbox and production orgs; FilesHub payment account 14 `macleanup-polar`).
