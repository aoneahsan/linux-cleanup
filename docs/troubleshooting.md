# Troubleshooting

> Symptom → cause → fix. For each entry, run the verify command first; if the symptom matches, apply the fix.

---

## "✗ refusing to delete inside protected path"

**Cause**: a path resolved (after symlink expansion) to inside `~/Documents`, `~/.ssh`, `/etc`, etc. — the [allowlist guard](./safety.md) blocked the deletion.

**Fix**: this is correct behaviour. Inspect what got resolved:

```bash
linux-cleanup --list-targets    # shows protected paths
realpath <the path that was rejected>
```

If a cache lives behind a symlink that lands inside a protected directory, **fix the symlink** rather than the script. The script is doing exactly what it should.

---

## "TUI mode needs 'whiptail' or 'dialog'"

**Cause**: you ran `linux-cleanup --tui` but neither tool is installed.

**Fix**: install one. Or fall back to the regular CLI menu (the tool offers this).

```bash
# Debian / Ubuntu
sudo apt install whiptail
# Fedora / RHEL
sudo dnf install newt
# Arch
sudo pacman -S libnewt
```

Verify: `command -v whiptail`. Then re-run `linux-cleanup --tui`.

---

## "export requires 'jq'"

**Cause**: you ran `--export md`, `--export html`, or used the reports manager's conversion option, but `jq` isn't installed.

**Fix**:

```bash
sudo apt install jq          # Debian / Ubuntu
sudo dnf install jq          # Fedora / RHEL
sudo pacman -S jq            # Arch
```

Then retry. `jq` is needed only for the report-conversion features; the rest of the tool works without it.

---

## Script exits with `command not found`

**Cause**: a hard-required dependency (`bash`, `find`, `du`, `stat`, `awk`) is missing or aliased to something incompatible.

**Verify**:

```bash
linux-cleanup --self-test
```

This explicitly probes every required dependency. The first missing one aborts the test with the name and a fix hint.

**Fix**: install the missing utility from your distro's coreutils / findutils / gawk packages. On bare-bones containers (`alpine` etc.), this is the most common issue.

---

## Cron entry runs but does nothing

**Verify**:

```bash
tail -100 ~/.linux-cleanup/logs/cron.log
crontab -l | grep cleanup.sh
```

If the log shows `command not found`, the cron environment doesn't have `linux-cleanup` on its `PATH`. This is the #1 cron issue — cron runs with a minimal `PATH` (`/usr/bin:/bin`), so a `~/.local/bin` install isn't visible.

**Fix**: edit your crontab to use the absolute path:

```bash
crontab -e
# Change:    0 3 * * 0 linux-cleanup --all-safe -y …
# To:        0 3 * * 0 /home/you/.local/bin/linux-cleanup --all-safe -y …
# (or wherever `which linux-cleanup` returns)
```

Or add `PATH=/usr/local/bin:/usr/bin:/bin:/home/you/.local/bin` at the top of the crontab.

---

## "✗ $HOME is not set"

**Cause**: you're running inside a context (some Docker images, some CI runners) that doesn't set `$HOME`.

**Fix**:

```bash
HOME=/root linux-cleanup --scan       # or whatever the correct home is
```

Or `export HOME=...` once at the top of the script context.

---

## Script seems to hang on `--scan` or `--node-modules`

**Cause**: `find` walking thousands of `node_modules/` directories under `$HOME`. On spinning disks this can take 1–3 minutes.

**Verify**:

```bash
tail -f ~/.linux-cleanup/logs/cleanup-*.log
```

If you see new lines every 5–10 seconds, it's working — just slow.

**Fix**: be patient on the first run. Subsequent runs are faster because the kernel page cache holds directory metadata. If the same path hangs >5 minutes consistently, [send a bug report](./how-to/send-a-bug-report.md) — it might be a deep symlink loop or a fuse mount that's not responding.

---

## "Disk usage grew during session"

**Cause**: the `RECOVERED = DISK_AFTER - DISK_BEFORE` calculation is negative because another process wrote significantly during your cleanup session (e.g., a journal rotation, browser update, IDE re-indexing).

**Fix**: not a bug. Re-run `--scan` after a quiet moment to see what's actually been reclaimed.

---

## After `--system`, `apt update` fails

**Cause**: rare — `apt clean` shouldn't break `apt update`. If your distro is mid-`apt` operation, the cleanup may have raced with a lock.

**Verify**:

```bash
sudo apt update 2>&1 | tail -20
```

**Fix**:

```bash
sudo rm -f /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock-frontend
sudo apt update
```

If it persists, [send a bug report](./how-to/send-a-bug-report.md).

---

## VS Code reports missing extension after `--editor-ext`

**Verify**: open VS Code, look for the missing-extension banner. Check `~/.vscode/extensions/` to see if the **current** version directory still exists.

```bash
ls ~/.vscode/extensions/ | grep <extension-name>
```

**Fix**: if only superseded versions were removed (correct behaviour), reload the window: `Ctrl+Shift+P → Developer: Reload Window`. If somehow the *current* version was removed (would indicate a bug in the tool's "highest version" detection), reinstall:

```bash
code --install-extension <publisher>.<name>
```

And [send a bug report](./how-to/send-a-bug-report.md) with the log.

---

## Crash bundle showed up but I didn't see a crash

**Cause**: the script exited non-zero from somewhere unexpected — e.g., a backgrounded `find` was killed by the kernel OOM killer, or a `tee` pipe broke.

**Fix**: open the bundle's `CRASH_MANIFEST.txt` and see the exit code. `137` = OOM-killer; `141` = SIGPIPE; `139` = segfault. Send the bundle if any of these are surprising — they shouldn't normally happen.

---

## "alias cleanup … not found" after `--install-alias`

**Cause**: you didn't reload your shell rc.

**Fix**:

```bash
source ~/.bashrc       # or ~/.zshrc, depending where the alias landed
# or just open a new terminal
```

---

## Reports manager refuses to convert to Markdown

**Cause**: `jq` not installed (see "export requires jq" above) — the reports manager hides MD/HTML options when `jq` is missing.

**Fix**: `sudo apt install jq` and re-open the manager.

---

## I'm seeing a different version than I expected

```bash
which linux-cleanup
linux-cleanup --version
```

If the path is unexpected (e.g., an old global install on top of an `npx`-cached newer version), uninstall and reinstall:

```bash
npm uninstall -g linux-cleanup
npm install -g linux-cleanup@latest
hash -r        # refresh bash's command cache
linux-cleanup --version
```

---

## Still stuck

```bash
linux-cleanup --debug-bundle
linux-cleanup --feedback
```

The bundle has everything the author needs. Email it with a one-paragraph description of what you expected vs. what happened. See [How to send a bug report](./how-to/send-a-bug-report.md).

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) — Reach me at [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com), [LinkedIn](https://linkedin.com/in/aoneahsan), [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
