# Scan mode

`linux-cleanup --scan` lists cache roots, partial downloads, likely duplicate downloads and other candidates without deleting files. It also reports sizes and a few system observations. It does not ask for `sudo` or run package-manager cleanup.

```bash
linux-cleanup --scan
```

A listed root's size includes all its current contents. It is not the amount a cleanup would reclaim: the selected mode, idle threshold, current use and protected-path guard determine the result. To see proposed cache actions, run:

```bash
linux-cleanup --all-safe --dry-run
```

The scan can write a local log and the release check can read its public record when online. It does not create the walkthrough's JSON session report. A dry run keeps cleanup targets and settings in place but may write a log and update-check state.

## JSON events for local tools

```bash
linux-cleanup --scan --json-events > scan.ndjson
```

Version 1 NDJSON goes to stdout, and human output goes to stderr. Events can contain full local paths. Keep them local and use the exit code and final summary to identify a complete run. See [Machine-readable events](../reference/json-events.md).

## Next

- [Quick start](../quick-start.md)
- [Safety](../safety.md)
