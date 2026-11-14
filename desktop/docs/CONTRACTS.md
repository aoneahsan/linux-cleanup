# macleanup desktop — contracts between the UI, the Rust core and the backend

Last Updated: 2026-10-30

This file is the single agreement between `src/` (React UI), `src-tauri/` (Rust core) and `supabase/` (backend). The main session owns it. A change goes here first, then into code.

## 1. CLI event stream

The Rust core spawns the bundled `macleanup.sh` with `--json-events` and forwards each line. Schema: `../macleanup/docs/json-events.md` (schema version 1). The UI parses it with one pure parser, `src/lib/events.ts`, which carries the pre-approved test.

## 2. Tauri commands (Rust → `invoke`)

All commands return `Result<T, AppError>`. `AppError` serialises as `{ kind: string, message: string }`. Its kinds are `cli_missing`, `cli_failed`, `permission_denied`, `not_found`, `invalid_input`, `io` and `cancelled`.

| Command | Args | Returns |
|---|---|---|
| `cli_info` | — | `{ version: string, path: string, ok: boolean }` |
| `system_info` | — | `{ macos_version: string, arch: string, ram_bytes: number, device_id: string }`. `device_id` is a random UUID created once and stored in the app data dir. |
| `disk_status` | — | `{ total_kb, free_kb, purgeable_kb: number \| null, snapshots: number }` |
| `health_info` | — | `{ full_disk_access: boolean \| null, battery: { present: boolean, condition: string \| null, cycle_count: number \| null, charge_percent: number \| null } , smart_status: string \| null }`. Full Disk Access is probed by trying to read a TCC-protected path; `null` means it could not be determined. Battery comes from `ioreg`/`pmset`; SMART from `diskutil info /`. Read-only. |
| `run_cli` | `{ sections: number[], dryRun: boolean, deepOk: boolean, profile: string \| null, keepPaths?: string[], archivePaths?: string[], options?: RunOptions }` | `runId: string`. It refuses a real run of a deep section unless `deepOk` is set. Previews (`dryRun`) never need it. The ledger's keep/archive/delete choice becomes repeated `--exclude-path` (keep) and `--archive-path` (archive) flags. `RunOptions` carries the Settings screen's values to the CLI as flags. |
| `cancel_run` | `{ runId }` | `void` (sends SIGINT, then SIGTERM after 5 s) |
| `askpass_reply` | `{ requestId, password: string \| null }` | `void`. `null` means the user cancelled. The password is never logged or stored. |
| `list_local_history` | `{ limit: number }` | `[{ file, kind: "report" \| "log", modified_ms, size_bytes }]` from `~/.macleanup/{reports,logs}`, newest first |
| `open_path` / `reveal_path` | `{ path }` | `void`. Only paths inside `~/.macleanup/` are allowed; anything else gets `permission_denied`. |
| `oauth_listen` | — | `{ port: number, nonce: string }`. It starts a one-shot loopback listener on 127.0.0.1 and emits `oauth-callback`. The redirect must be `http://127.0.0.1:<port>/callback?n=<nonce>`; a callback without the matching nonce is refused. |
| `schedule_list` | — | `[ScheduleSpec]` |
| `schedule_install` | `ScheduleSpec` | `void`. It writes a user LaunchAgent `com.aoneahsan.macleanup.schedule.<id>.plist` that runs `macleanup.sh --dry-run` (preview) or `--yes --only <safe ids>` (cleanup). It rejects any deep section. |
| `schedule_remove` | `{ id }` | `void` |

`ScheduleSpec = { id: string, kind: "preview" | "cleanup", weekday: 0-6 | null (daily), hour: 0-23, minute: 0-59, sections: number[] }`. Cleanup schedules may only hold safe-batch sections (`0 3 5 7 8 9 15 18 22 26`).

`RunOptions = { idleDays?: number, cacheAgeDays?: number, unusedAppDays?: number (→ --threshold), staleBuildDays?: number, largeFileDays?: number, largeFileSizeGb?: number, scanRoots?: string[] (→ --scan-roots joined with ":"), excludePaths?: string[] (→ repeated --exclude-path, merged with keepPaths), noSudo?: boolean }`. Integers are 1–3650 (size 1–1024). Absent keys are not passed, so the CLI's own defaults and `~/.macleanuprc` apply. The Settings screen is the source of these values; the app never writes `~/.macleanuprc`.

