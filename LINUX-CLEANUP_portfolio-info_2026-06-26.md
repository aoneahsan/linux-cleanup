# Linux Cleanup — Portfolio Info

Reference Date: 2026-06-26
Project Type: CLI utility — safe, modular disk + cache cleanup for Linux (Bash engine + thin Node.js launcher, published to npm)
Project Slug: linux-cleanup
Primary Email Reference: aoneahsan@gmail.com
Current Version Reviewed: `1.3.1` (npm + git, byte-identical)
Last Portfolio Update: 2026-06-26
Next Eligible Update After: 2026-07-03

---

## Identity & Distribution (Authoritative)

| Field | Value |
| --- | --- |
| Project Slug | `linux-cleanup` |
| Public Brand Name | Linux Cleanup |
| Public URL (Live) | not applicable (CLI tool — no web app) |
| Main Project Link | https://npmjs.com/package/linux-cleanup |
| Repository | https://github.com/aoneahsan/linux-cleanup (public) |
| NPM Package | `linux-cleanup` — https://npmjs.com/package/linux-cleanup |
| Install / CTA | `npx linux-cleanup` (zero-install) or `npm install -g linux-cleanup` |
| Binary | `linux-cleanup` (`bin/linux-cleanup.js` → routes to `cleanup.sh`) |
| OS Support | `linux` only (declared `os` in `package.json`) |
| Node Engine | `>=14` |
| Android Application ID | N/A |
| iOS Bundle ID / Scheme | N/A |
| Chrome Extension ID | N/A |
| PyPI Package | N/A |
| Docs URL | not published as a site; docs ship in-repo under `docs/` (~32 pages, Diátaxis-structured) |
| License | Source-Available · No-Derivatives · Non-Commercial v1.0 (custom `LICENSE` file; `package.json` declares `SEE LICENSE IN LICENSE`) |
| Author | Ahsan Mahmood — aoneahsan@gmail.com — https://aoneahsan.com |
| Payment / Support URL | https://aoneahsan.com/payment?project-id=linux-cleanup&project-identifier=linux-cleanup |
| Agent-Readable Pricing | N/A (free CLI tool; no paid tiers) |

> **Asks for next refresh:** none outstanding from the master JSON — repo, npm link, license, and contact are all recorded. If a hosted docs site is published later (e.g. a GitHub Pages render of `docs/`), record its URL in the `docs` field. The `bugs` URL in `package.json` is a `mailto:` (no issue tracker) by design, since the license forbids derivative works / code PRs.

---

## Brand Assets

### Logo (SVG — inline)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Linux Cleanup">
  <defs>
    <linearGradient id="linuxcleanup-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0A7D54"/>
      <stop offset="100%" stop-color="#064E36"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="92" height="92" rx="22" fill="url(#linuxcleanup-grad)"/>
  <!-- terminal prompt: the "CLI tool" cue -->
  <path d="M28 36 L38 46 L28 56" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>
  <line x1="44" y1="56" x2="62" y2="56" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
  <!-- reclaimed-space sweep: gold accent broom arc -->
  <path d="M62 30 A22 22 0 0 1 70 64" stroke="#B8860B" stroke-width="5" stroke-linecap="round" fill="none"/>
  <circle cx="70" cy="64" r="4.5" fill="#B8860B"/>
</svg>
```

### Color Palette

| Role | Token | Hex | Usage |
| --- | --- | --- | --- |
| Primary | Reclaim Green | `#0A7D54` | Success / reclaimed-bytes total, "ran" badges, brand |
| Primary — deep | Forest 900 | `#064E36` | Logo gradient depth |
| Secondary | Warn Gold | `#B8860B` | Skipped/warn badges, caution highlights |
| Danger | Brick Red | `#C0392B` | Destructive-action callouts in the HTML report |
| Surface — Light | Near-white | `#FAFAFA` | Light-mode report background |
| Surface — Dark | Ink | `#16161A` | Dark-mode report background |
| Text — Light | Near-black | `#1C1C1F` | Light-mode body text |
| Muted | Slate-grey | `#7A7A85` | Secondary labels / meta |

