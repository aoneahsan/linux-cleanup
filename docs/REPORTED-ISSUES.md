# Reported issues — linux-cleanup

Open issues awaiting a fix. Resolved entries move to `RESOLVED-ISSUES.md` with the resolution date and the
fixing version — they are never deleted. Format: `~/.claude/rules/project-issue-reporting.md`.

**Last Updated:** 2026-09-18

---

---

### ISSUE-005 — under npx, `--install-alias` and `--install-cron` point into the evictable npx cache

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