| Command | Args | Returns |
|---|---|---|
| `backup_status` | — | `{ configured: boolean, destinations: number, last_backup_ms: number \| null, local_snapshots: number }` from `tmutil destinationinfo` and `tmutil latestbackup` (read-only; `null` fields when unreadable) |
| `export_json` | `{ filename: string, content: string }` | `{ path: string }`. It writes `~/Downloads/<filename>` (the filename is sanitised to `[A-Za-z0-9._-]` and must end in `.json`; max 5 MB) with mode 600 and reveals it in Finder. Used by "Download my data". |
| `set_tray_mode` | `{ enabled: boolean }` | `void`. When on, closing the window keeps a menu-bar icon with Open macleanup, New Preview and Quit. When off, closing hides the window (the Dock reopens it). Persisted by the UI and re-sent at launch. |

**Scheduled runs report back.** A schedule's LaunchAgent runs the bundled script with `--json-events` and writes the stream to `~/.macleanup/schedule-runs/<scheduleId>-<epochSeconds>.ndjson` (folder 700, file 600). Commands:

| Command | Args | Returns |
|---|---|---|
| `list_schedule_runs` | — | `[{ file, scheduleId, startedMs, sizeBytes }]` — unread stream files, oldest first, at most 50 |
| `read_schedule_run` | `{ file }` | `string[]` — the NDJSON lines (file must be inside the folder; ≤ 5 MB) |
| `ack_schedule_run` | `{ file }` | `void` — renames it to `.ndjson.done` so it is ingested once |

The app ingests unread runs at launch and every 15 minutes while open: it folds each through the same event parser into a receipt (kind "scheduled"), then, for a signed-in account with history sync, sends `run-summary` with `schedule` and `email_on_schedule`, then acks the file. Paths in the stream stay on the Mac like every other receipt.

`ScheduleSpec` gains `dayOfMonth: 1-28 | null`. When set, the schedule runs monthly on that day (`weekday` is then ignored). Names stay local; the server mirror (`schedules_meta`) carries the cadence only.

The opener capability allows `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles` (the Full Disk Access pane) in addition to `https://*`.

### Events (Rust → `listen`)

| Event | Payload |
|---|---|
| `cli-event` | `{ runId, line: object }` — one parsed NDJSON object, forwarded as is |
| `cli-stderr` | `{ runId, text }` — human output, shown only in the "details" drawer |
| `cli-exit` | `{ runId, code: number \| null, cancelled: boolean }` |
| `askpass-request` | `{ requestId, prompt }` — the CLI asked for an administrator password through `SUDO_ASKPASS` |
| `oauth-callback` | `{ url }` — the full loopback URL, carrying `code` for the PKCE exchange |
| `menu` | `{ id }` — a native menu item was chosen (`preferences`, `check-updates`, `new-preview`, `history`, `help`, `about`) |

Plugins: `updater`, `process` (relaunch), `notification`, `opener`, `single-instance`, `window-state`, `deep-link` (not needed; the loopback flow is used instead).

## 3. Backend (Supabase Edge Functions; `Authorization: Bearer <session JWT>`)

Every device signs in anonymously on first launch (Supabase anonymous auth), so every call has a JWT. Google sign-in uses the system browser with PKCE and the loopback port from `oauth_listen`. It links Google to the anonymous user (`linkIdentity`); when the Google account already exists, it signs in to that account.