> Palette is sourced directly from the self-contained HTML session-report theme in `modules/reports.sh` (CSS custom properties under `:root` and the `prefers-color-scheme: dark` block). The HTML report is dark-mode-aware and ships with no external assets. The CLI itself uses ANSI/`tput` terminal colors and respects `NO_COLOR` / `--no-color`.

---

## Update History (max 10 records)

| Date | Type | Notes |
| --- | --- | --- |
| 2026-06-26 | Portfolio file created | First dated portfolio profile. Identity table reconciled from master JSON (public repo, npm package `linux-cleanup`, custom source-available license). Facts sourced from `README.md`, `package.json`, `CHANGELOG.md`, `LICENSE`, and `modules/` at version 1.3.1. |
| 2026-05-10 | Release `1.3.1` (docs) | Documentation-only release: ~32-page Diátaxis `docs/` tree (tutorials, how-to, reference, explanation). No behaviour changes. |
| 2026-05-10 | Release `1.3.0` | Visual TUI menu (`--tui`, whiptail/dialog with graceful fallback), automatic crash-bundle capture on unexpected exit, tightened feedback loop. |
| 2026-05-10 | Release `1.2.2` / `1.2.1` | Maintenance + fixes layered on the staleness-gate model. |
| 2026-05-10 | Release `1.2.0` | Default delete strategy changed from full-wipe to staleness-gated prune (delete only files unused ≥ `--days`, default 100, both atime + mtime); `--purge-all` restores legacy wipe. |
| 2026-05-10 | Release `1.1.0` | Feature expansion on top of the initial release. |
| 2026-05-09 | Release `1.0.0` | Initial public release of the modular Bash cleanup engine. |

---

## One-Line Summary

Linux Cleanup is a safe, modular Bash CLI (shipped on npm) that reclaims 10–50+ GB of regenerable developer junk — package-manager caches, browser caches, Gradle/Cypress/Playwright/Android assets, and stale `node_modules` — behind allowlist-based safety guards, with JSON session reports and Markdown/HTML export.

## Elevator Pitch

Modern dev machines silently hoard tens of gigabytes of regenerable junk: yarn/npm/pnpm caches, Chrome/Firefox/Brave caches, Gradle build caches, Cypress and Playwright binaries, Android emulator images, and `node_modules` for projects you abandoned months ago. Most "cleaner" tools either don't understand modern dev caches, are GUI-only, or are scary one-button wipers. Linux Cleanup takes the opposite stance — scriptable, transparent, allowlist-guarded, and interactive by default. Its default mode is a 10-step guided walkthrough that asks before deleting anything and shows a per-step running total of bytes reclaimed. Every run writes a canonical, schema-versioned JSON report that can be exported to Markdown or a self-contained dark-mode HTML page. It makes zero network calls — no telemetry, no analytics, no phone-home. You can run it with one command and nothing to install: `npx linux-cleanup`.

## What This Project Is About

Linux Cleanup is a system-maintenance CLI aimed squarely at Linux developers who burn disk space on regenerable caches. The architecture is a modular Bash engine (`cleanup.sh` orchestrating `lib/` primitives and a dozen single-responsibility `modules/`) wrapped by a thin Node.js launcher (`bin/linux-cleanup.js`) so it can be distributed and run through npm/npx. The npm package and git source are byte-identical; npx simply fetches the package and routes logs/reports to a persistent `~/.linux-cleanup/` directory so they survive npx cache eviction. Safety is the headline design constraint: a `safe_rm` helper refuses any path inside an allowlist of protected locations (`~/Documents`, `~/Pictures`, `~/.ssh`, `~/.gnupg`, `~/.config`, `~/.claude`, `/etc`, `/boot`, `/usr`, `/`, bare `$HOME`, and more), personal-data scans are interactive-only and never `--yes`-able, and since 1.2.0 cache cleaners prune by staleness (files unused ≥ N days by both atime and mtime) rather than wiping wholesale. It ships a guided walkthrough, a jump-to menu, a whiptail/dialog TUI, an all-safe batch mode, a read-only scan, a stale-`node_modules` finder, an editor-extension cleaner, a sudo-gated system step, and a reports manager — all documented across a ~32-page in-repo Diátaxis docs tree. Honest framing: this is a Linux-only tool (declared `os: ["linux"]`), it is source-available rather than OSI open source, and it is a destructive tool by nature — it deletes, it never archives.

