# linux-cleanup

> **Safe, modular disk + cache cleanup for Linux — built for developers, scripted for repeat use.**

`linux-cleanup` is a Bash-based, modular cleanup utility that helps Linux users (especially developers) reclaim tens of gigabytes of disk space without ever putting personal data at risk. It walks you through every category of reclaimable junk on your system step-by-step, with allowlist-based safety guards, sudo handling, JSON session reports, and on-demand HTML / Markdown export.

```
══════════════════════════════════════════════════════════════════════════════
   linux-cleanup
   Safe, modular disk + cache cleanup utility
══════════════════════════════════════════════════════════════════════════════
```

| | |
|---|---|
| **Version** | 1.0.0 |
| **Status** | Stable — released as source-available, no-derivative, non-commercial |
| **Author** | Ahsan Mahmood &middot; aoneahsan@gmail.com |
| **License** | [LICENSE](./LICENSE) — Source-Available, No-Derivatives, Non-Commercial v1.0 |

---

## Why this exists

Modern dev machines accumulate enormous amounts of regenerable junk:

- Yarn / npm / pnpm / composer / pip caches (often **10–30 GB**)
- Browser caches (Chrome, Firefox, Brave, Chromium, Edge, Vivaldi)
- Gradle build caches, Cypress / Playwright binary caches, TS watcher caches
- Android emulator images, Flutter pub-cache, Dart analysis server caches
- Editor old-extension versions (VS Code, Cursor)
- `node_modules` for projects you haven't touched in months
- System: `apt` cache, journal logs, old kernels, disabled snap revisions, page cache
- Orphan downloads (`.fdmdownload`, `.crdownload`, `.part`)

Most existing "cleaner" tools either don't know about modern dev caches, are GUI-only, or are scary single-button "BleachBit-style" wipers. `linux-cleanup` takes the opposite approach: **scriptable, transparent, allowlist-guarded, interactive by default**.

---

## Highlights

- **Default = guided walkthrough** through 10 categories. Each step asks before deleting anything.
- **Per-step running total** — you see exactly how many bytes you've reclaimed in real time.
- **Allowlist-based safety** — `safe_rm` refuses any path inside `~/Documents`, `~/Pictures`, `~/Music`, `~/Videos`, `~/.ssh`, `~/.gnupg`, `~/.config`, `~/.claude`, `/etc`, `/boot`, `/usr`, `/`, or bare `$HOME`.
- **Personal data is interactive only** — never auto-batched, never `--yes`-able.
- **Stale `node_modules` finder** scans your project roots and lists folders untouched for N+ days.
- **Editor old-version cleaner** for VS Code / Cursor extensions.
- **System cleanup** wraps `apt autoremove`, journal vacuum, snap revision purge, `/tmp` aging, kernel page-cache drop.
- **JSON session reports** (canonical, schema-versioned) with on-demand Markdown / HTML export.
- **Self-test** mode verifies dependencies, syntax, and safety guards.
- **Shell alias + weekly cron installers** for one-time setup.
- **All output stays inside the project folder** — logs, reports, cron logs.

---

## Quick start

### Option 1 — zero install, run via npx (recommended)

```bash
npx linux-cleanup           # guided walkthrough, downloads + runs
npx linux-cleanup --scan    # read-only audit
npx linux-cleanup --help
```

When run via `npx`, the package is fetched into a temporary npm cache directory. **Your logs and reports persist at `~/.linux-cleanup/`** (not in the temp dir), so they survive npx eviction and are always there for the next run.

### Option 2 — install globally

```bash
npm install -g linux-cleanup
linux-cleanup                          # then 'linux-cleanup' is on your PATH everywhere
```

### Option 3 — clone the repo (for advanced use)

```bash
git clone https://github.com/aoneahsan/linux-cleanup ~/linux-cleanup
cd ~/linux-cleanup
chmod +x cleanup.sh
./cleanup.sh --self-test    # verify deps + safety guards
./cleanup.sh                # run guided walkthrough
```

> ℹ The npm package and the git source are byte-identical. The npm package is just a thin Node.js launcher (`bin/linux-cleanup.js`) that locates the bash script and routes logs/reports to a persistent dir.

---

## Modes

`cleanup.sh` ships with one entry point and a small set of flags. Run with no flags for the **guided walkthrough**.

