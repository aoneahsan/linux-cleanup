# Walkthrough mode (`--walkthrough` / `-w` / no flag)

> The guided walkthrough is a ten-step interactive tour through every category linux-cleanup knows about. It runs by default — type `linux-cleanup` with no arguments and you're in it.

**Type**: cleanup mode (interactive)
**Default**: yes — this is what runs when you provide no flags
**Touches personal data**: no, except for the optional Step 8 (stale personal files) which is interactive-only

---

## What it does

The walkthrough sequences through ten cleanup categories, asking before each destructive action and printing a per-step running total of bytes reclaimed. The order is fixed and chosen so the cheapest, safest deletions happen first.

| Step | Category | Default action | Touches personal data? |
|---|---|---|---|
| 1 | Pre-flight scan | Read-only inventory | no |
| 2 | Package-manager caches | yarn / npm / pnpm / pip / composer cache | no |
| 3 | App caches | Chrome / Brave / Firefox / Gradle / Cypress / Playwright / Zoom / VSCode caches | no |
| 4 | Dev-tool data | Stale AVDs, pub-cache, Dart analysis caches, flatpak user data | no (staleness-gated) |
| 5 | Editor extension cleanup | Old VS Code / Cursor extension versions | no (staleness-gated) |
| 6 | Stale `node_modules` | Old project `node_modules/` directories | confirms each one |
| 7 | Partial downloads | `.fdmdownload`, `.crdownload`, `.part` | confirms each one |
| 8 | Stale personal files | Files you haven't touched in N+ days | interactive-only |
| 9 | System cleanup (optional) | apt / journal / snap / kernels / `/tmp` / page cache | requires `sudo` |
| 10 | Session report | Save JSON + show summary | no |

Each step shows a **running total**:

```
══════════════════════════════════════════════════════════════════════════════
  STEP 3/10 — App caches
  Recovered so far: 8.2 GB
══════════════════════════════════════════════════════════════════════════════
```

You can `Ctrl-C` at any step. The log + report capture progress up to the abort.

---

## When to use it

- **Your first run on a new machine.** The walkthrough shows you, in order, what kind of disk hog each tool is on your specific setup.
- **Periodic deep-clean.** Once a quarter, walk through every category instead of hitting `--all-safe` blindly.
- **When you're not sure what's eating disk.** The pre-flight scan is the same as `--scan` and prints sizes before any deletions.

For repeated weekly cleanups, switch to [`--all-safe -y`](./all-safe.md) inside cron — the walkthrough's prompts make it a poor fit for unattended runs.

---

## Customising the walkthrough

| Flag | Effect |
|---|---|
| `-d N` / `--days N` | Lower or raise the staleness threshold (default 100). Affects steps 4, 5, 6, 8, 9. |
| `--purge-all` | Disable the staleness gate everywhere. Steps 4 and 5 wipe-everything instead of "wipe stale". Use sparingly — see [Safety](../safety.md). |
| `--no-report` | Skip Step 10 (JSON report). Logs are still kept. |
| `--cleanup-logs` | Delete this run's log file at the end. Reports are always preserved. |
| `--no-color` | Disable ANSI colour. Useful inside `script` / dumb terminals. |

You cannot pass `--yes` to the walkthrough — by design. If you want one-shot batch mode, use [`--all-safe -y`](./all-safe.md) instead.

---

## Reading the output

```
── [ STEP 2/10 ]  Package-manager caches ──

  yarn cache       12.4 GB     last used 134 days ago
  npm cache         3.1 GB     last used  18 days ago
  pnpm store        4.8 GB     last used   2 days ago
  pip cache         480 MB     last used  41 days ago

  Delete yarn cache (12.4 GB)?  [Y/n]
```

- **Bold green ✓** = action completed, bytes added to the running total.
- **Yellow !** = warning (e.g., command not installed, path missing). Non-fatal; skipped.
- **Red ✗** = refusal (e.g., a path was protected, or `safe_rm` rejected it). Logged and skipped.
- **Dim grey** = informational, no action taken.

The step header always shows `STEP N/10` so you know how much further the walkthrough has to go.

---

## What gets skipped when

- Tools that aren't installed (e.g., `pnpm` on a yarn-only machine) → step prints `· not installed, skipping` and moves on.
- Caches that are already empty → `· nothing to reclaim`.
- Steps that need `sudo` and you say "no" → skipped, walkthrough continues.

The walkthrough never aborts on a single skip. The only thing that ends a run early is your `Ctrl-C`.

---

## FAQ

**Does the walkthrough modify my dotfiles?**
No. Configs, shell rcs, and credentials all live inside `$HOME/.config`, `$HOME/.ssh`, etc. — all on the [allowlist of refused paths](../safety.md).

**Will it delete my Chrome bookmarks / passwords?**
No. The walkthrough touches only browser **cache** directories (e.g. `~/.config/google-chrome/Default/Cache/`, `Code Cache/`, `GPUCache/`), never `Bookmarks`, `Login Data`, `History`, or `Cookies`.

**My session ran for 12 minutes and did nothing visible. Is something wrong?**
Probably not — `find`-based scans across `$HOME` can take a while on slow disks. Tail the log: `tail -f ~/.linux-cleanup/logs/cleanup-*.log`. If you see the script hanging on a specific path for over 60s, [send a bug report](../how-to/send-a-bug-report.md).

**Can I re-run a single step instead of the whole walkthrough?**
Yes — use [`--menu` / `-m`](./menu.md) and pick that single step.

---

## See also

- [Menu mode](./menu.md) — jump-to single-category CLI menu
- [TUI mode](./tui.md) — visual whiptail-based menu (1.3.0+)
- [All-safe mode](./all-safe.md) — same categories, no prompts, suitable for cron
- [Scan mode](./scan.md) — read-only version of step 1
- [Safety](../safety.md) — every guard the walkthrough applies
- [Reports](./reports.md) — what step 10 writes

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
