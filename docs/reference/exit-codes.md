# Exit codes

> linux-cleanup follows the standard Unix convention: `0` is success, anything else is a problem. The crash-bundle trap (1.3.0+) treats specific non-zero codes as expected (Ctrl-C, SIGTERM, arg parse) and only triggers on truly unexpected exits.

---

## Codes

| Code | Meaning | Crash bundle? |
|---|---|---|
| `0` | Clean run; all requested actions completed (or were declined). | No |
| `1` | Generic failure — invariant violated. Rare. | Yes |
| `2` | Argument parse error (unknown flag, bad value). Help is printed. | No |
| `127` | Command not found — usually means a required dependency is missing (`bash`, `find`, `du`, `stat`). | Yes |
| `130` | User aborted with `Ctrl-C` (SIGINT). | No |
| `137` | Killed by `SIGKILL` — usually OOM-killer or `kill -9`. | Yes |
| `139` | Segfault. Should never happen in pure bash; treated as crash. | Yes |
| `143` | Killed by `SIGTERM`. | No |
| _other non-zero_ | Unexpected internal failure. | Yes |

---

## How the crash trap decides

The EXIT trap installed in v1.3.0 (`modules/crash_trap.sh`) checks the exit code in this order:

1. If exit code is `0` **or** the script set its `LCLEAN_FINISHED=1` sentinel before exit → no bundle.
2. If exit code is `130` (Ctrl-C) or `143` (SIGTERM) → no bundle.
3. If exit code is `2` (arg parse) → no bundle.
4. Otherwise → write `crash-<timestamp>.tar.gz` to `~/.linux-cleanup/feedback/`.

See [Feedback & crash bundles](../features/feedback-and-crash-bundles.md#automatic-crash-bundle-v130) for the full design.

---

## In scripts

Standard pattern:

```bash
if linux-cleanup --scan; then
  echo "scan succeeded"
else
  case $? in
    2)   echo "bad flag" ;;
    130) echo "user aborted" ;;
    *)   echo "unexpected failure — check ~/.linux-cleanup/feedback/" ;;
  esac
fi
```

For non-interactive batch runs (cron, CI):

```bash
linux-cleanup --all-safe -y --no-report --cleanup-logs >>cleanup.log 2>&1 || \
  echo "linux-cleanup exited $?" | mail -s "cleanup failed on $(hostname)" you@example.com
```

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