| Function | Request | Response |
|---|---|---|
| `allowance` (GET) | `?device_id=` | `{ month: "YYYY-MM", resets_at, device: { used, limit }, account: { used, limit } \| null, plan: { id, name, unlimited: boolean } }` |
| `claim-run` (POST) | `{ device_id, sections: number[] }` | `{ ok: true, claim_id, pool: "device" \| "account" \| "plan", allowance }` or `{ ok: false, reason: "limit_reached", allowance }`. Only real runs call it; previews never do. |
| `run-summary` (POST, signed-in Google accounts only) | `{ claim_id \| null, dry_run, device_id, macos_version, disk_free_before_kb, disk_free_after_kb, sections: [{ id, status, freed_kb }] }` | `{ ok: true, id }`. It never accepts a path or file name. The schema has no column for one. |
| `polar-checkout` (POST) | `{ plan_id, interval: "month" \| "year", seats?: number }` | `{ url }` |
| `polar-webhook` | Polar → server | grants or ends the plan at the database price |
| `team` (POST) | `{ action: "create" \| "invite" \| "invites" \| "accept" \| "remove" \| "fleet", ... }` | per action; `invites` lists the caller's own pending invites (verified email): `{ invites: [{ invite_id, team_name, invited_by, expires_at }] }`, newest 20, and the Team screen shows the newest with Accept |
| `delete-account` (POST) | `{ confirm: "DELETE" }` | `{ ok: true }` |
| `account-welcome` (POST, after the first Google sign-in) | `{ invite_code?: string }` | `{ ok: true }`. Records the referral invite code once, sends the welcome email once, and emails the referrer when the invitee is confirmed (a database trigger confirms on a verified email, never a click). |
| `admin` (POST, admin role only, every write audited) | `{ action, ... }`, where action is one of: `stats`, `users.list`, `users.view`, `users.set_plan`, `users.override_limits`, `plans.list`, `plans.upsert`, `grants.list`, `grants.create`, `grants.revoke`, `config.get`, `config.set`, `audit.list` | per action, paginated `{ items, next_cursor }` |

`user_settings` (one row per account, own only, insert/update own): `{ user_id, shortcuts jsonb, appearance jsonb, legal_notice_seen_at timestamptz | null, updated_at }`. Shortcuts and appearance sync through it for signed-in Google accounts (anonymous devices keep them local); the legal bar's account flag is `legal_notice_seen_at`. `devices` is readable for the signed-in account's own rows (Account → "Macs on this account").

RPCs clients call directly (`supabase.rpc`), each authenticated-only and checking the caller itself:
- `device_handoff_begin({ p_device_id })` → `{ code }` (valid 15 minutes, single use). The current owner of a device calls it before the session on that Mac changes (signing in to an existing Google account, or signing out).
- `device_handoff_complete({ p_device_id, p_code })` → `{ device_id }`. The new session takes the device; a wrong, used or expired code → 42501 `handoff_invalid`. If no hand-over is possible, the app generates a new device id.
- `export_my_data()` → `{ exported_at, profile, platform_role, plan_id, devices, subscriptions, plan_grants, user_settings, team, schedules, run_summaries, referrals, run_claims }` (summaries and claims capped at the newest 500). "Download my data" uses it.

`run-summary` also accepts an optional `schedule: { id, name, ran_at_label, next_run_label }` when the run came from a schedule (`id` = a `schedules_meta` row the caller owns; the labels are display strings the app formats). When it is present, the caller's plan includes schedules, and `email_on_schedule: true` is sent (the Settings → Notifications switch "Email me when a scheduled run finishes", off by default), the server sends the branded "Scheduled run finished" email once per summary. No path or file name is ever part of it.

Errors added: `allowance` and `claim-run` answer 403 `device_owned` when the device belongs to another account; `team` `create`/`invite` answer 403 `plan_required` without a plan that includes fleet reports, and `invite` returns `email_sent: false` when the same invite was emailed in the last 24 hours.

**Analytics (owner, 2026-10-30: follow the fleet rule — on by default, told once, no opt-out; the CLI stays telemetry-free).** One service fronts GA4, Amplitude and Clarity behind env IDs `VITE_GA4_MEASUREMENT_ID`, `VITE_AMPLITUDE_API_KEY`, `VITE_CLARITY_PROJECT_ID`. With no ID set, nothing loads and nothing is collected, and the legal bar carries no analytics line. Events are counts of screens and actions from one registry; they never carry a path, a file name, a section's item list, an email or a device id. The privacy page and the bar's analytics line change in the same release that sets the IDs. **GA4 live 2026-11-02** (`G-PK0XPGEKMQ`, the Firebase web app `macleanupai`): website and desktop 5.3.3. In the app, gtag runs with `client_storage: 'none'` and a random per-install `client_id` kept in app storage, because `tauri://localhost` keeps no reliable cookies; signed-in counts also carry the account's random id as `user_id`. Amplitude and Clarity wait for their IDs (MANUAL row 7).

Rows that clients read directly under RLS: `plans` (active only, public), `app_config` (rows with `is_public = true`, which includes both allowance numbers, so the signed-out Account screen can show the "+15 after sign-in" pool), `profiles` (own), `run_summaries` (own, plus team fleet through `team`), `referrals` (own).

