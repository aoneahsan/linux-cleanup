# How to reclaim the most space

> A practical sequence for the case "my disk is at 95%, get me back as much as you can without breaking anything." Follows the safety model — no force flags, no skipping prompts.

**Estimated reclaim on a typical developer machine**: 30–80 GB.
**Time**: 15–30 minutes including running the actual deletes.

---

## Step 1 — Audit (1 minute)

Always start here. Know what's on your disk before you delete anything.

```bash
linux-cleanup --scan
linux-cleanup --audit
```

`--scan` walks every category linux-cleanup knows about and shows reclaim estimates.
`--audit` shows the top-20 largest entries directly in `$HOME` — useful for spotting categories the tool doesn't know about (e.g., a personal `~/datasets/` directory).

The biggest single line in `--scan`'s output usually drives the rest of the plan.

---

## Step 2 — Wipe regenerable caches (3–5 minutes)

```bash
linux-cleanup --all-safe -y
```

This is the safe "delete everything that will rebuild itself" sweep. On a typical dev box, this alone reclaims **10–30 GB**. Includes:

- Package-manager caches (yarn / npm / pnpm / pip / composer)
- App caches (Chrome / Brave / Firefox / Gradle / Cypress / Playwright / Zoom)
- Stale Android AVDs, Flutter pub-cache, Dart analysis caches
- Superseded VS Code / Cursor extension versions

Nothing personal is touched. See [All-safe](../features/all-safe.md) for the full category list.

---

## Step 3 — Stale `node_modules` in old projects (5–10 minutes)

```bash
linux-cleanup --node-modules -d 90
```

Walks your configured project roots looking for `node_modules/` in projects you haven't touched in 90+ days. Each is presented with size + idle days; you say `y` or `n` per project.

**Typical reclaim: 5–50 GB.** Old side projects accumulate massive `node_modules/` and they're trivially regenerable: `cd <project> && yarn install` brings them back.

---

## Step 4 — System cleanup (5 minutes; requires sudo)

```bash
linux-cleanup --system
```

Cleans `apt` cache, `journalctl` logs, snap revisions, old kernels, `/tmp` entries, kernel page cache. Each step prompts and shows the exact `sudo` command before running.

**Typical reclaim on a 6-month-old Ubuntu install: 5–15 GB.** First-ever run on a long-lived box: 10–30 GB.

See [System cleanup](../features/system-cleanup.md) for the per-step breakdown.

---

## Step 5 — Stale personal files (5 minutes; interactive)

```bash
linux-cleanup -p -d 90
```

Walks `~/Downloads`, `~/Desktop`, `~/tmp`, etc. for files you haven't touched in 90+ days. **Interactive only** — one `y/n` per file. The tool will not batch this.

**Typical reclaim: 1–10 GB.** Most users underestimate how much old installer ISOs, sample data, and forgotten attachments live here.

---

## Step 6 — Partial downloads (1 minute)

```bash
linux-cleanup --partials
```

Cleans `.fdmdownload`, `.crdownload`, `.part` files. Usually 200 MB – 5 GB.

---

## Step 7 — Re-audit and confirm

```bash
linux-cleanup --scan
df -h /
```

The scan should now show dramatically lower reclaimable totals. `df -h /` confirms the actual disk delta.

---

## Want even more? Use `--purge-all` (advanced)

```bash
linux-cleanup --all-safe -y --purge-all
```

Disables the staleness gate. Wipes recently-used Gradle wrappers, AVDs you might want next month, etc. **Only use this if you understand you'll re-pay the download cost on next use.** See [Safety](../safety.md#guard-2--staleness-gate-default--100-days-since-120) for why this isn't the default.

---

## What to skip

- **Do not run `--system` more than monthly.** Once it's done, the next pass usually only reclaims a few hundred MB. Save the time.
- **Do not lower `-d` below 14 days routinely.** Anything more aggressive risks deleting tools you'll need next week. Use sparingly for one-shot deep cleans.
- **Do not bypass the safety guards by editing the script.** The licence prohibits derivative works, and the guards exist to prevent the bug-of-the-month from being a permanent data loss.

---

## After the cleanup

- Save the JSON reports — they're a permanent record of what was reclaimed and from where.
- Consider [`--install-cron`](../features/shell-alias-and-cron.md) so weekly maintenance happens without you thinking about it.
- Re-run [`--scan`](../features/scan.md) monthly as a baseline.

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