## Vision

Give Linux developers a trustworthy, scriptable way to reclaim disk space — one that treats deletion as a careful, reviewable, allowlist-guarded operation instead of a one-button gamble, and that keeps a verifiable record of exactly what it did.

## Mission

Know modern developer caches better than generic cleaners do; refuse to touch anything that could be irreplaceable; default to guided, interactive, per-step-confirmed cleanup with real-time reclaimed totals; produce canonical JSON reports with optional Markdown/HTML export; and make zero network calls so the tool can be trusted on any machine — distributed through a single `npx` command.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Core engine | Bash ≥ 4.0 (`cleanup.sh` entry point) |
| Library | `lib/common.sh` (UI primitives, `safe_rm`, sudo keepalive, JSON helpers) + `lib/scan.sh` (read-only scanners) |
| Modules | 15 single-responsibility `modules/*.sh` (walkthrough, menu/tui, all_safe, pkg_managers, app_caches, dev_tools, editor_extensions, node_modules_finder, personal_stale, system_sudo, reports, doctor, global_packages, crash_trap, release_helpers) |
| Distribution | npm package `linux-cleanup` — thin Node.js launcher `bin/linux-cleanup.js` (`preferGlobal`, `engines.node >=14`, `os: ["linux"]`) |
| Reports | Canonical schema-versioned JSON (schema v1); Markdown + self-contained dark-mode HTML export via `jq` |
| TUI | whiptail / dialog (graceful fallback to CLI menu when absent) |
| Required CLI deps | `find`, `du`, `df`, `rm`, `awk`, `sort`, `grep`, `sed`, `stat`, `realpath` |
| Optional deps | `jq` (MD/HTML export), `numfmt` (pretty sizes), `sudo`, `snap`, `crontab`, `xdg-open`, `less` |
| Scheduling | weekly all-safe cron installer (Sunday 03:00) + shell-alias installer |
| Privacy | zero network calls — no telemetry, analytics, or crash reporting; feedback is user-initiated `mailto:` + local tar.gz bundles |
| Versioning | Semantic Versioning; Keep a Changelog format; plain-text `VERSION` file |
| License | custom Source-Available, No-Derivatives, Non-Commercial v1.0 |

## Feature Catalog

