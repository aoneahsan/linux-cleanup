# All-safe mode (`--all-safe` / `-a`)

> One-shot batch cleanup of every regenerable cache linux-cleanup knows about — no per-step prompts. Best paired with `-y` for cron / scripted use.

**Type**: cleanup mode (batch)
**Run**: `linux-cleanup --all-safe -y` (or `-a -y`)
**Touches personal data**: **never** — `--all-safe` is restricted to regenerable caches by design

---

## What it does

Sequences through every "safe / regenerable" category and runs it back-to-back without asking. Categories included:

| Category | What it cleans |
|---|---|
| Package-manager caches | `~/.cache/yarn`, `~/.npm/_cacache`, `~/.local/share/pnpm/store`, `~/.cache/pip`, `~/.composer/cache` |
| App caches | Chrome / Brave / Chromium / Edge / Vivaldi `Cache/`, Firefox `cache2/`, `~/.gradle/caches/`, `~/.cache/Cypress`, `~/.cache/ms-playwright`, `~/.zoom/Cache`, VSCode / Cursor `CachedExtensionVSIXs` |
| Dev-tool data (stale-only) | Stale Android AVDs, stale Flutter pub-cache, stale Dart analysis-server caches, stale flatpak user data |
| Editor extensions (stale, superseded) | Old VS Code / Cursor extension versions when a newer version exists *and* the older one is idle ≥ N days |

Categories that are **not** included:

- Personal files (`-p` / `--stale`)
- Stale `node_modules` (`--node-modules`)
- Partial downloads (`--partials`)
- System cleanup (`--system`) — needs `sudo`
- Anything inside a protected path on the [allowlist](../safety.md)

This is by design. `--all-safe` is the "fire-and-forget" mode; anything personal stays interactive-only.

---

## Typical use

### Manually reclaim space, no prompts

```bash
linux-cleanup --all-safe -y
```

Without `-y` the tool falls back to asking before each category — defeating the point. Pair them.

### Inside a weekly cron job

```bash
linux-cleanup --install-cron
```

Adds a crontab entry for Sunday 03:00 that runs:

```
linux-cleanup --all-safe -y >> ~/.linux-cleanup/logs/cron.log 2>&1
```

See [Shell alias & weekly cron](./shell-alias-and-cron.md) for the full setup and removal procedure.

### Aggressive sweep (lower threshold)

```bash
linux-cleanup --all-safe -y -d 30
```

Treats anything idle ≥ 30 days as fair game (default is 100). Still respects the staleness gate for AVDs, editor extensions, and flatpak data.

### Pre-1.2.0 wipe-everything behaviour

```bash
linux-cleanup --all-safe -y --purge-all
```

Disables the staleness gate. Wipes every regenerable cache *and* every dev-tool data location regardless of last-used time. Use sparingly — it kills rarely-used Gradle wrappers, AVDs you might want next month, etc. See [Safety](../safety.md) for the rationale on why this isn't the default.

---

## What you'll see

```
══════════════════════════════════════════════════════════════════════════════
  linux-cleanup — all-safe batch mode
══════════════════════════════════════════════════════════════════════════════

[1/4] Package-manager caches
  ✓ yarn cache       12.4 GB
  ✓ npm cache         3.1 GB
  · pnpm store         (idle 2 days — kept)
  ✓ pip cache         480 MB

[2/4] App caches
  ✓ Chrome Default       1.8 GB
  ✓ Gradle caches        4.2 GB
  ✓ Cypress browsers     980 MB
  · Playwright           (not installed)

[3/4] Dev-tool data (stale-only, ≥100d)
  · Android AVDs   (none idle ≥100d)
  ✓ pub-cache (stale)   620 MB

[4/4] Editor extensions (stale superseded)
  ✓ VS Code: 4 superseded versions   312 MB
  · Cursor   (no superseded versions)

── Session summary ──
✓ Recovered: 23.9 GB
ℹ Disk: 142 GB free of 500 GB on /
ℹ Log:    ~/.linux-cleanup/logs/cleanup-2026-05-10_140312.log
ℹ Report: ~/.linux-cleanup/reports/report-2026-05-10_140312.json
```

`✓` = action ran. `·` = nothing to do (idle, missing, or out of scope).

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Completed; logs and report written |
| 2 | Argument parse error (e.g., unknown flag) |
| 130 | Aborted with `Ctrl-C` (still leaves a partial log) |
| ≠ 0,2,130,143 | Unexpected failure — a [crash bundle](./feedback-and-crash-bundles.md) is auto-generated |

See [exit codes reference](../reference/exit-codes.md) for the full table.

---

## FAQ

**Why doesn't `--all-safe` include `--system`?**
`--system` requires `sudo` and prompts for it. Combining the two would mean an unattended cron job hangs on a sudo prompt, or worse, runs as root. They're kept separate so the safe path is the default. Cron-friendly system cleanup needs a passwordless-sudo setup you arrange yourself.

**Why doesn't it clean `node_modules`?**
Stale `node_modules` deletion is interactive-only by policy — there are too many edge cases (active project, vendored deps, lockfile-only state) for a non-interactive sweep to be safe. Use `--node-modules` separately.

**Can I see what `--all-safe` would do without running it?**
Yes — `linux-cleanup --scan` runs the same inventory in read-only mode and writes a JSON report listing every candidate path with its size.

**Does it lock files?**
No. Cache deletion is `rm -rf`-style on directories the tool knows are safe to remove. If a process has an open fd on a file inside one of those caches, Linux's normal semantics apply (the file is unlinked but the fd stays valid until close), and the cache will be regenerated on next use.

**My `yarn install` after `--all-safe` is slow.**
Expected — a fresh yarn cache rebuild downloads everything again. That's the trade. If you re-install the same dependencies daily, run `--all-safe` weekly, not daily.

---

## See also

- [Walkthrough](./walkthrough.md) — same categories with prompts, in fixed order
- [Scan](./scan.md) — read-only equivalent, prints what *would* be cleaned
- [Shell alias & weekly cron](./shell-alias-and-cron.md) — automate `--all-safe -y` weekly
- [Safety](../safety.md) — why `--all-safe` is restricted to regenerable caches
- [System cleanup](./system-cleanup.md) — the sudo-gated step that's deliberately *not* in `--all-safe`

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
