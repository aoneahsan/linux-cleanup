<div align="center">

<img src="https://raw.githubusercontent.com/aoneahsan/linux-cleanup/main/assets/logo.svg" alt="linux-cleanup logo" width="120" />

<h1>linux-cleanup</h1>

<p><strong>Safe, modular disk and cache cleanup for Linux — prune by default, allowlist-guarded.</strong></p>

[![npm version](https://img.shields.io/npm/v/linux-cleanup.svg)](https://www.npmjs.com/package/linux-cleanup)
[![downloads](https://img.shields.io/npm/dm/linux-cleanup.svg)](https://www.npmjs.com/package/linux-cleanup)
[![license](https://img.shields.io/npm/l/linux-cleanup.svg)](https://github.com/aoneahsan/linux-cleanup/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/linux-cleanup.svg)](https://nodejs.org)

[Docs](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/README.md) · [npm](https://www.npmjs.com/package/linux-cleanup) · [GitHub](https://github.com/aoneahsan/linux-cleanup) · [Changelog](https://github.com/aoneahsan/linux-cleanup/blob/main/CHANGELOG.md) · [Contributing](https://github.com/aoneahsan/linux-cleanup/blob/main/CONTRIBUTING.md) · [Support](https://github.com/aoneahsan/linux-cleanup/issues)

</div>

> [!IMPORTANT]
> **This tool deletes files, and deletion is permanent — there is no undo and nothing is archived first.**
> It removes caches and build artefacts that regenerate on next use, never your documents. Start with
> `npx linux-cleanup --scan`, which deletes nothing and prints exactly what it would reclaim.
> **Linux only** — npm refuses to install it on macOS or Windows.

`linux-cleanup` reclaims disk space taken by regenerable junk on a Linux developer machine: package-manager
caches, browser caches, build caches, emulator images, stale `node_modules`, orphan downloads, system journals
and superseded kernels. It is a Bash tool with a thin Node launcher, so `npx linux-cleanup` runs it with
nothing to install. What sets it apart from a one-button cleaner is restraint — by default it deletes only
files untouched for 100+ days, refuses outright to operate inside your personal directories, and makes no
network calls of any kind.

| | |
|---|---|
| **Version** | `1.4.0` |
| **License** | MIT |
| **Node** | `>=14` (launcher only) |
| **Runtime** | `bash >= 4.0` + GNU coreutils |
| **Platform** | Linux only, including WSL2 |
| **Install size** | ~55 kB packed · ~174 kB unpacked |
| **Undo** | None — deletion is one-way |
| **Status** | Stable · actively maintained |

<a id="table-of-contents"></a>
## 🧭 Table of Contents&nbsp;[#](#table-of-contents)

- [💡 Why linux-cleanup](#why-linux-cleanup)
- [✨ Features](#features)
- [📱 Platform Support](#platform-support)
- [📋 Requirements](#requirements)
- [📦 Installation](#installation)
- [🚀 Quick Start](#quick-start)
- [🛠️ Usage](#usage)
- [⚙️ Configuration](#configuration)
- [💻 Command Line](#command-line)
- [🧪 Examples](#examples)
- [🎛️ Advanced Features](#advanced-features)
- [🚑 Recovery & Troubleshooting](#recovery-troubleshooting)
- [🚧 Limitations](#limitations)
- [❓ FAQ](#faq)
- [📚 Documentation](#documentation)
- [🔄 Changelog](#changelog)
- [🤝 Contributing](#contributing)
- [🗂️ Repository](#repository)
- [💬 Support](#support)
- [📄 License](#license)
- [👤 Author](#author)
- [🔗 Links](#links)
- [🏷️ Keywords](#keywords)

<a id="why-linux-cleanup"></a>
## 💡 Why linux-cleanup&nbsp;[#](#why-linux-cleanup)

A working developer machine accumulates junk in places no general-purpose cleaner knows about: the Yarn and
pnpm stores, Gradle wrapper distributions, Cypress and Playwright browser binaries, Android emulator images,
`node_modules` for a project you finished last spring. Clearing them by hand means maintaining a private list
of `rm -rf` incantations and remembering which ones are safe.

The obvious fix — a cleaner that wipes every cache it finds — trades one problem for another. A full wipe of
`~/.gradle/wrapper/dists/` reclaims a few hundred megabytes and costs you the re-download next time you open
that project. `linux-cleanup` takes the narrower path:

| | `linux-cleanup` | A wipe-everything cleaner | Doing it by hand |
|---|---|---|---|
| **Default action** | deletes only files idle 100+ days | deletes the whole cache | whatever you typed |
| **Knows dev caches** | Yarn, pnpm, Gradle, Cypress, Playwright, AVDs, pub-cache | varies | you maintain the list |
| **Personal directories** | hard refusal, no flag bypasses it | usually configurable | nothing stops you |
| **Unattended use** | `--all-safe -y`, cron-friendly | GUI-first | scriptable |
| **Network calls** | none | varies | none |
| **Undo** | none | none | none |

Nothing here can tell you how much you will reclaim — that depends entirely on what is on your disk. Run
[`--scan`](#quick-start) and it will tell you, without deleting anything.

**Not the right tool when** you want an undo or a backup (it has neither — it deletes, it never archives);
when you are on macOS or Windows; when you want a point-and-click GUI as the primary interface; or when you
are looking for a security scanner — it will not find secrets, malware, or vulnerabilities.

<a id="features"></a>
## ✨ Features&nbsp;[#](#features)

- **Prune, don't wipe** — for every cache target, only files whose `atime` *and* `mtime` are both older than
  the threshold are removed. Recently-used files survive.
- **Allowlist refusal** — `safe_rm` rejects any path resolving inside `~/Documents`, `~/Pictures`, `~/.ssh`,
  `~/.gnupg`, `~/.config`, `/etc`, `/boot`, `/usr`, bare `$HOME` and more. No flag bypasses it.
- **Symlink-aware** — paths are resolved with `realpath` before the guard runs, so a symlink into a protected
  directory cannot smuggle a deletion past it.
- **Personal data is interactive only** — never batched, never covered by `--yes`.
- **Guided walkthrough by default** — ten categories, each one asking before it acts, with a running total of
  bytes reclaimed.
- **Read-only modes** — `--scan`, `--list-targets`, `--audit` and `--globals` inspect and report without
  deleting anything.
- **Offline by design** — zero network calls, no telemetry, no analytics, no update check. Verifiable in the
  source; see [Safety](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/safety.md).
- **Session reports** — every run writes a schema-versioned JSON record, exportable to Markdown or HTML.
- **Self-test** — verifies dependencies, shell syntax, and that the safety guards actually fire.
- **Crash bundles** — an unexpected failure packages the log, latest report and a system manifest locally for
  you to review and email. Nothing is ever sent for you.

<a id="platform-support"></a>
## 📱 Platform Support&nbsp;[#](#platform-support)

| Platform | Supported | Notes |
|---|---|---|
| Linux (Debian, Ubuntu, Fedora, Arch, …) | ✅ | The primary and only supported target. |
| WSL2 | ✅ | Runs on the Linux side; Windows-side directories under `/mnt/c/` are not scanned. |
| macOS | ❌ | `os: ["linux"]` makes npm refuse to install; the launcher also exits `2`. |
| Windows (native) | ❌ | No Bash or GNU coreutils environment. |

<a id="requirements"></a>
## 📋 Requirements&nbsp;[#](#requirements)

| Requirement | Version | Why |
|---|---|---|
| `bash` | `>= 4.0` | The scripts use associative arrays and `${var,,}`, absent from Bash 3.2. |
| GNU coreutils | any current | `realpath -m` powers the symlink-resolving safety guard; the BSD build has no `-m`. |
| `find`, `du`, `df`, `awk`, `sed`, `grep`, `stat`, `sort` | any | Core scanning and measurement. Pre-installed on every mainstream distro. |
| Node.js | `>= 14` | Only for the `npx` / global-install launcher. Running `cleanup.sh` directly needs no Node. |
| `jq` | any | **Optional** — required only to export a JSON report to Markdown or HTML. |
| `sudo` | any | **Optional** — required only by `--system`. |
| `whiptail` or `dialog` | any | **Optional** — required only by `--tui`; falls back to the CLI menu. |
| `numfmt`, `snap`, `crontab`, `xdg-open`, `less` | any | **Optional** — each enables one feature; absence degrades gracefully. |

Run `linux-cleanup --self-test` to see which optional commands are missing on your machine.

<a id="installation"></a>
## 📦 Installation&nbsp;[#](#installation)

No install needed — `npx` fetches and runs it:

```bash
npx linux-cleanup --scan
```

To keep it on your `PATH`:

```bash
npm install -g linux-cleanup
```

Or clone the repository and run the Bash entry point directly, with no Node involved:

```bash
git clone https://github.com/aoneahsan/linux-cleanup.git ~/linux-cleanup
cd ~/linux-cleanup
chmod +x cleanup.sh
./cleanup.sh --self-test
```

There is no build step and no post-install configuration. The one thing worth knowing is **where output
lands**, because it differs between the two paths:

| | Logs and reports |
|---|---|
| Installed via `npx` or `npm i -g` | `~/.linux-cleanup/` — outside the package, so npx cache eviction cannot delete your history |
| Run from a clone | `logs/` and `reports/` inside the clone |

Both are configurable — see [Configuration](#configuration).

<a id="quick-start"></a>
## 🚀 Quick Start&nbsp;[#](#quick-start)

Start read-only. This deletes nothing; it prints every reclaimable target it found and what each one holds:

```bash
npx linux-cleanup --scan
```

When you are ready to delete, run it with no flags for the guided walkthrough, which asks before every step.

<a id="usage"></a>
## 🛠️ Usage&nbsp;[#](#usage)

### See what could be reclaimed

```bash
linux-cleanup --scan          # read-only audit, grouped by category
linux-cleanup --list-targets  # every path the tool is capable of touching
```

### Clean interactively

```bash
linux-cleanup                 # guided walkthrough — prompts at every step
linux-cleanup --menu          # jump straight to one category
```

### Clean unattended

```bash
linux-cleanup --all-safe --yes
```

`--yes` applies to regenerable caches only. No flag combination will batch-delete personal files.

### Sweep more or less aggressively

```bash
linux-cleanup --all-safe -d 30   # anything idle 30+ days, instead of the default 100
```

### System-level cleanup

```bash
linux-cleanup --system        # apt, journal, snap revisions, old kernels, /tmp, page cache
```

Prompts for `sudo` once and keeps it alive only for this step.

### Work with reports

```bash
linux-cleanup --reports              # interactive manager: list, view, convert
linux-cleanup --export both latest   # export the newest report to Markdown + HTML
```

<a id="configuration"></a>
## ⚙️ Configuration&nbsp;[#](#configuration)

There is no config file. Behaviour is set by [flags](#command-line) and these environment variables:

| Variable | Default | What it does |
|---|---|---|
| `LINUX_CLEANUP_HOME` | `~/.linux-cleanup` | Parent directory for logs and reports. **Read by the Node launcher only** — it has no effect when you run `cleanup.sh` directly from a clone. |
| `LINUX_CLEANUP_LOG_DIR` | `~/.linux-cleanup/logs` or `<clone>/logs` | Where session logs are written. Honoured on every path, including a clone. |
| `LINUX_CLEANUP_REPORTS_DIR` | `~/.linux-cleanup/reports` or `<clone>/reports` | Where JSON reports are written. Honoured on every path. |
| `LINUX_CLEANUP_DATA_HOME` | unset | Parent used to locate the `feedback/` directory for debug and crash bundles. |
| `NO_COLOR` | unset | Any non-empty value disables ANSI colour. Same as `--no-color`. |
| `CLEANUP_NO_COLOR` | `0` | Set to `1` to disable colour for this tool only. |
| `XDG_CONFIG_HOME` | `~/.config` | Where `personal-roots.txt` and `project-roots.txt` are read from. |

Full reference:
[Environment variables](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/reference/environment-variables.md).

<a id="command-line"></a>
## 💻 Command Line&nbsp;[#](#command-line)

```bash
linux-cleanup [mode] [options]
```

Running it with no mode starts the guided walkthrough. **Every mode marked 🔥 deletes files permanently.**
Before using one, run the read-only equivalent:

```bash
linux-cleanup --scan          # the dry run: reports what would be reclaimed, deletes nothing
```

### Modes

| Mode | Flag | What it does |
|---|---|---|
| Walkthrough | *(default)* · `-w` | 🔥 Ten-step guided cleanup, prompting before each step |
| Menu | `-m` | 🔥 Jump-to menu — run a single category |
| TUI | `-t` `--tui` | 🔥 whiptail/dialog menu; falls back to the CLI menu if neither is installed |
| All-safe | `-a` | 🔥 Every regenerable cache in one pass |
| System | `--system` | 🔥 apt, journal, snap revisions, old kernels, `/tmp`, page cache (needs `sudo`) |
| Stale personal files | `-p` `--stale` | 🔥 Large personal files idle N+ days — interactive confirmation only |
| Partial downloads | `--partials` | 🔥 Orphan `.fdmdownload`, `.crdownload`, `.part` files |
| Stale `node_modules` | `--node-modules` | 🔥 `node_modules` in projects untouched N+ days |
| Editor extensions | `--editor-ext` | 🔥 Superseded VS Code / Cursor extension versions |
| Scan | `-s` `--scan` | Read-only audit — no deletions |
| List targets | `--list-targets` | Read-only — prints every path the tool can touch |
| Home audit | `--audit` | Read-only — 20 largest entries in `$HOME` |
| Globals audit | `--globals` | Read-only — stale global npm/pnpm/yarn/bun/deno packages |
| Doctor | `--doctor` | Repairs missing shell-init blocks. Appends only, with confirmation |
| Reports | `--reports` | Manage past reports — list, view, convert |
| Export | `--export FMT ID` | Export a report. `FMT` = `md`\|`html`\|`both`, `ID` = N\|`latest`\|`all` |
| Self-test | `--self-test` | Verify dependencies, syntax, and safety guards |
| Feedback | `--feedback` | Print bug-report instructions, offer a pre-filled `mailto:` draft |
| Debug bundle | `--debug-bundle` | Package the latest log and report into a local `.tar.gz` |
| Alias / cron | `--install-alias` `--install-cron` | Add the `cleanup` alias or a weekly run. `--uninstall-*` removes them |
| Version | `-V` `--version` | Print version and author |
| Help | `-h` `--help` | Print the full flag list |

### Options

| Flag | Default | What it does |
|---|---|---|
| `-d N` `--days N` | `100` | Idle threshold. A file is deleted only when **both** `atime` and `mtime` exceed it. |
| `--purge-all` | off | 🔥 Disables the idle gate and empties cache targets completely. Removes rarely-used assets such as Gradle wrapper distributions. |
| `-y` `--yes` | off | Auto-confirm regenerable caches. Valid with `--all-safe` only; never applies to personal files. |
| `--no-report` | off | Skip JSON report generation. Logs are still written. |
| `--cleanup-logs` | off | Delete this run's logs at the end. Reports are always kept. |
| `--no-color` | off | Disable ANSI colour. |

Full list: [CLI flags reference](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/reference/cli-flags.md).

<a id="examples"></a>
## 🧪 Examples&nbsp;[#](#examples)

| Goal | Command |
|---|---|
| See what is reclaimable, risk-free | `linux-cleanup --scan` |
| Convince yourself before deleting | `linux-cleanup --self-test && linux-cleanup --list-targets` |
| Reclaim the most space in one pass | `linux-cleanup --all-safe -y -d 30` |
| Free space before re-imaging a machine | `linux-cleanup --all-safe -y --purge-all` |
| Find forgotten project dependencies | `linux-cleanup --node-modules -d 180` |
| Weekly unattended run via cron | `linux-cleanup --all-safe -y --no-report --cleanup-logs` |
| Machine-readable output for CI | `NO_COLOR=1 linux-cleanup --scan --no-report > scan.log` |

Longer recipes:
[Reclaim the most space](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/how-to/reclaim-the-most-space.md).

<a id="advanced-features"></a>
## 🎛️ Advanced Features&nbsp;[#](#advanced-features)

- **Visual TUI** — a whiptail/dialog menu for pointing rather than typing.
  [Docs](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/features/tui.md)
- **Globals audit** — lists global packages with no dependent and no recent use, and prints the uninstall
  commands. Never deletes.
  [Docs](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/features/globals-audit.md)
- **Doctor** — detects a runtime installed on disk but missing from `~/.bashrc` and offers to append the init
  block. Append-only.
  [Docs](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/features/doctor.md)
- **Report export** — schema-versioned JSON to self-contained HTML or Markdown.
  [Docs](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/features/reports.md)
- **Shell alias and weekly cron** — one-command install and removal.
  [Docs](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/features/shell-alias-and-cron.md)
- **Crash bundles** — captured locally on unexpected failure, never transmitted.
  [Docs](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/features/feedback-and-crash-bundles.md)

<a id="recovery-troubleshooting"></a>
## 🚑 Recovery & Troubleshooting&nbsp;[#](#recovery-troubleshooting)

| Symptom | Cause | Fix |
|---|---|---|
| `refusing to delete inside protected path` | The resolved path lands inside the allowlist — often a symlink pointing into a personal directory. | Working as designed. Check the symlink with `realpath <path>`. |
| `bash 3.2 — version 4+ required` | Bash 3.2, typically macOS. | Not supported. This tool is Linux-only. |
| `export requires 'jq'` | `jq` is missing. | `sudo apt install jq`. JSON reports are still written without it. |
| `TUI mode needs 'whiptail' or 'dialog'` | Neither is installed. | Install one, or use `--menu` — the message prints the command for your distro. |
| `$HOME is not set` | Run from a context with no `$HOME`, e.g. some cron or systemd units. | Set `HOME` explicitly in the unit or crontab. |
| Cron entry runs but nothing happens | Cron's `PATH` lacks the install location. | Use the absolute path to the binary in the crontab entry. |
| Reclaimed less than expected | The idle gate spared recently-used files. | Lower the threshold with `-d 30`, or use `--purge-all`. |
| Disk usage grew during the session | A running process wrote more than the run reclaimed. | Re-check with `df -h` once the process settles. |
| A crash bundle appeared but nothing crashed | A non-zero exit the trap treats as unexpected. | Inspect with `tar -tzf`; delete it if uninteresting. |
| `alias cleanup … not found` after `--install-alias` | The shell rc has not been re-read. | `source ~/.bashrc`, or open a new terminal. |

Every symptom in full:
[Troubleshooting](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/troubleshooting.md).

<a id="limitations"></a>
## 🚧 Limitations&nbsp;[#](#limitations)

- **No undo, and no backup.** Deleted files are gone. There is no archive, no trash, no restore. This is
  deliberate — an undo log would consume the disk you are trying to free and encourage careless use.
- **Linux only.** macOS and native Windows are unsupported and blocked at install.
- **Bash 4+ and GNU coreutils are hard requirements.** The safety guard depends on `realpath -m`, a GNU
  extension; on a BSD userland the guard cannot resolve paths and refuses everything.
- **It cannot promise a number.** How much you reclaim depends on your machine. `--scan` measures it; the
  README will not guess it.
- **`--system` needs `sudo`** and touches package manager state, journals and kernels. Review the prompts.
- **Markdown and HTML export need `jq`.** Without it, JSON reports are still written; only conversion is
  unavailable.
- **Not a backup tool, not a security scanner, not a performance optimiser.** It reclaims disk space; it will
  not find secrets or malware, and freeing space rarely makes a machine faster.
- **No automated test suite.** Correctness rests on `--self-test`, ShellCheck, and manual verification on a
  real Linux system.

<a id="faq"></a>
## ❓ FAQ&nbsp;[#](#faq)

**Will it delete my code?**
Not from a protected directory, and not without asking. `node_modules` is the one project-adjacent target, it
is interactive, and it regenerates from your lockfile.

**Does it phone home?**
No. Zero network calls — no telemetry, no analytics, no update check. Verify it yourself with
`grep -rE 'curl|wget|http(s)?://[^/]' cleanup.sh lib/ modules/`; the only matches are comments, the
`--feedback` `mailto:` helper, and documentation.

**Why is there no undo?**
Because an undo log would be write amplification on the disk you are trying to free, and it would create a
false sense of safety. The allowlist, the idle gate and interactive confirmation are the real defence.

**What is the safest way to try it?**
`--self-test`, then `--scan`, then `--list-targets`. All three are read-only. After that you have seen the
safety model work without losing a byte.

**Does it work under WSL?**
Yes, on the Linux side. Windows-side directories under `/mnt/c/` are not scanned.

**Why Bash rather than Rust or Go?**
Bash is already on every target system, so there is no runtime to install and no binary to trust. The source
is auditable in an afternoon.

More: [FAQ](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/faq.md).

<a id="documentation"></a>
## 📚 Documentation&nbsp;[#](#documentation)

| Document | Read it when |
|---|---|
| [Documentation index](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/README.md) | you want the full map |
| [Quick start](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/quick-start.md) | running your first cleanup |
| [Safety](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/safety.md) | you want to understand the guards before deleting anything |
| [CLI flags](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/reference/cli-flags.md) | you need an exact flag |
| [Exit codes](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/reference/exit-codes.md) | scripting around it in cron or CI |
| [Report schema](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/reference/report-schema.md) | parsing the JSON output |
| [Troubleshooting](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/troubleshooting.md) | something failed |
| [Uninstall](https://github.com/aoneahsan/linux-cleanup/blob/main/docs/how-to/uninstall.md) | removing it cleanly |

<a id="changelog"></a>
## 🔄 Changelog&nbsp;[#](#changelog)

Latest release: **`1.4.0`** — relicensed to MIT and opened to outside contributions.
Full history: [CHANGELOG.md](https://github.com/aoneahsan/linux-cleanup/blob/main/CHANGELOG.md).

<a id="contributing"></a>
## 🤝 Contributing&nbsp;[#](#contributing)

Fork and open a pull request — no special access needed. See
[CONTRIBUTING.md](https://github.com/aoneahsan/linux-cleanup/blob/main/CONTRIBUTING.md) for setup, the
safety-first coding standards, and how to request collaborator access. `main` is protected: every change
lands through a reviewed PR.

<a id="repository"></a>
## 🗂️ Repository&nbsp;[#](#repository)

```
cleanup.sh     entry point — argument parsing and dispatch
lib/           common.sh (safe_rm, guards, UI, JSON helpers) · scan.sh (read-only scanners)
modules/       one file per mode — walkthrough, all_safe, system_sudo, reports, tui, doctor, …
bin/           Node launcher used by npx and global install
docs/          full documentation (not shipped in the npm tarball)
assets/        logo master
```

<a id="support"></a>
## 💬 Support&nbsp;[#](#support)

Questions and bugs: [open an issue](https://github.com/aoneahsan/linux-cleanup/issues). For a bug, run
`linux-cleanup --debug-bundle` first and attach the archive after reviewing it — it contains `$HOME` paths
from your machine. Security reports go privately to
[aoneahsan@gmail.com](mailto:aoneahsan@gmail.com).

If this tool saved you time, you can support its maintenance at
[aoneahsan.com/payment](https://aoneahsan.com/payment?project-id=linux-cleanup&project-identifier=linux-cleanup).

<a id="license"></a>
## 📄 License&nbsp;[#](#license)

MIT © Ahsan Mahmood — see
[LICENSE](https://github.com/aoneahsan/linux-cleanup/blob/main/LICENSE). Provided "AS IS", without warranty;
this tool deletes files, so review what it proposes before confirming.

<a id="author"></a>
## 👤 Author&nbsp;[#](#author)

**Ahsan Mahmood** — [aoneahsan.com](https://aoneahsan.com) · [GitHub](https://github.com/aoneahsan) ·
[LinkedIn](https://linkedin.com/in/aoneahsan) · [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com)

<a id="links"></a>
## 🔗 Links&nbsp;[#](#links)

| | |
|---|---|
| Documentation | https://github.com/aoneahsan/linux-cleanup/blob/main/docs/README.md |
| npm | https://www.npmjs.com/package/linux-cleanup |
| Repository | https://github.com/aoneahsan/linux-cleanup |
| Issues | https://github.com/aoneahsan/linux-cleanup/issues |
| Changelog | https://github.com/aoneahsan/linux-cleanup/blob/main/CHANGELOG.md |
| Contributing | https://github.com/aoneahsan/linux-cleanup/blob/main/CONTRIBUTING.md |
| Support the project | https://aoneahsan.com/payment?project-id=linux-cleanup&project-identifier=linux-cleanup |

<a id="keywords"></a>
## 🏷️ Keywords&nbsp;[#](#keywords)

*linux · cleanup · disk-cleanup · cache-cleanup · disk-space · node-modules · yarn-cache · npm-cache ·
developer-tools · system-utility · bash · cli*