Admin fields with their defaults (in `app_config`): `device_real_runs_per_month = 15` and `account_extra_real_runs_per_month = 15`, plus the referral settings `referral_points_per_confirmed = 10`, `referral_pro_month_threshold = 3` and `referral_pro_months_cap_per_year = 4`. Plan limits live on the `plans` row. The seeded plans are free ($0), pro ($4/month, $36/year, unlimited real runs, plus history sync, schedules, exports and multi-Mac reports) and team ($3 per seat per month, minimum 3 seats, Pro for every seat plus fleet reports). Prices are admin fields. The seeded admins are `zaionsmanager@gmail.com` and `aoneahsan@gmail.com`.

## 4. Environment (`.env`, committed — the repo is private)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (client-safe), `VITE_APP_WEBSITE_URL=https://macleanup.aoneahsan.com` and `VITE_DOCS_URL=https://macleanup-docs.aoneahsan.com`, and `[OPTIONAL]` `VITE_RELEASE_CHANNEL` (`production` default, or `test`): the release-record channel the update gate reads; only a test build sets `test`. When the Supabase variables are missing, the app runs **local-only**: previews, runs, receipts, history, settings and schedules UI all work. Account features show a named "Account service not configured (VITE_SUPABASE_URL missing)" state instead of failing silently. Server secrets (service role, Polar, FilesHub) live only in Supabase function secrets.

## Assistant (2026-10-30)

The Explain-my-preview assistant (owner decision 2026-10-30; design and data flow in `docs/AI.md`). It is one Edge Function, `assistant` (`verify_jwt = true`), with three routes. Anonymous device sessions and Google accounts can both call it. `device_id` is the same id the allowance uses, and a device another account owns answers 403 `device_owned`.

| Route | Request | Response |
|---|---|---|
| `assistant/status` (GET) | `?device_id=` | `{ ok: true, level: "spark" \| "pulse" \| "surge", questions_left, questions_limit, month: "YYYY-MM", resets_at, paused_until: string \| null }`. It shows no key, balance, model or provider. Read it once per stale window (10 minutes) and after each ask, never on a loop. |
| `assistant/ask` (POST) | `{ device_id, question: string (1–500 characters), sections: [{ id: 0–27, planned_kb: integer, tier: "routine" \| "trash" \| "permanent" \| "read", item_count: integer, status: "pending" \| "running" \| "completed" \| "skipped" \| "failed", title?: string }] }` (1–28 sections, unique ids) | `{ ok: true, answer, sources: string[], level, questions_left, questions_limit, month, resets_at }`, or `{ ok: false, reason: "limit_reached", level, questions_left: 0, ... }` |
| `assistant/transcribe` (POST, `multipart/form-data`) | `audio` (a file of type `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/x-m4a` or `audio/aac`, at most 1.5 MB), `device_id`, `duration_ms` (1–30000) | `{ ok: true, transcript }` (at most 500 characters, shown for the person to confirm or edit before asking), or `{ ok: false, reason: "limit_reached", ... }` |

