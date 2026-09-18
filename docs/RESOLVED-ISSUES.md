# Resolved issues — linux-cleanup

Fixed entries moved from `REPORTED-ISSUES.md`, original bodies intact, each with its resolution date and fixing version.

**Last Updated:** 2026-09-18

---

### ISSUE-001 — `--self-test` always exits 0, so the `npm test` gate can never fail

**Resolved:** 2026-09-18 · fixed in 1.5.0 — `self_test`, `export_reports` and `run_doctor` feed `EXIT_RC`, applied by `exit "$EXIT_RC"` after `lclean_mark_finished` (`cleanup.sh`). Verified: healthy run exits 0; an unwritable reports dir exits 1 with no crash bundle written; 1.4.0 on the same plant exits 0.

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

**Resolved:** 2026-09-18 · fixed in 1.5.0 — `--help` now reads `OUTPUT (where this tool writes)` and lists logs, reports, crash/debug bundles, the cron log, and rc files (only via `--install-alias` / `--doctor`, after confirmation). "Nothing is written outside these paths" was also rejected as untrue for those two modes.

**Severity:** Low (documentation accuracy) · **Affected:** 1.4.0

`cleanup.sh --help` ends with `OUTPUT  (everything stays inside the project folder)`. For the primary
distribution path the Node launcher sets `LINUX_CLEANUP_LOG_DIR` / `LINUX_CLEANUP_REPORTS_DIR` to
`~/.linux-cleanup/` (`bin/linux-cleanup.js:49-53`) precisely so output survives npx cache eviction — the
opposite of the claim. The printed paths are correct; the parenthetical is not, and it is the part a reader
remembers.

**Fix** — reword to the guarantee that is true, e.g. `OUTPUT  (nothing is written outside these paths)`.

---

### ISSUE-003 — `LINUX_CLEANUP_HOME` is missing from the environment-variables reference

**Resolved:** 2026-09-18 · fixed in 1.5.0 — row added to `docs/reference/environment-variables.md` with the `~/.linux-cleanup` default and the launcher-only caveat.

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

**Resolved:** 2026-09-18 · hardened in 1.5.0; **root cause not reproduced** — `_lclean_crash_dir` (`modules/crash_trap.sh`) now rejects a parent that is not absolute or that contains a control character (newline included) and falls back to `~/.linux-cleanup/feedback`; `_feedback_dir` reuses the same rule. Verified with a newline-bearing `LINUX_CLEANUP_DATA_HOME` and a relative `LOG_DIR`. Reopen with a reproduction if a garbage directory appears again.

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

---

### ISSUE-005 — under npx, `--install-alias` and `--install-cron` point into the evictable npx cache

**Resolved:** 2026-09-18 · fixed in 1.6.0 — not the stable `npx …` command first suggested below: cron has no `npx` on its PATH under nvm and would need the network at 03:00. Instead, when started by the Node launcher, `_self_target` (`modules/self_install.sh`) copies the tool to `~/.linux-cleanup/app/` and the alias and cron line point there; `cleanup.sh` keeps that copy's logs beside it. Entries are matched by marker or legacy shape (`SELF_ALIAS_RE`, `SELF_CRON_RE`). Verified in a scratch `$HOME` with a fake crontab: legacy npx-path entries were found and repointed; after deleting the fake npx cache the alias target still ran `--version`; a second install was a no-op; `--uninstall-*` run from a different copy removed both by marker and then the `app/` directory.

**Severity:** Medium — the alias and the weekly cron break silently once the npx cache is pruned.
**Affected:** 1.5.0 and earlier · **Found while working on:** the 1.5.0 dev-cache safety release (2026-09-18),
while checking the `--help` OUTPUT section for ISSUE-002.

**Symptom** — both write `$CLEANUP_ROOT/cleanup.sh` (`cleanup.sh:298` alias, `cleanup.sh:315` cron line). Under
`npx`, `CLEANUP_ROOT` is `~/.npm/_npx/<hash>/node_modules/linux-cleanup`. That directory disappears when npm
evicts it — and this tool's own all-safe run prunes `~/.npm/_npx` entries idle ≥ N days — leaving an alias
and a cron entry that call a file that no longer exists. `--uninstall-*` and the walkthrough's "already
installed" checks (`modules/release_helpers.sh:286,290,304,309`, `modules/walkthrough.sh:296-297`) match on the same
path, so after the cache hash changes they cannot find the old entry either.

