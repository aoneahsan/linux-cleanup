# Menu mode (`--menu` / `-m`)

> A jump-to single-category CLI menu — pick one cleanup task, run it, return to the menu, pick another. The same actions as the [walkthrough](./walkthrough.md) but in any order you want.

**Type**: cleanup mode (interactive)
**Run**: `linux-cleanup -m`
**Touches personal data**: only when you pick a personal-data category, and even then only after explicit confirmation

---

## What it does

Instead of marching through ten steps in order, the menu prints a numbered list of every action and waits for your selection. Each action runs in isolation, prints its own summary, and returns you to the menu.

```
── Jump-to menu — Pick a single category — or press q to quit ──

Inspect
  1)  Scan & report (no deletes)
  9)  Top 20 largest entries in $HOME
  12) Show disk + memory usage

Clean — safe / regenerable
  2)  All regenerable caches (batch)
  3)  Package-manager caches (yarn, npm, pnpm, composer, pip)
  4)  App caches (Chrome, Gradle, Cypress, Playwright, Zoom, TS)
  5)  Dev-tool data (Android AVDs, pub, dart, flatpak)
  11) Old VS Code / Cursor extension versions

Project + personal (interactive)
  10) Stale node_modules in old projects
  18) Audit global npm/pnpm/yarn/bun/deno packages (read-only)
  19) Doctor — detect & repair shell-init breakage
  8)  Partial / orphan downloads
  7)  Personal files unused 100+ days

System
  6)  System cleanup (sudo: apt, journal, kernels, snap, tmp, pagecache)

Reports
  15) Reports manager (list / convert / view past reports)

Setup
  13) Install 'cleanup' shell alias
  14) Install weekly cron (Sunday 3 AM, all-safe)

Help / Feedback
  16) Send feedback / report a bug (offline — email)
  17) Create debug bundle (latest log + report → tar.gz)

  q)  Quit

  →
```

Type the number, press Enter. The corresponding action runs with full output. When it finishes you return to the menu.

---

## When to use it

- **Targeted cleanup.** "I just need to wipe my yarn cache, leave everything else alone." → option 3.
- **You already know what's eating space.** A scan told you it's Chrome cache; jump straight to option 4 instead of running the whole walkthrough.
- **Repeated invocations in one sitting.** The menu lets you chain: "scan, then clean app caches, then rescan, then wipe AVDs" without restarting the script.
- **You prefer numbered choices to whiptail dialogs.** The CLI menu uses no extra dependencies — just the terminal.

If you want a visual point-and-shoot interface, see [TUI mode](./tui.md). If you want every category in order without picking, see [Walkthrough](./walkthrough.md).

---

## Quick reference

| Number | Action | See |
|---|---|---|
| 1 | Scan & report | [Scan](./scan.md) |
| 2 | All regenerable caches (batch) | [All-safe](./all-safe.md) |
| 3 | Package-manager caches | (built into the menu) |
| 4 | App caches | (built into the menu) |
| 5 | Dev-tool data | (built into the menu) |
| 6 | System cleanup (sudo) | [System cleanup](./system-cleanup.md) |
| 7 | Personal files unused N+ days | [Stale personal files](./personal-stale-files.md) |
| 8 | Partial / orphan downloads | [Partial downloads](./partial-downloads.md) |
| 9 | Top 20 largest entries in `$HOME` | [Home audit](./home-audit.md) |
| 10 | Stale `node_modules` | [Node modules finder](./node-modules-finder.md) |
| 11 | Old VS Code / Cursor extension versions | [Editor extensions](./editor-extensions.md) |
| 12 | Show disk + memory usage | (informational only) |
| 13 | Install shell alias | [Alias & cron](./shell-alias-and-cron.md) |
| 14 | Install weekly cron | [Alias & cron](./shell-alias-and-cron.md) |
| 15 | Reports manager | [Reports](./reports.md) |
| 16 | Send feedback / report a bug | [Feedback & crash bundles](./feedback-and-crash-bundles.md) |
| 17 | Create debug bundle | [Feedback & crash bundles](./feedback-and-crash-bundles.md) |
| 18 | Audit global packages | [Globals audit](./globals-audit.md) |
| 19 | Doctor | [Doctor](./doctor.md) |

---

## FAQ

**Why are the numbers non-sequential?**
History — new options were added without renumbering existing ones, so muscle memory survives. The grouping (Inspect / Clean / Personal / System / …) is what matters.

**Can I script the menu non-interactively?**
The menu is for humans. For non-interactive scripting, use the dedicated mode flags directly: `linux-cleanup --scan`, `linux-cleanup --all-safe -y`, `linux-cleanup --node-modules -d 60`, etc.

**Does Ctrl-C inside an action quit the whole menu?**
No — `Ctrl-C` aborts the running action and returns you to the menu prompt. Press `q` (or Ctrl-C at the menu) to actually quit.

---

## See also

- [Walkthrough](./walkthrough.md) — same actions, fixed order, with prompts
- [TUI](./tui.md) — visual menu using whiptail / dialog
- [All-safe](./all-safe.md) — option 2 unrolled: every regenerable cache, batched
- [Reports](./reports.md) — option 15 in detail
- [Feedback & crash bundles](./feedback-and-crash-bundles.md) — options 16 & 17

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
