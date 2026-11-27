# Reported issues — linux-cleanup

Open issues awaiting a fix. Resolved entries move to `RESOLVED-ISSUES.md` with the resolution date and the
fixing version — they are never deleted. Format: `~/.claude/rules/project-issue-reporting.md`.

**Last Updated:** 2026-11-27

---

### ISSUE-009 — The compare hub overstates which runs write a JSON report

**Status:** OPEN · **Reported:** 2026-11-27 from the product PDF series (point-of-view batches 2–11) · **Affects:** `docs/comparison-hub/competitors.json` (the CleanMate comparison line)

**Symptom.** The CleanMate line says linux-cleanup writes a JSON report for every run; 2.1.1 writes one only from the walkthrough.

**Suggested fix.** Reword the line to what 2.1.1 does (or add the report to the other modes and say so in the changelog).

### ISSUE-010 — The README on GitHub and npm still shows the old 1.x logo

**Status:** OPEN · **Reported:** 2026-11-27 from the product PDF series · **Affects:** `README.md` (logo image)

**Symptom.** The README's header image is the 1.x logo, not the current brand kit's mark, on GitHub and on the npm page.

**Suggested fix.** Point the README at the kit's current lockup and publish it with the next patch release.

### ISSUE-011 — The website says Node.js 18 or newer; the package says 14

**Status:** OPEN · **Reported:** 2026-11-27 from the product PDF series · **Affects:** `linux-cleanup-website` `src/locales/*/pages.json:26,264` ("Node.js 18 or newer"), this repo's `package.json:29` (`"node": ">=14"`), README and manual (14+)

**Symptom.** The website tells people they need Node.js 18 or newer; `package.json` engines, the README and the manual say 14+.

**Suggested fix.** Test the real floor (run the CLI on Node 14 and 18), then make `engines`, the README, the manual and the website say the same version.

### ISSUE-012 — The production record says 21 tables have row-level security; the code has 20

**Status:** OPEN · **Reported:** 2026-11-27 from the product PDF series · **Affects:** `projects-finalization-record` `production/linux-cleanup.md` (Supabase row)

**Symptom.** The record says 21 tables have row-level security; the schema in the code defines 20.

**Suggested fix.** Count the tables from the schema (or the live catalog) and correct the record.
