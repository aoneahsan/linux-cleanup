# Quick start

linux-cleanup permanently removes selected files. Start with a scan and a dry run so you can see the paths and commands before allowing deletion.

## Check the install

```bash
npx linux-cleanup --version
npx linux-cleanup --self-test
```

The self-test checks required commands, Bash syntax and safety guards. It uses a disposable probe for its dry-run assertion.

## Inspect this machine

```bash
npx linux-cleanup --scan
```

The scan lists target roots and their current sizes. A root's size is not an estimate of what cleanup will reclaim. The scan writes a local log, but not the walkthrough's JSON session report. The release check may read a public record when online.

## Preview a cleanup

```bash
npx linux-cleanup --all-safe --dry-run
```

This walks the batch cleanup and labels proposed actions `[dry-run]`. Cleanup targets and settings stay in place; a local log and update-check state may still be written. If you need structured output, add `--yes --json-events` and read the [event reference](./reference/json-events.md) before consuming it.

## Run when ready

```bash
npx linux-cleanup
```

No mode flag opens the guided walkthrough. Read each category, answer its prompts, and skip anything you do not recognize. Personal-file and project dependency modes require separate review. There is no undo or Trash step.

The walkthrough writes a JSON step record unless you pass `--no-report` or `--dry-run`. It does not list every removed file. Use `--reports` to browse existing walkthrough records, and `--export both latest` to create Markdown and HTML copies when `jq` is installed.

For a non-interactive cache run after reviewing its dry run, use `linux-cleanup --all-safe --yes`. The `--yes` flag does not authorize the personal-file modes.

## Next

- [Safety and protected paths](./safety.md)
- [Scan](./features/scan.md)
- [All-safe](./features/all-safe.md)
- [Troubleshooting](./troubleshooting.md)
