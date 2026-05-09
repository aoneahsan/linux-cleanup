# Safety philosophy

> linux-cleanup is built on the principle that **a cleanup tool should never be the reason you lose data**. Every destructive action is gated by an allowlist, a staleness check, an interactive confirmation, or all three. This document explains exactly what those gates are and why each one exists.

**Audience**: anyone who wants to understand what the tool refuses to do.
**Document type**: explanation (Diátaxis) — read once, refer back when something surprises you.

---

## The four guards

linux-cleanup applies up to four independent guards before any deletion. A path must pass *every* applicable guard before `safe_rm` will touch it.

### Guard 1 — Path allowlist (always on)

`safe_rm` refuses to delete any path that resolves inside any of:

```
/                         /etc                      /usr
/boot                     /sys                      /proc
$HOME                    (the literal $HOME — refusing to wipe your home root)
$HOME/Documents          $HOME/Pictures            $HOME/Music
$HOME/Videos             $HOME/Desktop             $HOME/Public
$HOME/.ssh               $HOME/.gnupg              $HOME/.config
$HOME/.claude            $HOME/.password-store     $HOME/.aws
```

The check uses `realpath` to defeat symlink tricks. If you `ln -s ~/Documents ~/.cache/yarn`, the symlink-resolved path lands inside `~/Documents`, the guard fires, and the deletion is rejected with `✗ refusing to delete inside protected path`.

**Why this guard**: a one-off bug or an attacker-controlled environment variable should never be enough to wipe `$HOME`. The allowlist is a literal hard refusal — there is no `--force` flag that bypasses it.

To see the list as the running script sees it:

```bash
linux-cleanup --list-targets
```

### Guard 2 — Staleness gate (default ≥ 100 days, since 1.2.0)

For anything that is a **tool** rather than a regenerable cache (Android AVDs, VS Code extension versions, flatpak user data, `node_modules`, global packages), deletion requires *both*:

1. The asset has no active dependency / no newer-version supersession, AND
2. The asset has been idle (`atime` AND `mtime`) for at least `--days N` days. Default: 100.

A Gradle wrapper distro you opened two weeks ago will be listed as "found" but not deleted. An AVD you booted last month survives. Lower the threshold (`-d 30`) when you're confident, or override with `--purge-all` when you really want pre-1.2.0 wipe-everything behaviour.

**Why this guard**: caches like `~/.cache/yarn` are designed to be re-fetched on demand and cost nothing to delete. Tools like AVDs cost 6–30 GB to re-download and 30 minutes of your day. Treating the two the same is wrong; the staleness gate keeps the second category safe.

### Guard 3 — Interactive-only for personal data

Personal-file modes (`-p` / `--stale`, `--partials`, `--node-modules`, `--editor-ext` for retained-but-superseded entries) are **interactive only**. There is no `--yes` shortcut. The tool prints a candidate list, you confirm each entry (or batch) by hand, and only then does anything get deleted.

**Why this guard**: personal files have no signal that distinguishes "junk I forgot about" from "thing I haven't used yet but will need". The user is the only oracle. The tool refuses to guess.

### Guard 4 — Sudo confinement

System cleanup (`--system`) is the only mode that calls `sudo`, and it does so for a tightly enumerated list of operations:

- `sudo apt autoremove` (or distro equivalent)
- `sudo journalctl --vacuum-size=…`
- `sudo snap set system refresh.retain=2; sudo snap remove --revision <old>`
- `sudo apt-get autoremove --purge` for old kernels (Debian/Ubuntu only)
- Aging `/tmp` entries beyond `--days`
- `sudo sysctl vm.drop_caches=3` to release page-cache memory (cheap, safe, regenerates automatically)

Every `sudo` call is a separate, reviewable invocation. The script does not run a long-lived sudo session, does not edit `/etc/sudoers`, and does not modify any service.

---

## What linux-cleanup will NOT touch