| Mode | Flag | What it does |
|---|---|---|
| Walkthrough | _(default)_ or `-w` | 10-step guided cleanup with prompts, running totals, JSON report |
| Menu | `-m` | Jump-to menu — pick a single category to run |
| All-safe batch | `-a` `-y` | Wipe every regenerable cache in one shot, no prompts |
| Scan only | `-s` | Read-only — show what's reclaimable, no deletes |
| Stale personal | `-p` `-d 60` | Find personal files unused 60+ days (interactive) |
| System (sudo) | `--system` | apt, journal, snap revisions, kernels, /tmp, page cache |
| Partials | `--partials` | Find orphan `.fdmdownload`, `.crdownload`, `.part` |
| Audit | `--audit` | Top 20 largest entries in `$HOME` |
| Stale node_modules | `--node-modules` | Find and offer to delete `node_modules` from projects untouched N+ days |
| Editor extensions | `--editor-ext` | Clean superseded VS Code / Cursor extension versions |
| Reports | `--reports` | List / convert / view past session reports |
| Export | `--export FMT ID` | Non-interactive: `--export both latest`, `--export html all` |
| List targets | `--list-targets` | Print every path the script can touch |
| Self-test | `--self-test` | Verify deps, syntax, safety guards |
| Version | `-V` `--version` | Show version + author |
| Install alias | `--install-alias` | Add `cleanup` alias to `.bash_aliases` / `.zshrc` |
| Install cron | `--install-cron` | Schedule weekly all-safe run, Sunday 03:00 |
| Uninstall alias | `--uninstall-alias` | Remove the alias |
| Uninstall cron | `--uninstall-cron` | Remove the cron entry |

**Common options:**
- `-d N` `--days N` — staleness threshold (default: 100). A file is removed only when **both** `atime` and `mtime` are older than this many days. Lower it (e.g. `-d 30`) for a more aggressive sweep.
- `--purge-all` — disable the staleness gate and wipe target caches in full (pre-1.2.0 behavior). Use sparingly: it removes rarely-used assets like Gradle wrapper distros (`~/.gradle/wrapper/dists/gradle-X.Y-all/…`) you might re-download next month.
- `-y` `--yes` — auto-confirm regenerable caches (only valid with `--all-safe`)
- `--no-report` — skip JSON session report generation (logs still kept)
- `--cleanup-logs` — delete this run's log files at finish (reports always preserved)
- `--no-color` — disable colored output (`NO_COLOR` env var also respected)

### Default delete strategy (since 1.2.0)

Cache cleaners **prune** instead of wiping. For each target directory, only files unused for ≥ `--days` days (default 100, both `atime` and `mtime`) are deleted; the rest stays. Empty subdirs left behind are swept up.

This protects valuables that look like junk:

- `~/.gradle/wrapper/dists/gradle-8.13-all/…` (230 MB, opened every 1-2 months)
- Playwright browsers for an old release branch
- Yarn-cached tarballs of pinned dependencies
- Cypress binaries you only run pre-release

If you want the old behavior — full wipe of every cache target — pass `--purge-all`.

**Persistence model**

| Path | When run via npx | When run from clone |
|---|---|---|
| Logs | `~/.linux-cleanup/logs/` | `<clone>/logs/` |
| Reports | `~/.linux-cleanup/reports/` | `<clone>/reports/` |
| Override | `LINUX_CLEANUP_HOME=/custom/path` | _(same env var works)_ |

Reports are **always** persisted (canonical record of what happened). Logs are persisted by default but can be cleaned with `--cleanup-logs`.

---

## What gets cleaned

`./cleanup.sh --list-targets` prints every path the script can touch, grouped by category. A summary:

**Package-manager caches** (always regenerable)
- Yarn v1 (`~/.cache/yarn`), Yarn berry (`~/.yarn/berry/cache`), npm (`~/.npm/_cacache`), npx (`~/.npm/_npx`), pnpm store + cache, Composer, pip

**Browser & app caches** (regenerable)
- Chrome, Firefox / Mozilla, Brave, Chromium, Edge, Vivaldi
- Gradle build caches + wrapper distros, Cypress, Playwright, TypeScript watcher cache, Zoom data

**Dev tools** (slower to regenerate)
- Android AVDs, Flutter pub-cache, Dart analysis server, Flatpak runtimes
- VS Code / Cursor old extension versions

**Project + personal** (interactive only — never auto)
- Stale `node_modules` in projects untouched N+ days (default 100)
- Personal files in `~/Downloads`, `~/Desktop` >10 MB and unused N+ days
- Partial / orphan downloads

