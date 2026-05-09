# Modes — at-a-glance reference

Every mode, what it does, what it touches, whether it's interactive, and what category it belongs to.

| Mode flag | Category | Interactive? | Calls sudo? | Writes report? | Doc |
|---|---|---|---|---|---|
| _(default)_ / `-w` | Cleanup (full) | Yes | Optional (Step 9) | Yes | [Walkthrough](../features/walkthrough.md) |
| `-m` / `--menu` | Cleanup (selective) | Yes | Optional | Per action | [Menu](../features/menu.md) |
| `-t` / `--tui` | Cleanup (selective) | Yes (visual) | Optional | Per action | [TUI](../features/tui.md) |
| `-a` / `--all-safe` | Cleanup (batch) | Only without `-y` | No | Yes | [All-safe](../features/all-safe.md) |
| `-s` / `--scan` | Inspection | No | No | Yes | [Scan](../features/scan.md) |
| `-p` / `--stale` | Cleanup (personal) | Always | No | Yes | [Personal stale](../features/personal-stale-files.md) |
| `--system` | Cleanup (system) | Yes | Yes | Yes | [System cleanup](../features/system-cleanup.md) |
| `--partials` | Cleanup (personal) | Always | No | Yes | [Partial downloads](../features/partial-downloads.md) |
| `--audit` | Inspection | No | No | No | [Home audit](../features/home-audit.md) |
| `--node-modules` | Cleanup (project) | Always | No | Yes | [Node modules finder](../features/node-modules-finder.md) |
| `--globals` | Inspection | No | No | No | [Globals audit](../features/globals-audit.md) |
| `--doctor` | Repair | Yes | No (writes only `~/.bashrc` etc.) | No | [Doctor](../features/doctor.md) |
| `--editor-ext` | Cleanup (regenerable) | Yes | No | Yes | [Editor extensions](../features/editor-extensions.md) |
| `--reports` | Output | Yes | No | No | [Reports](../features/reports.md) |
| `--export FMT ID` | Output | No | No | No | [Reports](../features/reports.md#exporting-to-markdown--html) |
| `--feedback` | Meta | Yes | No | No | [Feedback](../features/feedback-and-crash-bundles.md) |
| `--debug-bundle` | Meta | No | No | No | [Feedback](../features/feedback-and-crash-bundles.md) |
| `--list-targets` | Meta | No | No | No | [Safety](../safety.md) |
| `--self-test` | Meta | No | No | No | [Installation](../installation.md#verify-the-install) |
| `--version` / `-V` | Meta | No | No | No | (built-in) |
| `--install-alias` | Setup | Yes | No | No | [Alias & cron](../features/shell-alias-and-cron.md) |
| `--install-cron` | Setup | Yes | No | No | [Alias & cron](../features/shell-alias-and-cron.md) |
| `--uninstall-alias` | Setup | Yes | No | No | [Alias & cron](../features/shell-alias-and-cron.md) |
| `--uninstall-cron` | Setup | Yes | No | No | [Alias & cron](../features/shell-alias-and-cron.md) |

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
