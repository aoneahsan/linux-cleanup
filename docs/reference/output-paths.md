# Output paths

> Where logs, reports, feedback bundles, and crash bundles are written. Same layout regardless of how you installed the tool.

The default data root is **`~/.linux-cleanup/`** when running via `npx` or a global `npm install`. When running from a git clone, the data root is the repo's own folder. Either can be overridden with `LINUX_CLEANUP_DATA_HOME`.

---

## Layout

```
$DATA_HOME/
├── logs/
│   ├── cleanup-<YYYY-MM-DD_HHMMSS>.log    ← one per session
│   └── cron.log                            ← appended by the weekly cron
├── reports/
│   ├── report-<YYYY-MM-DD_HHMMSS>.json    ← canonical per-session report
│   ├── report-<YYYY-MM-DD_HHMMSS>.md      ← created by --export md
│   └── report-<YYYY-MM-DD_HHMMSS>.html    ← created by --export html
└── feedback/
    ├── debug-bundle-<YYYY-MM-DD_HHMMSS>.tar.gz   ← created by --debug-bundle
    └── crash-<YYYY-MM-DD_HHMMSS>.tar.gz          ← created automatically on crash
```

---

## Per-install defaults

| Install path | `$DATA_HOME` |
|---|---|
| `npx linux-cleanup` | `~/.linux-cleanup/` |
| `npm install -g linux-cleanup` | `~/.linux-cleanup/` |
| `git clone … && ./cleanup.sh` | `<repo>/` (so `<repo>/logs/`, `<repo>/reports/`, `<repo>/feedback/`) |

The per-install difference exists because `npx` runs the package from a temporary npm cache directory that gets evicted; persisting outputs in `~/.linux-cleanup/` keeps them across re-runs. A git clone is already a permanent location, so the script keeps outputs alongside the source for clarity.

---

## Retention

| Path | Auto-cleaned? | Notes |
|---|---|---|
| `logs/cleanup-*.log` | Optional | `--cleanup-logs` flag deletes the current run's log at finish. Past logs are kept. |
| `logs/cron.log` | No | Never auto-rotated. Rotate manually if it grows large: `mv ~/.linux-cleanup/logs/cron.log ~/.linux-cleanup/logs/cron.log.old && touch ~/.linux-cleanup/logs/cron.log`. |
| `reports/*.json` | **Never** | Reports are the durable audit trail. Delete manually if you want to. |
| `reports/*.md` `*.html` | **Never** | Same — created on demand, deleted on demand. |
| `feedback/*.tar.gz` | **Never** | You decide when these are no longer needed. |

`--cleanup-logs` is the only auto-deletion the tool performs, and it only affects `.log` files (never reports, never feedback bundles).

---

## Disk-space note

A single session log is typically 50–500 KB. A JSON report is typically 5–50 KB. A feedback bundle is typically 50–200 KB. Even a year of weekly cron runs is a few MB total — the tool is intentionally cheap on its own output.

If you've accumulated many years of reports and want to thin them out:

```bash
# Keep the last 90 days only
find ~/.linux-cleanup/logs/ -name 'cleanup-*.log' -mtime +90 -delete
find ~/.linux-cleanup/reports/ -name 'report-*' -mtime +90 -delete
```

---

## Permissions

All files are written `0644` (logs / reports) or `0640` (feedback bundles), owned by the invoking user. The directories are `0755` / `0750` respectively.

The tool does **not** chown / chmod anything outside `$DATA_HOME`.

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
