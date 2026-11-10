# linux-cleanup — project guide

**Last Updated:** 2026-11-10

**Status:** production (reopened by the owner 2026-11-10, rebuilt as 2.0.0). Category: desktop app + CLI —
this repo is the CLI; the desktop app, website and docs follow. Plan and open work: `../PENDING-TASKS.md`.

| Context | Value |
|---|---|
| Package | Public `aoneahsan/linux-cleanup` on `main`; source version 2.1.0 |
| Docs site | Public `../linux-cleanup-docs/` on its own `main` |
| Container | Private `../` on `aoneahsan/linux-cleanup-website` `project-root` |
| Fleet record | `../../../docs/tracking/fleet-maintenance-tracker.json` |
| Context coverage | `../../../docs/tracking/project-context-budget-tracker.json` |

This is a Bash disk/cache cleanup utility with a thin Node launcher and
no runtime dependencies. Normal cleanup modes permanently delete files.
For this fleet pass, run only the inspected self-test, Bash syntax check,
version check and isolated package/build checks. Never test a real
deletion against the workspace, home directory or system. The self-test
checks protected paths without deleting them; redirect its logs/reports
to a temporary directory.

## Route by task

| Need | Read |
|---|---|
| Command dispatch and modes | `cleanup.sh`, then the named file in `modules/` |
| Protected paths and pruning | `lib/` scoped guide and exact guard implementation |
| Node launcher and npm package | `bin/` scoped guide, `package.json`, `VERSION` |
| User documentation | `docs/` scoped guide; public docs site is an independent repository |
| Known doc contradictions | `../linux-cleanup-docs/docs/MANUAL-TASKS.md` findings A–F |
| Release history | `CHANGELOG.md`, package registry and the current tag; verify before publishing |
| Dry run | `lib/dryrun.sh` — every delete/change goes through `lclean_do`/`safe_rm` |
| Update flow | `modules/update_check.sh` reads `release/<channel>.env` at start |

The public docs site was last fact-checked against 1.4.0 and is owed a
2.0 rewrite (`../PENDING-TASKS.md`). Do not copy its old npm version claim
into this package. Technical documentation must state deletion and
non-reversibility plainly. Keep package and docs histories independent.

## Local verification and release

Use Yarn for local work. `yarn test` runs the built-in self-test;
`bash -n cleanup.sh lib/*.sh modules/*.sh` checks shell syntax;
`yarn run version:check` proves package.json, VERSION, lib/common.sh and release/stable.env agree. Inspect changes
against the safety guards before any npm or GitHub release. The package
has no app browser surface; the separate docs site has a build and
controlled-browser deployment gate. No cleanup command, npm publish
or public claim is implied by a passing self-test.

Fetch/merge `o/main` before editing and immediately before a direct
commit/push. The private container ignores this public repository.
Never merge `project-root` into `main` or force-push.

## Dry run and the release record

Any new command that deletes or changes something must go through
`lclean_do "<what>" cmd…` or `safe_rm`, never a bare `rm`/`sudo`; a
settings-only mode starts with `dry_run_refuse`. Self-test check 8 proves
the dry run on a probe file. On every publish, update `release/stable.env`
(version, `urgency=normal|urgent`, one-sentence reason) in the same commit;
an urgent record stops every older copy at start. Test the flow with
`LINUX_CLEANUP_RELEASE_URL=file://…` and `LINUX_CLEANUP_CHANNEL=test`.

## ORCID / BibTeX record

The owner has an ORCID work entry for this package. Its BibTeX file is
`/home/ahsan/Documents/ahsan-notebook/static/assets/personal/orcid-project-projects-files/linux-cleanup.bib`.
For an explicit ORCID update, verify live URLs and the portfolio record,
then update that entry and the combined bibliography with the relevant
ORCID/BibTeX skills. Never invent a DOI or release year; import and work
type changes remain owner actions in the notebook manual-task record.

## Stop-work Git gate

<!-- RULE:stop-work-git-gate v2026-10-20 -->

Before stopping, commit every legitimate change and work-progress checkpoint in this repository and each independent nested repository, fetch and merge the designated upstream, push the documented working branch, then verify an empty worktree and `0 0` ahead/behind. Never stash, discard, reset, rebase, or force-push. If synchronization is blocked, report the exact repository, branch, blocker, and next action instead of calling the work complete. The full workflow remains authoritative in `~/.claude/rules/git-workflow.md`.
