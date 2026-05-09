# Changelog

All notable changes to `linux-cleanup` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.1] — 2026-05-10

Documentation-only release. No behaviour changes.

### Added

- Comprehensive [`docs/`](./docs/README.md) tree (~32 pages, ~272 KB)
  structured along the [Diátaxis framework](https://diataxis.fr/):
  tutorials, how-to guides, reference, explanation. Every cleanup mode,
  every flag, every output path, every exit code, and the full report
  JSON schema are now documented in their own pages.
- Per-feature pages under `docs/features/` (16 pages) — walkthrough,
  menu, tui, all-safe, scan, system-cleanup, personal-stale-files,
  partial-downloads, home-audit, node-modules-finder, globals-audit,
  doctor, editor-extensions, reports, shell-alias-and-cron,
  feedback-and-crash-bundles.
- Reference pages under `docs/reference/`: cli-flags, modes,
  environment-variables, output-paths, exit-codes, report-schema.
- How-to recipes: reclaim-the-most-space, send-a-bug-report, uninstall.
- Top-level: installation, quick-start, safety, faq, troubleshooting,
  about-the-author.
- Root `README.md` gains a "Full documentation" section linking the
  most-used pages so the docs are discoverable from the project landing
  page.

### Notes

- Code, safety guards, and CLI surface are unchanged from 1.3.0.
- Internal doc links verified — no broken references.

---

## [1.3.0] — 2026-05-10

Final-polish release: visual TUI menu, automatic crash-bundle capture on
unexpected failure, and a tightened feedback loop. No new cleanup logic;
existing safety guards and staleness gates are unchanged.

### Added

- **TUI mode (`-t` / `--tui` / `-g` / `--gui`)** — whiptail/dialog-driven
  menu for users who prefer pointing-and-shooting over CLI prompts. Each
  selection drops back to the regular CLI output for the run, then loops
  back to the menu. Falls back gracefully when neither tool is installed
  with a copy-paste install hint per distro family (apt / dnf / pacman).
- **Automatic crash-bundle capture** — installs an EXIT trap that, on any
  unexpected non-zero exit (signal, syntax error, unset variable under
  `set -u`, kill, etc.), writes a self-contained `crash-<stamp>.tar.gz`
  to `~/.linux-cleanup/feedback/` containing the active session log, the
  most-recent JSON report, and a system manifest. Prints a one-liner the
  user can email to the author. Suppressed on clean exit, `Ctrl-C` (130),
  `SIGTERM` (143), and argument-parse exits (2). No network calls — the
  bundle stays on the user's machine until they choose to share it.
- TUI **About** dialog with version, contact info, license, and privacy
  guarantee inline.
- Help text and examples updated to surface `-t` / `--tui`.

### Changed

- Banner and session-summary suppression list now includes `tui` mode so
  the dialog isn't fighting log/banner output.

### Notes

- Feedback / contact / debug-bundle workflows from 1.2.x are unchanged
  and remain the recommended way to file bugs (`linux-cleanup --feedback`,
  `linux-cleanup --debug-bundle`). The new crash trap simply automates
  bundle creation when something blows up unexpectedly.

---

## [1.2.2] — 2026-05-10

### Fixed

- Minor bug fixes and internal stability improvements.

---

## [1.2.1] — 2026-05-10

Extends the v1.2.0 staleness gate to anything that's a "tool" rather than
a regenerable cache. Software/tool deletions now require BOTH conditions:
no active software depends on the asset, AND the user hasn't touched it
in ≥`--days` days (default 100).

### Changed

- **Android AVDs (`clean_android_avd`)** — was wiping the whole `~/.android/avd`
  on confirm. Now inspects each `*.avd` directory as a unit, pairs it with
  its sibling `*.ini` config, and prunes the pair only when every file in
  the AVD is ≥${DAYS}d idle. Recently-used emulator profiles survive intact.
- **VS Code / Cursor superseded extensions (`clean_editor_old_extensions`)**
  — the "newer version exists" check covered condition #1; we now also
  require the superseded version's directory to be ≥${DAYS}d idle before
  it qualifies for deletion. Recently-loaded older versions are listed but
  kept. Output now shows per-version idle days.
- **Flatpak user data (`clean_flatpak_user`)** — `~/.local/share/flatpak`
  hosts INSTALLED user-scope flatpak apps, not just caches. The module now
  refuses to touch the tree if any user-scope app is installed (queried via
  `flatpak list --user --app`) and additionally requires ≥${DAYS}d idle on
  the tree before any prune. The safer dependency cleanup is delegated to
  `flatpak uninstall --user --unused`, which the module now points to.

### Added

- **`newest_access_age_days <path>`** in `lib/common.sh`. Returns the days
  since the freshest atime/mtime anywhere under the path. Used by AVD,
  extension, and flatpak modules to enforce the idle gate at unit level.
- **`prune_stale_units <root> <days> [glob]`** helper. Treats each
  top-level child as an indivisible unit so partial-prune can't corrupt
  state (designed for AVDs, editor extensions, tool installs).

### Why

A user pointed out that v1.2.0 still wiped Android AVDs wholesale, and
that the same logic should apply to anything that's a "tool" rather than
just a cache: don't remove software the OS or another tool still depends
on, and don't remove software the user themselves used recently. v1.2.1
applies that two-condition rule consistently.

---

## [1.2.0] — 2026-05-10

Default delete strategy is now **stale-only**: nothing inside a target cache
is removed unless its files have been untouched (both atime and mtime) for
≥ `--days` days (default 100). This protects rarely-used-but-valuable
assets — Gradle wrapper distros (`~/.gradle/wrapper/dists/gradle-X.Y-all/…`)
opened every 1-2 months, Playwright browsers for an old release branch,
yarn-cached tarballs of pinned dependencies, etc. — that earlier versions
wiped wholesale.

### Changed

- **`clean_target` (the shared cleaner used by all cache modules) now
  prunes by default**, not full-wipes. It walks the target with
  `find -type f \( -atime +DAYS -a -mtime +DAYS \) -delete`, then sweeps
  empty directories. Recently-used files survive; the directory shell stays
  in place so subsequent tools find their config.
- **`run_all_safe` (`--all-safe`) batch flow now prunes per target** in
  the same way. The summary reports bytes freed AND bytes still kept per
  target, so you can see what survived and why.
- **`clean_npm_cache` honors the staleness gate** instead of always running
  `npm cache clean --force` (which ignored age). Full-purge mode still calls
  the npm CLI when available.
- The pre-run banner now prints "Delete strategy: prune ≥Nd" or
  "Delete strategy: FULL PURGE" so it's unambiguous what will happen.

### Added

- **`--purge-all` flag** restores the pre-1.2.0 wipe-the-whole-thing
  behavior for users who genuinely want it (e.g. reclaiming maximum disk
  before reimaging). The flag is documented prominently in `--help` with
  the trade-off spelled out.
- **`prune_stale <root> <days>`** helper in `lib/common.sh`. Public API for
  modules: refuses protected paths, deletes only files where BOTH atime
  and mtime exceed the threshold, sweeps empty dirs left behind, echoes
  bytes freed.

### Why

The 1.1.0 default deleted entire cache trees on confirm, which was the
right call for `~/.cache/yarn` (regenerates fast) but the wrong call for
`~/.gradle/wrapper/dists/` (a 230 MB download you might genuinely need
again next month). The 100-day threshold cleanly separates "I touched
this recently and would miss it" from "I haven't opened this in over
three months and it's safe to reclaim". Power users can still force the
old behavior with `--purge-all` or sharpen the gate with `-d 30`.

---

## [1.1.0] — 2026-05-10

Safety hardening release. Closes the door on globally installed packages
and shell-init files ever being touched by any cleanup path.

### Fixed

- **pnpm globals no longer wiped.** Cleanup of the pnpm content store
  previously targeted `~/.local/share/pnpm` (`PNPM_HOME`), which holds
  globally installed packages, bin shims, and the `pnpm` binary itself
  from `pnpm setup`. Cleanup now targets only `~/.local/share/pnpm/store`
  (the regenerable content-addressable cache). Affects `--all-safe`,
  `--menu` option 3, scan, walkthrough, and `--list-targets`.

### Added — safety guards

- **`PROTECTED_EXACT` list** in `lib/common.sh` — exact-match block on
  package-manager install dirs and runtime homes:
  `~/.local/share/pnpm`, `~/.local/share/pnpm/{global,bin,nodejs}`,
  `~/.npm-global*`, `~/.yarn`, `~/.npm`, `~/.config/yarn/global`,
  `~/.bun`, `~/.bun/install/global`, `~/.deno`, `~/.deno/bin`,
  `~/.volta`, `~/.nvm`, `~/.fnm`, `~/.cargo`, `~/.rustup`, `~/go/bin`.
- **`PROTECTED_BASENAMES` list** — `safe_rm` refuses any path whose
  basename matches a shell-init or history file (`.bashrc`, `.profile`,
  `.zshrc`, `.bash_aliases`, `.bash_history`, `.config`, `.local`, etc.),
  regardless of full path.
- **`--all-safe` startup assertion** — aborts with a `BUG:` message if
  any protected runtime dir ever leaks into the target list, preventing
  silent regressions.

### Added — bun + deno coverage

- **bun**: cache cleanup at `~/.bun/install/cache`; install dir
  `~/.bun/install/global` protected.
- **deno**: cache cleanup at `~/.cache/deno`; `~/.deno/bin` protected.
- Both wired into `--all-safe`, `--scan`, and the new `--globals` audit.

### Added — `--globals` audit (read-only)

New mode that lists directly-installed global packages from
**npm / pnpm / yarn / bun / deno**, marks each as `recently used`,
`needed by: <pkg>`, or `STALE — safe to uninstall` (mtime ≥ `--days N`,
default 100, with no other global declaring it as a dependency), and
prints copy-pasteable uninstall commands. **Never deletes anything.**
Works even when the package manager CLI isn't on PATH (filesystem
fallbacks). Available as menu option 18 or `--globals`.

### Added — `--doctor` repair (additive only)

New mode that detects when an installed runtime exists on disk but
isn't wired into `~/.bashrc` (`nvm`, `pnpm`, `bun`, `deno`, `cargo`)
and offers to append the canonical init block. **Only appends with
confirmation. Never deletes or modifies existing lines.** Available as
menu option 19 or `--doctor`.

### Changed

- `--all-safe` now prints explicit "globals are PRESERVED" and
  "shell-init files are NEVER touched" notices in its preamble.

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
