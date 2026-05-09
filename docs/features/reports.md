# Reports — JSON / Markdown / HTML session records

> Every cleanup run writes a canonical, schema-versioned JSON report. Convert it to readable Markdown or self-contained HTML on demand — for archiving, diffing across runs, or attaching to bug reports. Reports manager (`--reports`) lets you list, view, and convert past reports interactively.

**Type**: feature group (output)
**Modes**: `--reports` (interactive), `--export FMT ID` (non-interactive)
**Touches personal data**: never
**Files**: `~/.linux-cleanup/reports/report-<timestamp>.{json,md,html}`

---

## Why reports

A cleanup tool is only as trustworthy as its audit trail. JSON reports give you:

- A **before / after** record per session
- Exact paths touched, sizes reclaimed, and the staleness verdict on each candidate
- The **schema version** so future linux-cleanup releases can read older reports
- A canonical structure that's machine-readable (`jq`-friendly) and human-readable (Markdown / HTML on export)

Every mode that does work (walkthrough, menu, all-safe, scan, system, partials, node-modules, editor-ext, stale) writes a report. The two read-only modes (`--audit`, `--list-targets`) and meta modes (`--feedback`, `--debug-bundle`, `--self-test`) do not.

---

## Where reports live

| Path | Contents |
|---|---|
| `~/.linux-cleanup/reports/report-<YYYY-MM-DD_HHMMSS>.json` | Canonical machine-readable record |
| `~/.linux-cleanup/reports/report-<YYYY-MM-DD_HHMMSS>.md` | Markdown export (only when you run `--export md`) |
| `~/.linux-cleanup/reports/report-<YYYY-MM-DD_HHMMSS>.html` | Self-contained HTML export (only when you run `--export html`) |

Reports are **never auto-deleted**, even when you pass `--cleanup-logs`. This is intentional: logs are ephemeral debug output, reports are the durable audit trail.

---

## Schema (high-level)

See [Report schema reference](../reference/report-schema.md) for the full JSON-Schema-style definition. The shape (v1.3.0):

```json
{
  "schema": "linux-cleanup/report/v1",
  "tool": {
    "version": "1.3.0",
    "started": "2026-05-10T14:03:12+00:00",
    "finished": "2026-05-10T14:08:55+00:00",
    "mode": "walkthrough",
    "host": "thinkpad-x1",
    "user": "ahsan",
    "via_npx": false
  },
  "session": {
    "disk_before_avail_bytes": 84129843200,
    "disk_after_avail_bytes":  104235692032,
    "recovered_bytes":         20105848832,
    "recovered_human":         "18.7 GB"
  },
  "categories": [
    {
      "name": "package_manager_caches",
      "candidates": [ … ],
      "actions": [ … ],
      "totals": { … }
    }
  ]
}
```

Each `categories[]` entry is self-describing — name, candidate paths, actions taken, totals.

---

## Reading the report — examples

### How much disk did I reclaim last week?

```bash
jq '.session.recovered_human' ~/.linux-cleanup/reports/report-2026-05-03_*.json
# "18.7 GB"
```

### Which paths were the biggest reclaim across all reports?

```bash
jq -r '.categories[].actions[] | select(.deleted) | "\(.bytes)\t\(.path)"' \
  ~/.linux-cleanup/reports/report-*.json |
  sort -rn | head -20
```

### Did anything get *kept* by the staleness gate this run?

```bash
jq -r '.categories[].candidates[] | select(.kept_reason == "staleness_gate") | .path' \
  ~/.linux-cleanup/reports/report-2026-05-10_*.json
```

### Diff bytes-recovered between two runs

```bash
jq '.session.recovered_bytes' \
  ~/.linux-cleanup/reports/report-2026-04-28_*.json \
  ~/.linux-cleanup/reports/report-2026-05-10_*.json
```

---

## Exporting to Markdown / HTML

Non-interactive:

```bash
linux-cleanup --export md latest      # latest report → .md
linux-cleanup --export html latest    # latest report → .html (self-contained, no CDN deps)
linux-cleanup --export both latest    # both
linux-cleanup --export md all         # every report → .md (idempotent; skips up-to-date)
linux-cleanup --export md 3           # the 3rd most-recent report
```

Both `md` and `html` exports are deliberate, opt-in operations — they're not generated automatically because most users only need the JSON, and writing three files per run is wasteful disk churn.

The HTML export is **fully self-contained**: no CDN scripts, no fonts loaded, no analytics, no JavaScript that calls out. It opens in any browser with no network access required.

---

## The reports manager (`--reports`)

For interactive use:

```bash
linux-cleanup --reports
```

Prints a numbered list of every JSON report (newest first), and offers:

```
── Reports manager ──

  [ 1] 2026-05-10 14:03   walkthrough    recovered 18.7 GB
  [ 2] 2026-05-03 03:00   all-safe       recovered  4.2 GB    (cron)
  [ 3] 2026-04-26 03:00   all-safe       recovered  2.9 GB    (cron)
  [ 4] 2026-04-19 03:00   all-safe       recovered  3.1 GB    (cron)
  [ 5] 2026-04-12 19:14   scan           (read-only)

  v) View a report (paged)
  m) Convert one to Markdown
  h) Convert one to HTML
  b) Convert one to both
  M) Convert ALL to Markdown
  H) Convert ALL to HTML
  q) Quit

  →
```

Pick `v`, type the number, scroll. Pick `m`, type the number, the `.md` is written next to the `.json`.

`jq` is required for `m` / `h` / `b` / `M` / `H`. Without it, only `v` and `q` are offered.

---

## FAQ

**The report says I recovered 0 bytes but my disk has clearly more free space.**
Compare `disk_before_avail_bytes` and `disk_after_avail_bytes` in the JSON. If they match what `df` shows, the report is accurate; the missing reclaim is from another process (e.g., a journal rotation that fired during your session).

**Are reports portable across machines?**
The JSON is, yes. Paths in the report are absolute and reflect the source machine's `$HOME`. Don't rely on path patterns when aggregating reports across machines.

**Can I delete old reports?**
Yes — they're just files in `~/.linux-cleanup/reports/`. No tool state references them. `find ~/.linux-cleanup/reports/ -mtime +90 -delete` is a safe purge.

**Does the JSON include personal data?**
Paths in your `~/Downloads` (when you ran `--partials`) or in your project roots (when you ran `--node-modules`) are recorded by path. If you're sending a report to the author, review it first. The [debug-bundle](./feedback-and-crash-bundles.md) workflow has a built-in reminder to do so.

**The schema changes in a future version. Will my old reports still work?**
The `"schema"` field versions the format. The reports manager handles all v1.x reports. A v2.x format change (if it ever happens) will preserve read-only access to v1 reports, with a deprecation note.

---

## See also

- [Report schema reference](../reference/report-schema.md) — full JSON shape
- [Scan](./scan.md) — read-only mode that's especially worth archiving the report from
- [Feedback & crash bundles](./feedback-and-crash-bundles.md) — when reports get attached to bug reports

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
