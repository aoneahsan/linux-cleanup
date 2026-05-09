# Changelog

All notable changes to `linux-cleanup` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-05-09

Initial public release.

### Distribution

- **Published as an npm package** under the `@aoneahsan` scope — runnable
  via `npx linux-cleanup` (zero install) or
  `npm install -g linux-cleanup` (persistent install). The npm
  package ships a thin Node.js launcher (`bin/linux-cleanup.js`) that locates
  the bash entry point and routes logs/reports to `~/.linux-cleanup/` so they
  survive npx temp eviction. After global install, the binary is named
  `linux-cleanup` (no scope prefix on the command itself).
- **Persistence model:** when run via npx, reports + logs persist at
  `~/.linux-cleanup/{logs,reports}/`. Override with `LINUX_CLEANUP_HOME=/path`.
- **Direct git clone** still works — logs/reports stay in the clone.

### Features

- **Default guided walkthrough** — 10-step interactive cleanup covering every
  category, with progress headers, action prompts (`a` run / `s` skip / `q` quit),
  per-step bytes-freed display, and running-total tracking.
- **Allowlist-based safety** — `safe_rm` refuses any path inside a curated list
  of protected directories (`~/Documents`, `~/.ssh`, `~/.gnupg`, `~/.config`,
  `~/.claude`, system roots, etc.) and bare `$HOME` / `/`.
- **Personal-data interactive-only** — never auto-batched, never `--yes`-able.
- **Cleanup categories:**
  - Package-manager caches: yarn v1, yarn berry, npm, npx, pnpm store + cache,
    composer, pip
  - Application caches: Chrome, Firefox/Mozilla, Brave, Chromium, Edge, Vivaldi,
    Gradle build caches + wrapper, Cypress, Playwright, TypeScript watcher, Zoom
  - Developer tools: Android AVDs, Flutter pub-cache, Dart analysis server,
    Flatpak runtimes
  - Editor extensions: VS Code / Cursor superseded versions
  - Project artifacts: stale `node_modules` finder
  - Personal: partial / orphan downloads, stale large files
  - System (sudo): apt, journal, snap revisions, kernels, /tmp, page-cache
- **Session reports** — canonical JSON (schema v1) saved on every run with
  on-demand Markdown / HTML export. HTML uses dark-mode-aware embedded CSS.
- **Reports manager** (`--reports`) — list, convert, view, open in browser,
  delete past reports.
- **Non-interactive export** (`--export FMT ID`) — script-friendly conversion.
- **Self-test** (`--self-test`) — verifies dependencies, syntax of every shell
  file, and safety-guard sanity (`is_protected` returns TRUE for `/`, `$HOME`,
  `~/Documents`, `/etc`, etc.).
- **Optional flags:** `--no-report` (skip JSON session report),
  `--cleanup-logs` (delete this run's log files at finish — reports always
  preserved).
- **`--feedback`** — prints structured bug-report instructions, what to
  include, where to send, and offers to open a pre-filled `mailto:` draft in
  the user's default mail client (with system info auto-filled).
- **`--debug-bundle`** — packages the latest log + latest JSON report + a
  system manifest (distro / kernel / bash / Node / jq versions + self-test
  output) into a single `tar.gz` at `~/.linux-cleanup/feedback/` for easy
  email attachment. Reviewable before sending.
- **Privacy:** the tool makes zero network calls. No telemetry. No analytics.
  No crash reporting. Logs and reports stay on the user's machine; the only
  data that leaves is what the user chooses to email.
- **Credits in every artifact:** log files start with a self-attributing
  header (tool name, version, author, license, date), JSON reports include a
  top-level `credits` block with author info, HTML reports footer credits the
  tool. Reproducible and clearly attributed.
- **Setup helpers:**
  - `--install-alias` — adds `cleanup` alias to `~/.bash_aliases` or `~/.zshrc`
  - `--install-cron` — schedules weekly all-safe run (Sunday 03:00)
  - `--uninstall-alias`, `--uninstall-cron` — clean removal
- **Modes:** `--walkthrough` (default), `--menu`, `--all-safe`, `--scan`,
  `--stale`, `--system`, `--partials`, `--audit`, `--node-modules`,
  `--editor-ext`, `--reports`, `--list-targets`, `--version`.
- **`NO_COLOR` env support** + `--no-color` flag.
- **All output stays inside the project folder** — logs in `logs/`, reports in
  `reports/`, cron logs in `logs/cron.log`.

### Security / safety hardening

- HTML reports escape all JSON-derived values via `jq`'s `@html` filter to
  prevent injection from malformed reports.
- `command -v` guards on every optional dependency (`snap`, `crontab`,
  `xdg-open`, `jq`).
- `realpath -m` resolves symlinks before any protected-path check, so a
  symlink cannot evade the allowlist.

---

[1.0.0]: https://example.invalid/linux-cleanup/releases/tag/v1.0.0
