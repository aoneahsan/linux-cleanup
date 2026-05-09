# CLI flags — complete reference

> Every flag, alphabetised. For mode-specific behaviour, see the linked feature page. For full mode list see [`reference/modes.md`](./modes.md).

**Run `linux-cleanup --help` for the same content with current path values inlined.**

---

## Modes (pick one)

| Flag | Aliases | Effect | See |
|---|---|---|---|
| _(no flag)_ | `-w`, `--walkthrough` | Default — guided 10-step walkthrough through every category | [Walkthrough](../features/walkthrough.md) |
| `-m` | `--menu`, `-i`, `--interactive` | Numbered jump-to CLI menu | [Menu](../features/menu.md) |
| `-t` | `--tui`, `-g`, `--gui` | Visual whiptail / dialog menu (1.3.0+) | [TUI](../features/tui.md) |
| `-a` | `--all-safe` | Batch wipe of every regenerable cache | [All-safe](../features/all-safe.md) |
| `-s` | `--scan` | Read-only audit | [Scan](../features/scan.md) |
| `-p` | `--stale` | Personal files unused N+ days (interactive only) | [Stale personal files](../features/personal-stale-files.md) |
| | `--system` | Sudo cleanup: apt, journal, snap, kernels, /tmp, page cache | [System cleanup](../features/system-cleanup.md) |
| | `--partials` | Partial / orphan downloads | [Partial downloads](../features/partial-downloads.md) |
| | `--audit` | Top 20 largest entries in `$HOME` | [Home audit](../features/home-audit.md) |
| | `--node-modules` | Stale `node_modules/` finder | [Node modules finder](../features/node-modules-finder.md) |
| | `--globals` | Read-only audit of npm/pnpm/yarn/bun/deno globals | [Globals audit](../features/globals-audit.md) |
| | `--doctor` | Detect / repair shell-init breakage | [Doctor](../features/doctor.md) |
| | `--editor-ext` | Old VS Code / Cursor extension versions | [Editor extensions](../features/editor-extensions.md) |
| | `--reports` | Reports manager — list / convert / view | [Reports](../features/reports.md) |
| | `--export FMT ID` | Non-interactive report conversion (md/html/both, ID/all/latest) | [Reports](../features/reports.md#exporting-to-markdown--html) |
| | `--feedback` | Bug report instructions + optional mailto draft | [Feedback & crash bundles](../features/feedback-and-crash-bundles.md) |
| | `--debug-bundle` | Package latest log + report into tar.gz | [Feedback & crash bundles](../features/feedback-and-crash-bundles.md) |
| | `--list-targets` | Print every path the script can touch | [Safety](../safety.md) |
| | `--self-test` | Verify deps + syntax + safety guards | [Installation](../installation.md#verify-the-install) |
| `-V` | `--version` | Show version + author info | (built-in) |
| | `--install-alias` | Add `cleanup` shell alias | [Alias & cron](../features/shell-alias-and-cron.md) |
| | `--install-cron` | Schedule weekly all-safe (Sunday 03:00) | [Alias & cron](../features/shell-alias-and-cron.md) |
| | `--uninstall-alias` | Remove the alias | [Alias & cron](../features/shell-alias-and-cron.md) |
| | `--uninstall-cron` | Remove the cron entry | [Alias & cron](../features/shell-alias-and-cron.md) |

---

## Options

| Flag | Default | Effect |
|---|---|---|
| `-d N`, `--days N` | `100` | Staleness threshold. Files where both `atime` and `mtime` are older than N days are eligible for deletion (subject to other guards). Lower = more aggressive. |
| `--purge-all` | off | Disable the staleness gate. Dev-tool data and editor extensions are wiped fully (pre-1.2.0 behaviour). |
| `-y`, `--yes` | off | Auto-confirm regenerable-cache deletions. Only valid with `--all-safe`. **Personal modes ignore `-y` by policy.** |
| `--no-report` | off | Skip JSON session report generation. Logs are still written. |
| `--cleanup-logs` | off | Delete this run's log file at finish. **Reports are always preserved.** |
| `--no-color` | off | Disable ANSI colour. Also respects `NO_COLOR` env var (de-facto standard). |
| `-h`, `--help` | — | Print help and exit. |

---

## Quick recipes

| Goal | Command |
|---|---|
| First run, see what's reclaimable | `linux-cleanup --scan` |
| Guided cleanup with prompts | `linux-cleanup` |
| One-shot batch, no prompts | `linux-cleanup --all-safe -y` |
| Aggressive sweep | `linux-cleanup --all-safe -y -d 30` |
| Visual menu | `linux-cleanup --tui` |
| Find old project `node_modules/` | `linux-cleanup --node-modules -d 90` |
| System maintenance (sudo) | `linux-cleanup --system` |
| Sunday 03:00 weekly cron | `linux-cleanup --install-cron` |
| Send a bug report | `linux-cleanup --debug-bundle && linux-cleanup --feedback` |
| Convert latest report to HTML | `linux-cleanup --export html latest` |

---

## Environment variables

See [Environment variables](./environment-variables.md) for the full list. Most-used:

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable ANSI output (any non-empty value) |
| `LINUX_CLEANUP_LOG_DIR` | Override log directory |
| `LINUX_CLEANUP_REPORTS_DIR` | Override reports directory |
| `LINUX_CLEANUP_DATA_HOME` | Parent for logs/reports/feedback (default `~/.linux-cleanup/`) |

---

## Exit codes

See [Exit codes](./exit-codes.md). Summary:

- `0` — clean run
- `2` — argument parse error
- `130` — `Ctrl-C`
- `143` — `SIGTERM`
- anything else — unexpected; auto-creates a [crash bundle](../features/feedback-and-crash-bundles.md)

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
