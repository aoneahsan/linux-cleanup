# Machine-readable events

`--json-events` writes newline-delimited JSON to stdout. Human text and prompts
go to stderr, with a local copy in the session log. The stream stays on this
machine; it can contain full local paths. Consumers should not upload those
paths as part of account or analytics data.

The flag supports `--scan` and `--all-safe --yes`. An all-safe run needs
`--yes` so a machine client cannot pause at a prompt. Add `--dry-run` to preview
the all-safe action without deleting files. A local log and update-check state
may still be written. Other modes return exit code 2.

```bash
linux-cleanup --scan --json-events > scan.ndjson
linux-cleanup --all-safe --yes --dry-run --json-events > preview.ndjson
```

Every complete event has `v: 1`, a `type` and `ts` (Unix milliseconds).
Consumers should reject a higher `v` and ignore unfamiliar fields on version 1.
The mode ID is a string: `scan` or `allsafe`.

| Event | Fields | Meaning |
|---|---|---|
| `plan` | `version`, `dry_run`, `profile`, `sections[]` | First event; one section for the selected mode. A section has `id`, `title`, `stamp`, `sudo`, `deep`. |
| `disk` | `phase`, `total_kb`, `free_kb`, `purgeable_kb`, `snapshots`, `snapshot_note` | Disk sample before and after the mode. Unsupported estimates are `null`. |
| `section_start` | `id`, `title`, `stamp` | The selected mode started. |
| `item` | `id`, `path`, `kb`, `action`, `unique`, `age_days`, `reason` | A read-only scan result or a path selected by a cleanup helper. `report` reads only, `delete` is a proposed action during a dry run and a completed helper action in a real run, `skip` is a refusal. `kb` is truncated to whole KiB. |
| `progress` | `id`, `done`, `total` | The one selected mode is at 0/1 or 1/1. It is a mode boundary, not a per-file percentage. |
| `error` | `id`, `message` | A failure or refusal reported by the CLI. |
| `section_result` | `id`, `status`, `freed_kb`, `items`, `reason` | Status is `completed` or `failed`. Byte and item totals remain `null` until the CLI can distinguish its own writes from other disk activity. |
| `summary` | `attempted`, `completed`, `skipped`, `failed`, `freed_kb`, `disk_free_before_kb`, `disk_free_after_kb`, `elapsed_s`, `reports`, `log`, `dry_run` | Last event after a completed mode. The two free-space samples are observations, not a claim of bytes recovered by this process. |

The stream begins with `plan` and ends with `summary` on a completed run. An
interrupted process or a failed update requirement may leave no summary; treat
that as an incomplete run and use the exit code and stderr. A rejected
argument may emit an `error` event and exit 2 before the plan. Existing text
output and exit codes are unchanged when the flag is absent.

The event stream complements the local JSON session report. A dry run writes
no session report. A consumer can use `item.path` to explain a local decision,
then discard it instead of syncing it to a server.
When `--cleanup-logs` removes the session log, `summary.log` is `null`.
