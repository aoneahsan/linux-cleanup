# Scan mode (`--scan` / `-s`)

> Read-only audit. Walks every category linux-cleanup knows about, prints how many bytes each would reclaim, writes a JSON report — and deletes nothing.

**Type**: inspection mode (read-only)
**Run**: `linux-cleanup --scan`
**Touches personal data**: never
**Modifies the filesystem**: no, except for writing a JSON report and a log

---

## What it does

`--scan` is the inventory pass. It runs the same `du` / `find` / `stat` queries that the cleanup modes use — but stops short of any `safe_rm` call. The output is a sized inventory of reclaimable junk on your machine.

```
── Pre-flight scan — read-only inventory ──

Package-manager caches
  yarn cache               12.4 GB     last used 134 days ago
  npm cache                 3.1 GB     last used  18 days ago
  pnpm store                4.8 GB     last used   2 days ago
  pip cache                 480 MB     last used  41 days ago
  composer cache            120 MB     last used 200 days ago

App caches
  Chrome (Default)          1.8 GB     last accessed today
  Brave                       —        not installed
  Firefox cache2            340 MB     last accessed yesterday
  Gradle caches             4.2 GB     last used  72 days ago
  Cypress browsers          980 MB     last used 119 days ago
  Playwright browsers       1.4 GB     last used  60 days ago

Dev-tool data
  Android AVDs              8.6 GB     mixed — see staleness audit
  Flutter pub-cache         3.2 GB     last used 145 days ago
  Dart analysis cache       210 MB     last used  21 days ago

Editor extensions
  VS Code (superseded)      312 MB     4 versions, idle ≥120d
  Cursor (superseded)         —        none idle

System (requires sudo to clean)
  apt cache                 1.2 GB
  Journal logs              780 MB
  Snap revisions (purgeable)  2.4 GB
  Old kernels (Debian)        —        none

──────────────────────────────────────────────────────────────────────────────
Total reclaimable: ~38.4 GB
Of which: regenerable (--all-safe could reclaim now): 23.7 GB
          gated by staleness (≥100d):                  6.8 GB
          would need sudo (--system):                  4.4 GB
          stale node_modules / personal (interactive): 3.5 GB
```

The scan runs in 5–60 seconds depending on disk speed and number of `node_modules` directories under `$HOME`.

---

## When to use it

- **Before your first cleanup.** Always. Know what you're about to lose before you say yes.
- **As a baseline.** Save the JSON report. Re-scan a month later. Diff the two to see how fast caches re-grow.
- **Pre-cron sanity check.** After installing the weekly cron, run a manual `--scan` to confirm what the next cron run will target.
- **Disk full, no time to read prompts.** Scan, eyeball the totals, decide whether to run `--all-safe -y` or hand-pick categories from `--menu`.

---

## What the scan does NOT do

- It does not prune. Nothing is deleted, no files are moved, no permissions are changed.
- It does not call `sudo`. Categories that need root (apt cache size, journal size) are estimated using non-privileged `du` where possible; some sizes may be marked `(needs sudo to measure)`.
- It does not traverse into protected paths. `~/Documents`, `~/.ssh`, etc. are skipped — both for safety and because they're not candidates anyway.
- It does not contact the network. Like every other mode.

---

## Output

`--scan` writes:

| File | Purpose |
|---|---|
| `~/.linux-cleanup/logs/cleanup-<timestamp>.log` | The full session output, identical to what you saw on screen. |
| `~/.linux-cleanup/reports/report-<timestamp>.json` | Canonical JSON report with sizes, paths, ages, and the staleness verdict per entry. |

The JSON schema is documented at [Report schema](../reference/report-schema.md). It is deliberately versioned so future linux-cleanup releases can read older reports.

---

## Using the report

Convert to Markdown for archiving:

```bash
linux-cleanup --export md latest
# → ~/.linux-cleanup/reports/report-<timestamp>.md
```

Convert to a self-contained HTML page (browsable, sortable):

```bash
linux-cleanup --export html latest
# → ~/.linux-cleanup/reports/report-<timestamp>.html
```

Both are off by default — JSON is canonical. The conversion needs `jq`.

Open the interactive reports manager to browse, convert, and view past reports:

```bash
linux-cleanup --reports
```

---

## FAQ

**How long does the scan take?**
On a fast NVMe with 50 GB of caches, ~5 seconds. On a spinning disk with thousands of `node_modules` under `~/code/`, up to a minute. The slowest part is the recursive `find` for stale `node_modules`.

**Can I scan only one category?**
Not directly with `--scan`, but each cleanup mode prints sizes before asking — so `--menu` → option 9 (Top 20 largest entries in `$HOME`) gives you a fast partial inventory.

**Is the scan safe to run as root?**
Yes, but unnecessary. The script is designed to run as your normal user. Running as root only widens the blast radius if a bug ever slipped past the safety guards.

**The scan reports a path I deleted manually.**
Re-run it. The scan caches nothing between invocations; it queries the filesystem fresh each time.

**Can I run scans in CI?**
Yes — it has zero side effects on production data. The most common CI use is to fail the build if reclaimable junk exceeds N GB on a runner image.

```bash
linux-cleanup --scan --no-color > /tmp/scan.log
grep -E 'Total reclaimable: ~([0-9]+) GB' /tmp/scan.log
```

---

## See also

- [Walkthrough](./walkthrough.md) — same inventory + interactive cleanup
- [All-safe](./all-safe.md) — what the scan's "regenerable" line would actually reclaim
- [Reports](./reports.md) — what the JSON file contains
- [Report schema reference](../reference/report-schema.md)
- [How-to: reclaim the most space](../how-to/reclaim-the-most-space.md) — what to do once you've scanned

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