| Category | Reason |
|---|---|
| Anything inside `~/Documents`, `~/Pictures`, `~/Music`, `~/Videos`, `~/Desktop`, `~/Public` | Allowlist guard |
| `~/.ssh`, `~/.gnupg`, `~/.password-store`, `~/.aws` | Allowlist guard — credentials |
| `~/.config` | Allowlist guard — application configs |
| `~/.claude` | Allowlist guard — Claude Code state |
| `/`, `/etc`, `/usr`, `/boot`, `/sys`, `/proc` | Allowlist guard — system roots |
| Recently-used Android AVDs, Gradle distros, editor extensions, `node_modules` | Staleness guard |
| User-scope flatpak apps that are actually installed | Staleness guard + dependency check |
| Personal files anywhere on disk | Interactive-only guard — never batched |
| Open file descriptors, running processes, swap | Out of scope by design |
| The cleanup script's own working tree | Allowlist guard |

---

## What linux-cleanup *will* delete

Only the following, and only when the relevant guards pass:

- Package-manager **caches**: `~/.cache/yarn`, `~/.npm/_cacache`, `~/.local/share/pnpm/store`, `~/.cache/pip`, `~/.composer/cache`
- App **caches**: Chrome / Brave / Chromium / Edge / Vivaldi `Cache/`, Firefox `cache2/`, `~/.gradle/caches/`, `~/.cache/Cypress`, `~/.cache/ms-playwright`, `~/.zoom/Cache`, `~/.config/Code/CachedExtensionVSIXs`, `~/.config/Cursor/CachedExtensionVSIXs`
- Dev-tool **data** that's both stale and unused: stale Android AVDs, stale Flutter pub cache, stale Dart analysis-server caches, stale flatpak user data
- **System** caches (with sudo): apt cache, journal logs, snap revisions, old kernels, `/tmp` entries beyond N days, kernel page cache
- **Stale `node_modules`**: only after you confirm each one
- **Superseded VS Code / Cursor extension versions**: only when a newer version exists *and* the older one has been idle ≥ N days
- **Partial / orphan downloads**: `*.fdmdownload`, `*.crdownload`, `*.part`, only after confirmation
- **Personal files**: only when you tick them in the interactive list

---

## Inspecting before trusting

Three commands give you complete visibility into what the tool would do:

```bash
linux-cleanup --list-targets    # every path the script can touch
linux-cleanup --self-test       # syntax + safety guard sanity checks
linux-cleanup --scan            # read-only audit, prints what would be reclaimed
```

`--self-test` includes a literal assertion that paths like `/`, `~/Documents`, `~/.ssh`, `/etc`, `/boot` are protected, and that paths like `~/.cache/yarn` are not. The assertions print pass/fail. A single failure aborts the test with a non-zero exit code.

---

## What happens when something goes wrong

linux-cleanup does **not** ship an "undo" feature. Cache deletion is intentionally one-way: the next `yarn install`, the next browser launch, the next IDE start regenerates whatever was removed. The author's reasoning:

- An undo log would itself be a write-amplification cost on the very disk you're trying to free.
- It would create a false sense of safety that incentivises sloppy use.
- The actual safety model — allowlists, staleness gates, interactive confirmation — is a far better defence.

If a deletion ever surprises you:

1. The **session log** at `~/.linux-cleanup/logs/cleanup-<timestamp>.log` records every path that was touched, what its size was, and the exit status of every `safe_rm` call.
2. The **JSON report** at `~/.linux-cleanup/reports/report-<timestamp>.json` is a canonical, schema-versioned dump of the same information in a structured form.
3. Email those two files to the author with a short description of what surprised you. See [Send a bug report](./how-to/send-a-bug-report.md).

---

## Why an allowlist instead of a denylist

A denylist (`don't delete /etc`, `don't delete ~/.ssh`, …) gives an attacker or a typo a single-character path away from disaster. An allowlist (`only delete inside ~/.cache/yarn, ~/.npm/_cacache, …`) inverts the failure mode: any path the script doesn't recognise is rejected by default. That's the right default for a tool that operates at scale, on filesystems, with `sudo` available.

This is the same reasoning Linux package managers use, and the same reasoning that distinguishes BleachBit-style "wipe everything that looks like junk" from `linux-cleanup`'s "delete only what we can prove is regenerable, idle, or explicitly confirmed".

---

## Further reading

- [Features overview](./README.md#features) — every cleanup category linked to its own page
- [CLI reference](./reference/cli-flags.md) — every flag, alphabetised
- [Reports](./features/reports.md) — what the JSON report contains and how to read it
- [About the author](./about-the-author.md) — why this tool was built the way it was

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) — independent software engineer specialising in safe-by-default developer tooling. [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan).
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