- **Guided walkthrough (default)** — 10-step interactive cleanup that asks before each deletion and shows a per-step running total of bytes reclaimed.
- **Jump-to menu (`-m`) and visual TUI (`-t`/`--tui`)** — whiptail/dialog menu for pick-and-run usage, with graceful fallback to the CLI menu (and per-distro install hints) when neither tool is present.
- **All-safe batch mode (`-a -y`)** — wipe every regenerable cache in one shot, no prompts (only `--yes`-able for regenerable caches, never for personal data).
- **Read-only scan (`-s`)** — audit what's reclaimable without deleting anything.
- **Allowlist-based safety** — `safe_rm` refuses any path inside a `PROTECTED_PATHS` allowlist (`~/Documents`, `~/Pictures`, `~/Music`, `~/Videos`, `~/.ssh`, `~/.gnupg`, `~/.config`, `~/.claude`, `~/.mozilla`, `/`, `/etc`, `/boot`, `/usr`, `/var`, and more).
- **Staleness-gated pruning (since 1.2.0)** — cache cleaners delete only files unused ≥ `--days` (default 100) by both atime and mtime, protecting valuables that look like junk (e.g. a Gradle wrapper distro opened every couple months); `--purge-all` restores full-wipe.
- **Package-manager cache cleanup** — Yarn v1, Yarn berry, npm, npx, pnpm store + cache, Composer, pip.
- **Browser & app cache cleanup** — Chrome, Firefox/Mozilla, Brave, Chromium, Edge, Vivaldi, plus Gradle, Cypress, Playwright, TypeScript watcher cache, Zoom.
- **Dev-tools cleanup** — Android AVDs, Flutter pub-cache, Dart analysis server, Flatpak runtimes.
- **Editor-extension cleaner (`--editor-ext`)** — removes superseded VS Code / Cursor extension versions.
- **Stale `node_modules` finder (`--node-modules`)** — scans project roots and offers to delete `node_modules` untouched N+ days.
- **Personal-file & partial-download scans** — interactive-only picks in `~/Downloads`/`~/Desktop`, and orphan `.fdmdownload`/`.crdownload`/`.part` finder; never auto-batched.
- **System (sudo) cleanup (`--system`)** — `apt autoremove` + `apt clean`, journal vacuum to 100 MB, disabled snap revisions, superseded kernels, `/tmp` aging, kernel page-cache drop; sudo asked once and kept alive only for this step.
- **JSON session reports + export** — canonical schema-v1 JSON every run; `--export both|html|md latest|all|N` and an interactive reports manager; HTML is self-contained with dark-mode CSS and badges.
- **Self-test / doctor (`--self-test`)** — verifies dependencies, script syntax, and safety guards; reports missing optional commands.
- **Automatic crash bundles** — an EXIT trap packages the active log + latest report + a system manifest into `~/.linux-cleanup/feedback/crash-<stamp>.tar.gz` on unexpected failure (nothing sent automatically).
- **Feedback path (`--feedback`, `--debug-bundle`)** — pre-filled `mailto:` draft + a single tar.gz to attach; no telemetry or network calls.
- **Installers** — shell-alias and weekly-cron install/uninstall commands; `--list-targets` prints every path the tool can touch.

## Hidden Facts & Unique Angles

- **Allowlist over blocklist** — the tool refuses unrecognized paths rather than trying to enumerate dangerous ones; `safe_rm` is the single chokepoint every deletion passes through.
- **Prunes by staleness, doesn't just wipe** — since 1.2.0 the default protects assets that look like junk (Gradle wrapper distros, pinned-dependency tarballs, pre-release Cypress/Playwright binaries) by requiring both atime and mtime to be older than `--days`.
- **Byte-identical npm and git** — the npm package is just a thin Node launcher over the same Bash source; npx routes logs/reports to a persistent `~/.linux-cleanup/` so they survive cache eviction.
- **Zero network code path** — verifiable by `grep -rE "curl|wget|nc|http"` returning only the author's banner URLs and comments; no telemetry, analytics, or phone-home.
- **Personal data is interactive-only** — no flag combination, including `--yes`, will silently delete personal files; `--yes` applies to regenerable caches only.
- **Crash bundles are opt-in to send** — failures are captured locally and a one-liner is printed, but nothing leaves the machine unless the user emails it.
- **All output stays inside the project / `~/.linux-cleanup/`** — nothing is written to `/var` or scattered across `$HOME`.
- **Honest licensing note in the README** — it explicitly states the tool is source-available, NOT OSI open source (modification and commercial use are prohibited), and is a deleter, not a backup or security tool.
- **Docs are first-class** — the 1.3.1 release is documentation-only: ~32 pages structured along the Diátaxis framework, one page per mode, flag, output path, exit code, and the full report schema.

## Benefits for Users

