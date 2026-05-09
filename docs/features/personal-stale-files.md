# Stale personal files (`-p` / `--stale`)

> An interactive scanner that finds personal files you haven't touched in N+ days. **Never batched, never `--yes`-able** — every candidate is presented one-at-a-time for your explicit confirmation.

**Type**: cleanup mode (interactive, personal)
**Run**: `linux-cleanup -p` (or `--stale`), optionally with `-d N`
**Touches personal data**: yes, by definition — but only with explicit per-item confirmation
**Cannot be automated**: by policy

---

## What it does

`-p` walks `$HOME` looking for **regular files** under common "scratch" directories (`~/Downloads`, `~/Desktop`, `~/tmp`, `~/scratch`, custom roots you've configured) where:

- `atime` is older than `--days N` days, AND
- `mtime` is older than `--days N` days, AND
- The path is not on the [protected allowlist](../safety.md) (Documents, Pictures, .ssh, .config, etc.)

Default `--days` is 100. Each candidate is presented to you with size and idle days. You choose `y`, `n`, or `a` (skip-all-remaining).

```
── Stale personal files (≥100d) ──

  [1/47]  ~/Downloads/old-laptop-backup.zip
          1.4 GB    idle 320 days

          Delete? [y/N/a]  →
```

---

## Where it looks

By default:

```
$HOME/Downloads
$HOME/Desktop
$HOME/tmp
$HOME/scratch
$HOME/temp
```

Plus, on first run, it prompts for any extra directories you want to include. Your answer is stored in `~/.config/linux-cleanup/personal-roots.txt` for future runs.

It does **not** look inside:

```
$HOME/Documents      $HOME/Pictures      $HOME/Music
$HOME/Videos         $HOME/.ssh          $HOME/.gnupg
$HOME/.config        $HOME/.claude       $HOME/.password-store
```

…or anywhere else on the protected allowlist. These are off-limits even if you point `-p` at them — the safety guard intercepts.

---

## What gets shown

For each candidate file, the prompt includes:

- **Path** (relative to `$HOME` for readability)
- **Size** (human-readable)
- **Idle days** (whichever of `atime` / `mtime` is *more recent*)
- **A 1-line preview** for plain-text files (`head -1`); skipped for binaries

You answer one of:

| Key | Meaning |
|---|---|
| `y` | Delete this file. Move to next. |
| `n` (or Enter) | Keep this file. Move to next. |
| `a` | Abort — keep all remaining files, don't ask again this session |
| `q` | Quit the scan immediately |

There is **no `Y` to delete the rest**. The interactive-only guard is hard.

---

## Why no batch mode

Personal files have no signal that distinguishes "junk I forgot" from "thing I haven't used yet but will need". A staleness threshold is necessary but not sufficient. The user is the only oracle, and the tool refuses to guess on their behalf.

This is the same reason `--all-safe -y` skips this category entirely.

---

## Customising

| Flag | Effect |
|---|---|
| `-d N` / `--days N` | Idle threshold (default 100). Files modified or accessed within N days are filtered out before the prompt loop. |
| `--no-color` | Plain output. |

To **add** a root directory permanently:

```bash
echo "$HOME/code/scratch" >> ~/.config/linux-cleanup/personal-roots.txt
```

To **remove** a root, edit that file directly.

---

## Common workflows

### Quarterly cleanup of `~/Downloads`

```bash
linux-cleanup -p -d 90
```

Walks `~/Downloads` for files unused 90+ days. Most users will be surprised by the 5–20 GB of installer images, sample data, and forgotten attachments hiding there.

### Lower threshold for tighter sweep

```bash
linux-cleanup -p -d 30
```

Idle ≥ 30 days. Pairs well with `~/tmp` directories that you actually use as scratch space.

### Audit-only — see candidates without acting

Press `n` for every prompt. The session log captures the full candidate list with sizes, so you can review later without committing.

---

## What it will NOT delete

- Anything inside `~/Documents`, `~/Pictures`, `~/Music`, `~/Videos`, `~/Desktop`, `~/Public`, `~/.ssh`, `~/.gnupg`, `~/.config`, `~/.claude`, `~/.password-store`, `~/.aws` — [allowlist guard](../safety.md).
- Directories — only regular files. To clean directories, see [Stale `node_modules`](./node-modules-finder.md) for project trees, or use the [Home audit](./home-audit.md) to identify big folders manually.
- Symlinks — followed for size measurement, not deleted.
- Files with `atime` or `mtime` within `--days N`.
- Anything you press `n` (or Enter) on.

---

## FAQ

**Why does it filter on both `atime` and `mtime`?**
Some filesystems mount with `noatime` and `atime` is unreliable. Some files are accessed without modification (e.g., a PDF you opened to read). Using *both* — a file is "stale" only when neither has been touched in N+ days — gives a more accurate "I haven't actually used this" signal.

**My filesystem is `relatime`. Does that affect things?**
`relatime` updates `atime` only when `atime < mtime` or once per day. It's the default on most Linux distros and is fine for this use case. The only filesystem flag that breaks the heuristic is `noatime`, in which case the tool falls back to `mtime`-only with a warning.

**It's slow on my `~/Downloads` with 50 K files.**
`find -newer` is what's slow. Try a tighter threshold (`-d 365` for an annual sweep first), then re-run with `-d 90` after the first pass clears the bulk.

**Can I see what's going to be asked about before the prompts start?**
Yes — pipe a dry-run by answering `n` to everything. The log records each candidate. Or use `find` directly:

```bash
find ~/Downloads -type f -atime +100 -mtime +100 -printf '%s\t%p\n' | sort -rn | head -50
```

---

## See also

- [Partial / orphan downloads](./partial-downloads.md) — interactive cleanup of `.crdownload` / `.fdmdownload` / `.part`
- [Home audit](./home-audit.md) — top 20 largest entries (directories included)
- [Safety](../safety.md) — why personal-data deletes are interactive only
- [Reports](./reports.md) — every kept / deleted decision is recorded

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
