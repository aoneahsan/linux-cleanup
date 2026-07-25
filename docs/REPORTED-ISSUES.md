# Reported issues — linux-cleanup

Open issues awaiting a fix. Resolved entries move to `RESOLVED-ISSUES.md` with the resolution date and the
fixing version — they are never deleted. Format: `~/.claude/rules/project-issue-reporting.md`.

**Last Updated:** 2026-07-25

---

### ISSUE-001 — `--self-test` always exits 0, so the `npm test` gate can never fail

**Severity:** High — the package's only automated gate is inert, including its safety-guard check.
**Affected:** 1.4.0 (present since at least 1.0.0) · **Reporter:** package-standardisation pass, 2026-07-25

**Symptom** — failures are printed, then the status is 0 anyway:

```
$ bash cleanup.sh --self-test
✗ is_protected '/home/you/.cache/yarn' returned TRUE — would block legitimate cleanup
✗ 2 check(s) failed
$ echo $?
0
```

**Why it matters**

- `package.json` declares `"test": "bash cleanup.sh --self-test"`, so `npm test` reports success
  unconditionally.
- `CONTRIBUTING.md` tells contributors to run it before opening a PR; CI wrapping it sees nothing.
- Section 5 of the self-test is the **safety-guard sanity check**. A regression prints
  `is_protected '<path>' returned FALSE — DANGEROUS` and still exits 0. That is the one check most worth
  failing loudly.

**Root cause** — `self_test()` is correct (`modules/release_helpers.sh:157-162` returns 1 when `fails > 0`).
The value is discarded at `cleanup.sh:337`, which calls it as a bare statement:

```bash
  self_test)     self_test ;;
```

Execution falls through to the end of `cleanup.sh`, whose last command is `lclean_mark_finished`
(`cleanup.sh:379`). That succeeds, so the script exits 0.

**Suggested fix** — capture and propagate, *after* `lclean_mark_finished` so the EXIT-trap crash bundler
stays quiet (`modules/crash_trap.sh:32` returns early when `LCLEAN_FINISHED == 1`):

```bash
self_test)     self_test || EXIT_RC=1 ;;
# ...final lines:
lclean_mark_finished
exit "${EXIT_RC:-0}"
```

Order matters: exiting 1 *before* `lclean_mark_finished` would make every failing self-test write a crash
bundle. Audit the sibling utility modes for the same swallowed-status shape — `--export` and `--doctor` have
`return 1` paths at `modules/release_helpers.sh:325,328,336,345,351`.

**Verify** — `bash cleanup.sh --self-test; echo "exit=$?"` must be non-zero whenever a ✗ prints, and
`~/.linux-cleanup/feedback/` must not gain a bundle.

---

### ISSUE-002 — `--help` claims all output stays in the project folder; untrue for npx and global installs

**Severity:** Low (documentation accuracy) · **Affected:** 1.4.0

`cleanup.sh --help` ends with `OUTPUT  (everything stays inside the project folder)`. For the primary
distribution path the Node launcher sets `LINUX_CLEANUP_LOG_DIR` / `LINUX_CLEANUP_REPORTS_DIR` to
`~/.linux-cleanup/` (`bin/linux-cleanup.js:49-53`) precisely so output survives npx cache eviction — the
opposite of the claim. The printed paths are correct; the parenthetical is not, and it is the part a reader
remembers.

**Fix** — reword to the guarantee that is true, e.g. `OUTPUT  (nothing is written outside these paths)`.

---

### ISSUE-003 — `LINUX_CLEANUP_HOME` is missing from the environment-variables reference

**Severity:** Low (documentation gap) · **Affected:** 1.4.0

`bin/linux-cleanup.js:49` reads `LINUX_CLEANUP_HOME` as the data-directory override, but
`docs/reference/environment-variables.md` documents every *other* variable and omits it —
`grep -rn LINUX_CLEANUP_HOME docs/` returns nothing.

It is read **only by the Node launcher**. A clone run never consults it: the shell reads
`LINUX_CLEANUP_LOG_DIR` / `LINUX_CLEANUP_REPORTS_DIR` (`cleanup.sh:21-22`) plus `LINUX_CLEANUP_DATA_HOME` for
the feedback dir (`modules/release_helpers.sh:173`, `modules/crash_trap.sh:21`).

**Fix** — add the row, with default `~/.linux-cleanup` and the launcher-only caveat.

---

### ISSUE-004 — a crash bundle was written into a garbage directory in the working directory

**Severity:** Medium (observed once, not reproduced) · **Affected:** 1.4.0

**Symptom** — during verification a directory literally named `✓ node_modules_finder.sh` followed by a
newline appeared in the repo root, containing
`Users/…/linux-cleanup/feedback/crash-2026-07-25_202602✓ node_modules_finder.sh.tar.gz`.

The contaminating token is the exact stdout of the self-test's syntax check for that module, and it appears
**three times** in the path — including inside the bundle filename, which `modules/crash_trap.sh:52` builds
from a plain `date` call. So more than `LOG_DIR` was contaminated.

**Not reproduced.** A clean copy running `--self-test` alone did not recreate it. The most likely contributor
is two concurrent `cleanup.sh` invocations in the same directory. **Root cause is undiagnosed** — this entry
records the observation rather than a guess.

**Suggested hardening** — `_lclean_crash_dir` derives its path from `dirname "$LOG_DIR"`
(`modules/crash_trap.sh:20-26`) and `mkdir -p` creates whatever it is handed, so a bad value silently litters
the user's working directory instead of failing. Reject a derived path that is non-absolute or contains a
newline, and fall back to `~/.linux-cleanup/feedback`.