**System** (sudo)
- `apt autoremove` + `apt clean`, journal vacuum to 100 MB, disabled snap revisions, superseded kernel packages, `/tmp` files older than 7 days, kernel page cache (`drop_caches`)

**PROTECTED — script refuses to delete inside any of these:**
`~/Documents`, `~/Pictures`, `~/Music`, `~/Videos`, `~/Desktop`, `~/Public`, `~/Templates`, `~/.ssh`, `~/.gnupg`, `~/.gnome`, `~/.claude`, `~/.config`, `~/.mozilla`, `~/.thunderbird`, `/`, `/etc`, `/boot`, `/usr`, `/var`, `/lib`, `/sbin`, `/bin`.

---

## Session reports

Every walkthrough produces a **JSON report** (canonical, schema-versioned) at `reports/report-YYYY-MM-DD_HHMMSS.json`. The optional 10th step generates Markdown and/or HTML on top.

**JSON schema (v1):**

```json
{
  "schema_version": 1,
  "meta":   { "tool", "started_at", "finished_at", "duration_seconds",
              "host", "user", "mode", "stale_days", "log_file" },
  "disk":   { "before": {...}, "after": {...} },
  "memory": { "before": {...}, "after": {...} },
  "steps":  [ { "n", "title", "status", "freed_bytes" }, ... ],
  "totals": { "total_reclaimed_bytes", "total_reclaimed_human",
              "steps_run", "steps_skipped" }
}
```

**Convert non-interactively:**
```bash
./cleanup.sh --export both   latest    # latest report → MD + HTML
./cleanup.sh --export html   all       # every report → HTML
./cleanup.sh --export md     3         # report #3 → Markdown
```

**Or interactively:**
```bash
./cleanup.sh --reports
```

The HTML report has dark-mode CSS, badges, and is self-contained (no external assets).

> Conversion requires `jq` (most distros: `sudo apt install jq`). Without `jq`, JSON is still always written; only the MD/HTML export is unavailable.

---

## Project layout

```
linux-cleanup/
├── cleanup.sh                 # Entry point
├── lib/
│   ├── common.sh              # UI primitives, safe_rm, sudo keepalive, JSON helpers
│   └── scan.sh                # Read-only scanners
├── modules/
│   ├── walkthrough.sh         # 10-step guided mode + JSON report writer
│   ├── reports.sh             # List / convert / view past reports (MD/HTML)
│   ├── all_safe.sh            # Batch clean every regenerable cache
│   ├── pkg_managers.sh        # yarn / npm / pnpm / composer / pip
│   ├── app_caches.sh          # Chrome / Gradle / Cypress / Playwright / Zoom / TS
│   ├── dev_tools.sh           # Android AVD / pub / dart / flatpak
│   ├── editor_extensions.sh   # VS Code / Cursor superseded versions
│   ├── node_modules_finder.sh # Stale node_modules across projects
│   ├── personal_stale.sh      # Interactive personal-file scan + partials
│   ├── system_sudo.sh         # apt / journal / snap / kernels / tmp / pagecache
│   └── release_helpers.sh     # version / list-targets / self-test / uninstall / export
├── logs/                      # Auto-created — every run is logged
├── reports/                   # Auto-created — JSON canonical, MD/HTML on demand
├── README.md                  # This file
├── LICENSE                    # Custom: Source-Available, No-Derivatives, Non-Commercial
├── CHANGELOG.md               # Release history
├── VERSION                    # Plain-text version number
└── .gitignore                 # Excludes logs/, reports/, backups
```

---

## Requirements

**Required** (typically pre-installed on Ubuntu/Debian/Fedora/Arch):
- `bash` ≥ 4.0
- `find`, `du`, `df`, `rm`, `awk`, `sort`, `grep`, `sed`, `stat`, `realpath`

**Optional** (features that depend on them gracefully degrade):
- `jq` — required for JSON → MD/HTML conversion
- `numfmt` — pretty byte sizes (script falls back to raw bytes)
- `sudo` — required for system-cleanup mode
- `snap` — for snap revision purge
- `crontab` — for weekly cron installer
- `xdg-open` — to open HTML reports in a browser from the reports manager
- `less` — for paged JSON view in reports manager

`./cleanup.sh --self-test` reports which optional commands are missing.

---

## Privacy

**linux-cleanup makes zero network calls.** No telemetry. No analytics. No crash reporting. No phone-home of any kind.