- **Linux developers** — reclaim 10–50+ GB of regenerable junk the tool actually understands (modern JS/Java/Android/test-runner caches), without GUI-only or one-button-wipe risk.
- **Cautious users** — allowlist safety, interactive-by-default deletes, and read-only scan/`--list-targets` mean you always see what will happen before it does.
- **Privacy-conscious users** — zero network calls, verifiable in source; nothing is ever sent anywhere unless you email it yourself.
- **Automation users** — all-safe batch mode plus a weekly cron installer for hands-off recurring cleanup, with JSON reports as the audit trail.
- **Teams / reporting** — schema-versioned JSON plus self-contained HTML/Markdown export make each cleanup a shareable, reproducible record.
- **Zero-install users** — `npx linux-cleanup` runs the full tool with nothing to install and persistent reports across runs.

## Value & Potential

Linux Cleanup pairs a concrete, recurring developer pain (disk bloat from regenerable caches) with an unusually disciplined safety and reporting model — allowlist-guarded deletes, staleness-gated pruning, schema-versioned JSON reports, and a verifiable no-network stance. As a portfolio piece it demonstrates real systems engineering in Bash (modular architecture, sudo keepalive, EXIT-trap crash capture, JSON generation without heavy dependencies), pragmatic distribution (a thin Node launcher to reach the npm/npx audience), and product maturity (a 7-release changelog and a 32-page Diátaxis docs tree). Growth paths: a hosted docs site (render `docs/` to GitHub Pages), broader distro/package-manager coverage, and additional cache targets as toolchains evolve. Monetization is intentionally absent — it is a free, source-available tool — with support routed through aoneahsan.com/payment.

## Resume / CV Bullets

- Built Linux Cleanup, a modular Bash disk/cache-cleanup CLI (15 single-responsibility modules over a shared `lib/`) that reclaims 10–50+ GB of regenerable developer junk, distributed on npm via a thin Node.js launcher so it runs with one `npx` command.
- Designed an allowlist-based safety model where every deletion passes through a single `safe_rm` chokepoint that refuses protected paths (`~/Documents`, `~/.ssh`, `~/.config`, `/etc`, `/boot`, `/`, bare `$HOME`, …), with personal-data scans interactive-only and never `--yes`-able.
- Shipped staleness-gated pruning (delete only files unused ≥ N days by both atime and mtime) to protect cache assets that look like junk, with `--purge-all` as an explicit opt-out.
- Implemented canonical schema-versioned JSON session reports plus self-contained dark-mode HTML and Markdown export (via `jq`), and a reports manager for listing/converting/viewing past runs.
- Engineered resilience and trust features: an EXIT-trap that captures crash bundles (log + report + system manifest) on unexpected failure, a self-test that verifies deps/syntax/safety guards, and a strict zero-network design with no telemetry — verifiable in source.
- Delivered a guided 10-step walkthrough, a whiptail/dialog TUI with graceful CLI fallback, an all-safe batch mode, and shell-alias + weekly-cron installers, documented in a ~32-page Diátaxis docs tree across seven SemVer releases.

## LinkedIn / Portfolio Paragraph

Linux Cleanup is a safe, modular disk/cache-cleanup CLI I built for Linux developers and published on npm. Its Bash engine — 15 single-responsibility modules over a shared library — reclaims tens of gigabytes of regenerable junk (yarn/npm/pnpm caches, Chrome/Firefox/Brave caches, Gradle/Cypress/Playwright binaries, Android emulator images, stale `node_modules`, system journals and old kernels) while treating deletion as a careful, reviewable operation. Every `rm` passes through a single `safe_rm` guard that refuses an allowlist of protected paths, personal-data scans are interactive-only, and since v1.2.0 cache cleaners prune by staleness rather than wiping wholesale. Each run writes a canonical, schema-versioned JSON report exportable to a self-contained dark-mode HTML page, and the whole tool makes zero network calls — no telemetry, verifiable in source. A thin Node.js launcher means you can run it with nothing to install: `npx linux-cleanup`. It ships across seven SemVer releases with a ~32-page Diátaxis docs tree, and it's honest about being source-available rather than OSI open source, and a deleter rather than a backup tool.

## Social Content Angles (for ChatGPT content project)

