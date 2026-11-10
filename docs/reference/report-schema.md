# Guided walkthrough JSON record

The guided walkthrough writes `report-<timestamp>.json` unless `--no-report` or `--dry-run` is set. Standalone modes such as `--scan` and `--all-safe` do not write this record. For a machine-readable stream from those modes, see [JSON events](./json-events.md).

The record has `schema_version: 1` and these top-level objects:

| Key | Content |
|---|---|
| `credits` | Tool name, version, homepage, license and author details |
| `meta` | Start and end time, duration, host, user, `mode`, idle threshold, log path, launcher and `via_npx` |
| `disk` | `before` and `after` filesystem samples with `filesystem`, `size`, `used`, `avail` and `use_pct` |
| `memory` | `before` and `after` memory samples with total, used, free and available bytes |
| `steps` | One object per walkthrough step: `n`, `title`, `status`, `freed_bytes` |
| `totals` | `total_reclaimed_bytes`, `total_reclaimed_human`, `steps_run`, `steps_skipped` |

`schema_version` is a number. Consumers should reject unsupported versions. `freed_bytes` is a step result, while the disk `before` and `after` fields are observations of the whole machine. Other processes can affect those samples. The record does not contain a complete per-file list or the content of removed files.

To inspect a real record after a walkthrough:

```bash
linux-cleanup --reports
jq 'keys' ~/.linux-cleanup/reports/report-*.json
```

The exact output directory can be changed with `LINUX_CLEANUP_REPORTS_DIR` or `LINUX_CLEANUP_DATA_HOME`. Keep records local or review them before sharing: metadata and logs may reveal machine names and paths.