**The allow-list is enforced by the server.** Any other key, on the body or on a section, gets a 422 `invalid_request`. A `title` that contains `/`, `\` or `~`, or a token that looks like a file extension, is also refused. The app sends no title; the server uses its own catalogue titles. A path, a file name or an item label never leaves the Mac, as with every other sync. The question is the person's own words.

**Charging.** Each answered `ask` counts one question in the UTC month. It is refunded when no answer comes back, and nothing is counted while the assistant is resting. `transcribe` needs a question left but does not spend one. Audio is not stored.

**Errors added:**

- `503 ai_paused` with `paused_until` when neither the free credit nor a paid fallback can answer. Nothing is charged.
- `502 ai_unavailable` when the provider fails. The question is refunded.
- `413 audio_too_large`.
- `422 audio_too_long`, when the declared or measured length is over 30 s.
- `422 invalid_request`, for the allow-list.

`sources` holds only macleanup docs URLs that were offered to the model.

**Admin fields** (plan row): `ai_tier` (`economy` \| `standard` \| `enhanced`), `ai_surge_after_paid_months` (null means never) and `ai_questions_per_month`. The seeded values are Free economy/3/30, Pro standard/3/300 and Team enhanced/3/1000. `plans.upsert` accepts the three keys. `users.override_limits` accepts `ai_tier` and `ai_questions_per_month`.

## Releases (2026-10-30)

Update flow layer 2 (house law, every product; skill `aoneahsan-cccs-update-flow`). Admins publish a release record. Each surface reads the newest record for its own platform and channel, and decides with the pure `decide()` in `src/lib/releaseGate.ts` (Vitest).

**Platforms:** `desktop` (the Tauri app), `web` (macleanup.aoneahsan.com) and `docs` (macleanup-docs.aoneahsan.com). **Channels:** `production` and `test`. A build reads the channel it names. Verification uses `test` only, never a production row. **Severity:** `urgent` blocks now. `normal` shows a notice now and blocks from the next start until the surface is updated.

**Read (every surface, no session needed).** The view `latest_app_releases` returns one row per platform and channel. Its columns are `id, platform, channel, version, severity, reason, min_native_version, published_at`; `created_by` is not exposed. `anon` and `authenticated` hold SELECT on the view only, never on the `app_releases` table. The view reads the table as its owner (`security_invoker = false`).

- App: `supabase.from('latest_app_releases').select(...).eq('platform','desktop').eq('channel',<channel>).limit(1)` (`src/services/releases.ts` `fetchLatestRelease`).
- Website and docs, with the publishable key only: `GET <SUPABASE_URL>/rest/v1/latest_app_releases?platform=eq.web&channel=eq.production&limit=1`, headers `apikey: <publishable key>` (and `Authorization: Bearer <publishable key>` for older clients). `docs` uses `platform=eq.docs`.
- It is checked at start (after the first paint), every 15 minutes, and when the window becomes visible again (at most once a minute). A failed read fails open, except that a normal release stored by an earlier start still blocks.

**Gate decision** (`decide({ running, record, stored, startId, now })` → `none | notice | block`):

| Record | Running vs record | Stored notice | Result |
|---|---|---|---|
| none or read failed | — | none, or stored this start | `none` |
| none or read failed | below the stored version | stored by an earlier start | `block` |
| any | running ≥ record | any | `none`, and the stored notice is cleared |
| urgent | older | — | `block` now |
| normal | older | none, or stored this start | `notice`, then store `{ version, reason, storedAt, startId }` |
| normal | older | stored by an earlier start and still unmet | `block` |

Versions are strict `x.y.z`. An invalid record counts as no record, and an invalid stored notice is cleared. An invalid running version fails open. None of these ever blocks. The app's running version is `__APP_VERSION__`. The stored notice lives in strata-storage (device area). A "start" is one page load or cold start (a module-level id).

**Update action:** desktop runs the Tauri updater (`check()` → `downloadAndInstall()` → `relaunch()`), falling back to the GitHub Releases page. Web and docs ask the service worker to take over and reload.

**Admin** (`admin` Edge Function, admin role, the SQL re-checks it):

| Action | Request | Response |
|---|---|---|
| `releases.list` | `{ platform?, channel?, cursor?, limit? (1–20, default 20) }` | `{ ok, items: [{ id, platform, channel, version, severity, reason, min_native_version, published_at, published_by }], next_cursor }`, newest first |
| `releases.publish` | `{ platform, channel, version: "x.y.z", severity: "urgent"\|"normal", reason (1–280, trimmed), min_native_version?: "x.y.z" }` | `{ ok, release, previous_version }`. The publish and its audit row (`release.publish`) are one transaction. `previous_version` lets the admin page warn, without blocking, when the new version is not above it. |

A release is never edited or deleted. A mistake is corrected by publishing a newer row; publishing a `test` row at `0.0.0` clears a test. Errors: `403 forbidden` (not an admin) and `422 invalid_request`. RPCs (service role only): `publish_app_release(p_actor, p_platform, p_channel, p_version, p_severity, p_reason, p_min_native_version)` and `list_app_releases(p_actor, p_platform, p_channel, p_cursor, p_limit)`.

## Receipt backups (2026-10-30)

Pro receipt backup. Owner decision, 2026-10-30: *"Receipt and report backup for Pro: section ids, sizes, statuses — no paths; restore on another Mac"*. Only signed-in Google accounts can use it. The summary is stored as a **private** FilesHub object, written with the server-only secret `FILESHUB_STORAGE_API_KEY`. The app never sees the key or the object id.

**`receipt-backup` Edge Function:**

| Method | Request | Response |
|---|---|---|
| `POST` | `{ device_id, summary }`, at most 256 KB | `{ ok, backup, used, max }` |
| `GET` | `?cursor=&limit=` (default 20, max 50) | `{ ok, items: [backup], next_cursor, used, max, included }`, newest first |
| `GET` | `?id=<uuid>` | `{ ok, backup, summary }`: the server fetches the object; used to restore on another Mac |
| `DELETE` | `?id=<uuid>` | `{ ok, deleted: true }`. The FilesHub object is deleted first, then the row. |

`backup = { id, device_id, receipt_id, receipt_at, sections_count, freed_kb, size_bytes, created_at }`.

**`summary` (schema 1, strict allow-list; any other key → 422):** `{ schema: 1, receipt_id ([A-Za-z0-9_-]{1,64}), at (epoch ms), kind: "manual"|"scheduled", dry_run, interrupted, cancelled, macos_version, app_version? ("x.y.z"), freed_kb, free_before_kb|null, free_after_kb|null, total_kb|null, snapshots, elapsed_s|null, tally: { attempted, completed, skipped, failed }, sections: [{ id (0–27, unique), status: "pending"|"running"|"completed"|"skipped"|"failed", freed_kb, planned_kb, item_count }] (≤ 64) }`. It has no section title, skip reason, run name, report, log or path. The server also refuses any string containing `/`, `\`, `~` or `..`, and stores only the re-serialised allow-listed object. The app builds the summary with `toBackupSummary()` (`src/services/backups.ts`).

**Gate (POST):** shape (422, 413 `payload_too_large`) → session (401) → signed in (403 `signed_in_required`) → plan includes backup (403 `plan_required`) → Mac not owned by another account (403 `device_owned`) → not already backed up (409 `duplicate_backup`) → under the plan's cap (409 `limit_reached`) → upload → row. The SQL re-checks every rule under a per-account lock. If the row is then refused, the uploaded object is deleted. Reading, restoring and deleting do not need the plan, so a downgraded account keeps its own backups.

**Admin fields** (on the plan row): `receipt_backup` (boolean) and `receipt_backup_max` (0–100000). Seeded values: Free `false/0`, Pro `true/100`, Team `true/500`. `plans.upsert` must accept these two keys; until it does, they are edited only through `admin_plan_upsert`, which already handles them.

**Account deletion:** before any other step, `delete-account` deletes every backup's FilesHub object and then its row, 50 at a time. A storage failure stops the deletion with 502 and nothing else is touched, so a retry is safe (an object that is already gone counts as deleted). **`export_my_data()`** adds `receipt_backups`: the newest 500 rows of metadata, without object ids.

## Release emails (2026-11-02)

Owner, 2026-11-02: release emails on the website and in the app; *"we will send important product updates as well"*, *"then they can opt in for optional updates if they like"*. Important product updates are account emails from the branded composer and go to every account. Release news and other optional updates go only to people who opt in, through the FilesHub email-marketing list **"macleanup news"** (`FILESHUB_NEWS_LIST`, double opt-in, consent `opt_in`). FilesHub owns consent, the unsubscribe link and suppression.

**`news` Edge Function** (signed-in Google accounts only; the address is the session's verified email, never a body field):

| Method | Request | Response |
|---|---|---|
| `GET` | — | `{ ok, status }` |
| `POST` | `{ on: boolean }` | `{ ok, status }` |

`status` = `none` · `active` · `pending_confirmation` (signed up on the website, not confirmed) · `unsubscribed` · `blocked` (bounced, complained or erased; `POST {on:true}` → 409 `news_blocked`). On: a new contact is added with consent `opt_in` and source `macleanup-app`; an unsubscribed one is re-subscribed with a recorded reason. Off: the contact is unsubscribed (FilesHub keeps the suppression). Errors: 401, 403 `signed_in_required`, 422, 502 `upstream_error`, 503 `news_unavailable` (list not configured). `delete-account` turns optional updates off before deleting the account.

**Website form:** `download.html#updates` posts `{ email }` from the browser to `POST https://fileshub.zaions.com/api/v1/email-lists/{list}/subscribe` with the origin-restricted form key (`MACLEANUP_NEWS_FORM_KEY`, `https://macleanup.aoneahsan.com` only). FilesHub always answers 202, so the page shows one message whatever the address. The confirmation email is the stored template `macleanup-news-confirm`, rendered by `confirmNewsEmail()` from the one layout.