- Reclaiming 10–50+ GB on a dev machine: the caches you forgot you had (and which are safe to delete).
- Why my Linux cleaner uses an allowlist, not a blocklist — and how `safe_rm` makes every deletion go through one guard.
- Pruning by staleness vs wiping: how I stopped a cache cleaner from deleting a Gradle wrapper you open every two months.
- Zero network calls, verifiable: building a system tool you can actually trust (no telemetry, grep-able source).
- Shipping a Bash tool on npm: why a thin Node.js launcher is the easiest way to reach `npx` users.
- Crash bundles done right: capturing a log + report + system manifest on failure — but never sending anything for you.
- Designing JSON-first reports for a CLI, with self-contained dark-mode HTML export.
- Interactive-by-default deletion: why no `--yes` flag should ever touch your personal files.
- Source-available ≠ open source: being honest about a No-Derivatives, Non-Commercial license.
- A whiptail/dialog TUI that gracefully falls back to a plain CLI menu when neither is installed.

## Top 20 Hashtags

#LinuxCleanup #Linux #DiskCleanup #DevTools #CLI #Bash #ShellScripting #OpenSourceSoftware #DiskSpace #CacheCleanup #npm #npx #SysAdmin #DeveloperTools #Ubuntu #Productivity #CommandLine #LinuxTips #BuildInPublic #SystemUtility

## SEO / AEO Metadata

- Meta description (150–160 chars): Linux Cleanup is a safe, modular Bash CLI (on npm) that reclaims 10–50+ GB of dev caches and junk with allowlist guards, JSON reports, and HTML/MD export.
- Primary keywords: linux disk cleanup, free disk space linux, clear yarn cache, clear npm cache, clean node_modules, gradle cache cleanup, linux cache cleaner CLI, developer disk cleanup tool.
- Long-tail / GEO keywords (AI-search): "safe command-line tool to free disk space on Linux", "delete stale node_modules across projects automatically", "clean yarn npm pnpm gradle cypress playwright caches on Linux", "Linux cleanup tool that makes no network calls", "npx linux disk cleanup with JSON report".
- Suggested og:title: Linux Cleanup — Safe, Modular Disk + Cache Cleanup for Linux
- Suggested og:description: Reclaim 10–50+ GB of regenerable developer junk with allowlist-guarded, interactive-by-default cleanup, JSON reports, and zero network calls. Run it with `npx linux-cleanup`.

## Known Constraints (honest framing)

- **Linux-only.** `package.json` declares `os: ["linux"]`; the engine relies on Linux paths and tools (`apt`, `snap`, journal, AVDs). Not for macOS/Windows.
- **Source-available, NOT OSI open source.** The license prohibits modification, derivatives, and commercial use; code contributions cannot be accepted (description-only feature requests by email are welcome).
- **It deletes; it never archives.** This is a destructive tool by design — not a backup, and not a security scanner.
- **No issue tracker by design.** The `bugs` field is a `mailto:` — feedback flows through `--feedback` / `--debug-bundle` and email, consistent with the no-derivatives license.
- **MD/HTML export requires `jq`.** JSON is always written; without `jq` the Markdown/HTML conversion is unavailable.
- **System step needs sudo** and some features need optional tools (`snap`, `crontab`, `numfmt`, `xdg-open`, `less`) that gracefully degrade when missing.
- **No hosted docs site yet.** The ~32-page docs live in-repo under `docs/`; if rendered to a site later, record the URL.

## Generic Hashtags (always include in posts)

#Aoneahsan #AhsanMahmood #Zaions #BestOpenSourceCommunityProject #TopFree #SaaSApp

---

## File Usage Rule

Refresh at least once per week (MANDATORY). Do not refresh more than once per 3 days. Keep only the 10 most recent history records. Filename always carries the last-updated date. Final destination: `/Users/pc/Documents/ahsan-work/ahsan-notebook/static/assets/personal/projects-info-as-portfolio-item/apps/LINUX-CLEANUP_portfolio-info_<YYYY-MM-DD>.md`.
