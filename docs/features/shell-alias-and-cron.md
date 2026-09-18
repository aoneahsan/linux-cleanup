# Shell alias & weekly cron

> Two one-time setup helpers. `--install-alias` adds a `cleanup` alias to your shell rc so you can type `cleanup` from anywhere. `--install-cron` schedules `--all-safe -y` to run every Sunday at 03:00. Both have matching uninstall flags.

**Type**: setup helpers
**Run**: `linux-cleanup --install-alias`, `linux-cleanup --install-cron`, `--uninstall-alias`, `--uninstall-cron`
**Touches**: your shell rc (`~/.bash_aliases` or `~/.zshrc`); your crontab. No other state.

---

## Shell alias

```bash
linux-cleanup --install-alias
```

What it does:

1. Detects your shell (`bash` or `zsh`).
2. Picks the right rc file: `~/.bash_aliases` (preferred for bash if it exists), else `~/.zshrc`, else `~/.bashrc`.
3. Confirms with you before writing.
4. Appends:
   ```bash
   # linux-cleanup tool
   alias cleanup='/path/to/cleanup.sh'
   ```
5. Reminds you to `source` the rc or open a new terminal.

**Which `cleanup.sh`?** From a git clone, the clone's own. Under `npx` or `npm install -g`, the tool first copies itself (`cleanup.sh`, `lib/`, `modules/`, `VERSION`, `LICENSE`) to `~/.linux-cleanup/app/` and points the alias there. The npx cache is evicted by npm — and pruned by this tool's own all-safe run — and a global install lives under one Node version; the copy depends on neither. Run `--install-alias` again after an upgrade to refresh the copy. (Before 1.6.0 the alias pointed into the npx cache and broke when that was cleared. 1.6.0 finds such an entry by its `# linux-cleanup tool` marker and offers to repoint it.)

After the alias is installed, you can type `cleanup` instead of `linux-cleanup` (or instead of the absolute path to `cleanup.sh`).

### Removal

```bash
linux-cleanup --uninstall-alias
```

Walks `~/.bash_aliases`, `~/.zshrc`, and `~/.bashrc`, looks for the `# linux-cleanup tool` marker or any `alias cleanup='…/cleanup.sh'` line — whatever path it holds — asks for confirmation, and removes the line + the comment header. A `.bak` backup is written first (`~/.bashrc.bak`, etc.). Once neither an alias nor a cron entry is left, it offers to remove `~/.linux-cleanup/app/` too.

If you've installed the alias multiple times across rc files, run `--uninstall-alias` once per file.

---

## Weekly cron

```bash
linux-cleanup --install-cron
```

What it does:

1. Adds a single line to your user crontab:
   ```
   0 3 * * 0 /path/to/cleanup.sh --all-safe -y >>~/.linux-cleanup/logs/cron.log 2>&1 # linux-cleanup
   ```
   The path follows the same rule as the alias: the persistent copy in `~/.linux-cleanup/app/` under `npx` or a global install, so the job needs no `node`, `npx` or network when it fires.
2. Recognises an existing entry by the trailing `# linux-cleanup` marker (or the older `cleanup.sh --all-safe` shape). An identical entry is left alone; a different one is shown and replaced only if you confirm.

Schedule: every Sunday at **03:00 local time**, runs [`--all-safe -y`](./all-safe.md), appends both stdout and stderr to `~/.linux-cleanup/logs/cron.log`.

### Why Sunday 03:00

- Sunday is the day most users have idle developer machines.
- 03:00 is late enough to not collide with end-of-day work, early enough to be done before Monday morning.
- These are baked-in defaults for v1.3.0 — change the schedule by editing your crontab directly (`crontab -e`) after install. Removing and reinstalling is safe.

### Why `--all-safe` and not `--system`

`--all-safe` is restricted to regenerable caches and never calls `sudo`. `--system` requires `sudo` and prompts for a password — neither is appropriate for unattended cron. If you want `--system` on a schedule, set up passwordless `sudo` for the script yourself; the tool deliberately doesn't automate that.

### Removal

```bash
linux-cleanup --uninstall-cron
```

Reads your crontab, finds the entry by its `# linux-cleanup` marker (or the older `cleanup.sh --all-safe` shape), asks for confirmation, and writes the crontab back without it. Other cron entries are preserved untouched.

---

## Reading the cron log

Each weekly run appends to `~/.linux-cleanup/logs/cron.log`:

```bash
tail -100 ~/.linux-cleanup/logs/cron.log
```

The log is human-readable. Each session is bracketed with a timestamp header so you can see what happened on which date.

The structured JSON report from each cron run is at `~/.linux-cleanup/reports/report-<timestamp>.json` — the cron log is the convenience copy; the JSON is the canonical record.

---

## What these helpers will NOT do

- Will **not** modify any rc file you don't have. If you're a `fish` / `nushell` user without `~/.bashrc` or `~/.zshrc`, the alias install reports "no compatible rc file found" and exits cleanly.
- Will **not** install a system-wide cron entry (`/etc/cron.d/*`). Only your user crontab.
- Will **not** update themselves. The persistent copy in `~/.linux-cleanup/app/` stays at the version that installed it until you run `--install-alias` or `--install-cron` again from a newer one.
- Will **not** run as root, even if the script is invoked with `sudo`. The alias and cron entries are explicitly scoped to the invoking user.

---

## FAQ

**My cron isn't firing.**
Check `systemctl status cron` (Debian/Ubuntu) or `systemctl status cronie` (Fedora/Arch). On systemd-only minimal installs, `cron` may not be active. Alternative: use a systemd `--user` timer. The tool doesn't ship that, but the cron line above is easy to translate.

**The alias works in interactive shells but not in scripts.**
Aliases are not expanded in non-interactive shells by default. If you need `cleanup` in a script, use the absolute path to `cleanup.sh` directly, or `command linux-cleanup` if you've globally installed via npm.

**I want to schedule something other than `--all-safe`.**
Edit the crontab line directly: `crontab -e`. The tool's `--install-cron` is a sensible default, not a mandate.

**I want it to run after every login instead of weekly.**
That's a bad idea — `--all-safe` rebuilds caches that you've actively been using. Once a week is the right cadence.

---

## See also

- [All-safe](./all-safe.md) — what the cron entry actually runs
- [Doctor](./doctor.md) — fixes the most common reason your alias / cron *line* runs but the *commands* fail (broken `PATH`)
- [Uninstall](../how-to/uninstall.md) — full uninstall, including these helpers and `~/.linux-cleanup/`

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-09-18 · **Tool version**: 1.6.0
