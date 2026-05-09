# Environment variables

> Every environment variable linux-cleanup reads, with effect and default.

| Variable | Default | Effect |
|---|---|---|
| `NO_COLOR` | _unset_ | When set to **any** non-empty value, disables ANSI colour. De-facto cross-tool standard ([no-color.org](https://no-color.org)). Equivalent to passing `--no-color`. |
| `CLEANUP_NO_COLOR` | `0` | linux-cleanup-specific. Set to `1` to disable colour. Useful when you want colour everywhere except this tool. |
| `LINUX_CLEANUP_LOG_DIR` | `~/.linux-cleanup/logs/` (npx / npm-global) or `<repo>/logs/` (git clone) | Where session logs go. Created if missing. |
| `LINUX_CLEANUP_REPORTS_DIR` | `~/.linux-cleanup/reports/` (npx / npm-global) or `<repo>/reports/` (git clone) | Where JSON reports go. Created if missing. |
| `LINUX_CLEANUP_DATA_HOME` | unset (falls back to `dirname $LINUX_CLEANUP_LOG_DIR`) | Parent directory for `logs/`, `reports/`, and `feedback/` subdirectories. Lets you point everything at e.g. an encrypted volume. |
| `LINUX_CLEANUP_NPX` | unset | Set to `1` by the Node launcher (`bin/linux-cleanup.js`) when invoked via `npx` or `npm install -g`. Triggers a one-line note in the log header. Don't set this manually — it's an internal marker. |
| `XDG_CONFIG_HOME` | `~/.config` | Where personal-roots config files live (`personal-roots.txt`, `project-roots.txt`). Honours the [XDG Base Directory spec](https://specifications.freedesktop.org/basedir-spec/). |

---

## Common patterns

### Move all output to an encrypted volume

```bash
export LINUX_CLEANUP_DATA_HOME="/mnt/secure/linux-cleanup"
linux-cleanup --scan
```

The script will write `logs/`, `reports/`, and `feedback/` under that path. **Verify the volume is mounted and writeable before running** — the script will create the dirs but not the underlying mount point.

### Disable colour everywhere

```bash
export NO_COLOR=1
linux-cleanup
```

Or once: `linux-cleanup --no-color`.

### CI / log-friendly output

```bash
NO_COLOR=1 linux-cleanup --scan --no-report > /tmp/scan.log
```

`--no-report` skips JSON generation; the log holds everything you need for grep-based reporting.

---

## What linux-cleanup does NOT read

- Does not read `PATH` for anything beyond detecting installed tools.
- Does not read `HOME` indirectly — only via `$HOME`. If `$HOME` is unset, the script aborts with `✗ $HOME is not set`.
- Does not read `USER`, `LOGNAME` for anything except header annotation.
- Does not read shell history, config, or alias state.

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