| What | Where it goes |
|---|---|
| Logs | Local only — `~/.linux-cleanup/logs/` (npx) or `<clone>/logs/` |
| Reports (JSON / MD / HTML) | Local only — `~/.linux-cleanup/reports/` (npx) or `<clone>/reports/` |
| Debug bundles | Local only — `~/.linux-cleanup/feedback/` (npx) or `<clone>/feedback/` |
| Anything else | **Never sent anywhere** |

If you want the author to see a log or report, **you must email it yourself.** The tool will not — and cannot — exfiltrate anything from your machine.

You can verify this in the source: `grep -rE "curl|wget|nc|http://|https://" cleanup.sh lib/ modules/ bin/` returns only:
- The author's homepage / LinkedIn URLs (printed in the version banner)
- Documentation references in comments

There is no network code path.

---

## Reporting issues / sending feedback

Bug reports, feature ideas, and security disclosures are welcome — the License explicitly permits them.

### Quick path

```bash
# 1. Show structured feedback instructions + offer mailto: draft
linux-cleanup --feedback

# 2. Bundle the latest log + report into a single tar.gz to attach
linux-cleanup --debug-bundle
```

`--debug-bundle` creates `~/.linux-cleanup/feedback/debug-bundle-TIMESTAMP.tar.gz` containing:
- The latest log file (`logs/cleanup-*.log`)
- The latest JSON report (`reports/report-*.json`, if any)
- A `MANIFEST.txt` with system info (distro, kernel, bash version, self-test output)

> ⚠ **Review the bundle before emailing it.** It contains `$HOME` paths and a snapshot of cache sizes from your machine. Inspect with `tar -tzf debug-bundle-*.tar.gz`.

### Manual path

Email **aoneahsan@gmail.com** with:
- Linux distribution + version
- Bash version (`bash --version | head -1`)
- linux-cleanup version
- The exact command you ran
- What you expected vs what happened
- (Optional) the log file from `~/.linux-cleanup/logs/`

You can also reach the author via:
- 🌐 https://aoneahsan.com
- 💼 https://linkedin.com/in/aoneahsan

### What the author cannot do

- Cannot see your logs unless you send them
- Cannot push fixes to your machine — npm / npx pulls a new version when you re-run
- Cannot accept code contributions (the License forbids derivative works); description-only feature requests are welcome by email

---

## Safety philosophy

This is a system tool that deletes files. It takes the following stance:

1. **Allowlist over blocklist.** Every path is checked against a `PROTECTED_PATHS` list (and a small set of system root paths) before any `rm` is permitted. If an unrecognized path is passed, the safe path is to refuse it.
2. **Interactive by default.** No flag combination will silently nuke personal data. `--yes` only applies to regenerable cache deletions.
3. **Personal data scans are read-only by default.** The interactive personal-file picker requires per-file or per-range confirmation, never `--yes`.
4. **Sudo is asked once, kept alive only for the system step.** The script will not silently escalate.
5. **All output stays inside the project folder.** Logs, reports, cron logs — nothing is written to your home directory or `/var`.

---


## What this is NOT

- **Not OSI-conforming "open source."** The License explicitly prohibits modification and commercial use, which most OSI definitions require to permit. The project is **source-available** for read, study, use, and unmodified redistribution. The term "open source" is used colloquially in this README to indicate that the source is published in the open.
- **Not a backup tool.** It deletes; it never archives.
- **Not a security scanner.** It will not find secrets, malware, or vulnerabilities.
- **Not a replacement for human judgment.** Always review what the script proposes before confirming.

---

## Author

**Ahsan Mahmood**
- 📧 aoneahsan@gmail.com
- 🌐 https://aoneahsan.com
- 💼 https://linkedin.com/in/aoneahsan
- 📱 +92 304 6619706

---

## License at a glance

> ⚠ **By using this software you agree to the full [LICENSE](./LICENSE).**
>
> **Allowed:** Download, read, study, use as-is, redistribute unmodified.
> **Prohibited:** Modify, fork, derive, distribute modified versions, sell, sublicense, bundle commercially, or remove attribution.
> **Disclaimer:** The software is provided "AS IS" with no warranty. The author is not liable for any damages, data loss, or legal claims arising from your use. You agree to indemnify the author against any claim arising from your use.

The full text controls — see [LICENSE](./LICENSE).

---

_Built with care by Ahsan Mahmood. If linux-cleanup saved you time, a thank-you note via email is always welcome._