**What to do** — when `LINUX_CLEANUP_NPX=1`, write a stable command instead of the cache path
(`npx --yes linux-cleanup@latest …`, or the resolved global `linux-cleanup` binary when installed with
`npm i -g`), and match existing entries by a fixed marker comment rather than by path.

**Why not fixed in 1.5.0** — it changes how the tool installs itself for every npx user and needs its own
design and test pass; 1.5.0 was scoped to cleanup safety. 1.5.0 did fix the cron *log* path, which now
honours `LOG_DIR` (`~/.linux-cleanup/logs` under npx).

---

### ISSUE-006 — `--node-modules` searches only the author's own folders; the documented `project-roots.txt` is never read

**Resolved:** 2026-09-18 · fixed in 1.6.0 — new `lib/roots.sh` (`load_roots`, `prompt_add_root`); `NM_SEARCH_ROOTS` is filled at run time from `project-roots.txt` plus the default code folders that exist, and `safe_rm_node_modules` and `--list-targets` read the same array. `--stale` reads `personal-roots.txt`. Verified in a scratch `$HOME`: no config and no default folder → no roots; a `node_modules` outside the roots → `REFUSE`; after adding `~/mycode` (tilde form) the same delete succeeded while `/` and the home directory in the file were ignored with a warning; `XDG_CONFIG_HOME` honoured.

**Severity:** High — for every user but the author the mode finds nothing, and six docs describe a control that does not exist.
**Affected:** 1.0.0 – 1.5.2 · **Found while working on:** the 1.6.0 speed-check release (2026-09-18), while checking which folders the finder actually covers.

**Symptom** — `NM_SEARCH_ROOTS` was three literals, `$HOME/Documents/01-code/{projects,02-apps,}` (`modules/node_modules_finder.sh:6-10` in 1.5.2), repeated in `list_targets` (`modules/release_helpers.sh:65`). On any other machine: `No project roots found`. Meanwhile `README.md`, `docs/features/node-modules-finder.md`, `personal-stale-files.md`, `globals-audit.md`, `how-to/uninstall.md` and `reference/environment-variables.md` documented `~/.config/linux-cleanup/project-roots.txt` and `personal-roots.txt`, a first-run prompt and default roots of `~/code`, `~/projects`. `grep -rn "project-roots\|personal-roots" --include="*.sh" .` returned nothing.

**What was done** — see Resolved. Two doc claims were wrong rather than unimplemented and were corrected instead: the globals audit never scanned project roots, and `--stale` never searched `~/tmp`, `~/scratch`, `~/temp`.

---

### ISSUE-007 — on a `noatime` filesystem, idle-based pruning deletes caches that are in use

**Resolved:** 2026-09-18 · fixed in 1.6.0 — `atime_reliable` (`lib/prune.sh`) reads the mount options with `findmnt -T`, falling back to `/proc/self/mountinfo`; `prune_stale`, `prune_stale_units`, `prune_matching_files`, `prune_gradle_home`, `prune_ide_caches`, the AVD and Flatpak gates, superseded editor extensions and the `/tmp` sweep skip with a warning when it returns 1. Verified on two tmpfs mounts, each holding a unit read a moment earlier and a unit left alone, all files dated 60 days back: **1.5.2's code on the `noatime` mount removed both units, the in-use one included**; 1.6.0 on the same mount removed neither (`rc=1`); 1.6.0 on the `relatime` mount removed the idle unit and kept the in-use one. The mountinfo fallback gave the same answers with `findmnt` hidden.

**Severity:** Critical (data safety) — silently deletes whole in-use units: Gradle distributions (1–2 GB each to re-download), npx trees, IDE caches, AVDs.
**Affected:** every release that has an idle gate, 1.2.0 – 1.5.2 · **Found while working on:** the 1.6.0 speed-check release (2026-09-18), while checking this machine's mount options for the speed report.

**Symptom** — `newest_access_age_days` takes the freshest of `atime` and `mtime`. `noatime` is common SSD advice; with it the kernel never moves `atime`, so a distribution launched this morning reports the age of its download. At `-d 30` it is removed whole, and the whole-unit rule of 1.5.x makes that more thorough, not less. Nothing in the output hinted at it.

**Why it was not caught earlier** — the author's machines mount `relatime`, where reads move `atime` at most once a day and the gate works.
