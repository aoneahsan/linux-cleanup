# All-safe batch cleanup

`linux-cleanup --all-safe` works through regenerable cache targets as one batch. It asks once before the batch; `--yes` skips that confirmation for this mode only. Deletion is permanent.

```bash
linux-cleanup --scan
linux-cleanup --all-safe --dry-run
linux-cleanup --all-safe --yes
```

The scan shows target roots and current sizes. The dry run shows proposed actions without changing cleanup targets or settings, although it may write a local log and update-check state. Review both before a real run.

## What this batch covers

The source target lists include package-manager and browser caches, whole extracted package-cache units, selected Gradle and IDE leftovers, and a Docker cache pass when its daemon is already running. The exact available paths depend on the machine. By default, file-level cache pruning requires both access and modification times older than `--days` (100 days). Some whole units use their own idle checks.

`--purge-all` disables the staleness gate and can remove recently used cache material. It is a deliberate, more destructive choice. The protected-path guard still applies.

The batch does not select personal files, partial downloads, `node_modules` or Android emulator profiles. Those have separate modes and prompts.

## Records and automation

A standalone all-safe run keeps a local log. It does not write the guided walkthrough's JSON session report. `--cleanup-logs` removes that run's log at the end. For a local machine client, `--all-safe --yes --json-events` emits versioned NDJSON; see [Machine-readable events](../reference/json-events.md).

`--install-cron` creates a weekly `--all-safe --yes` entry for Sunday at 03:00. Review the dry run and the [cron setup](./shell-alias-and-cron.md) before enabling unattended cleanup.

## Next

- [Scan](./scan.md)
- [Safety](../safety.md)
- [Quick start](../quick-start.md)
