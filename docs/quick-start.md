# Quick start — your first cleanup

> A ten-minute, guided run that reclaims 5–30 GB on a typical developer machine. Nothing personal is touched, nothing is wiped without your explicit confirmation, and you walk away with a JSON session report you can re-read at any time.

**Audience**: developers running this for the first time.
**Outcome**: ten gigabytes back on your root partition, a saved report, and a working understanding of the tool's safety model.

---

## Step 1 — Install (one minute)

```bash
npx linux-cleanup --version
```

If that prints `linux-cleanup v1.3.0 …` you're done. If not, see [Installation](./installation.md).

---

## Step 2 — Audit before you delete (one minute)

```bash
npx linux-cleanup --scan
```

`--scan` is **read-only**. It walks every category the tool knows about, prints how many bytes each would reclaim, and writes a JSON report to `~/.linux-cleanup/reports/`. Nothing is deleted.

Read the output before continuing. Common surprises on a developer laptop:

| Category | Typical size |
|---|---|
| `~/.cache/yarn` + `~/.npm` + `~/.pnpm` | 5–25 GB |
| Chrome / Brave / Firefox profile caches | 2–8 GB |
| `~/.gradle/caches` | 3–10 GB |
| Cypress + Playwright browser binaries | 1–4 GB |
| `~/.android/avd` (Android emulator images) | 6–30 GB |
| Stale `node_modules` in old projects | 5–50 GB |

---

## Step 3 — Run the guided walkthrough (5–10 minutes)

```bash
npx linux-cleanup
```

No flags = the **default guided walkthrough**. It steps through every category in turn, asks before deleting anything, and shows a per-step running total of bytes reclaimed.

For each step you'll see:

```
── [ STEP 3/10 ]  Package-manager caches ──
  yarn cache       12.4 GB     last used 134 days ago
  npm cache         3.1 GB     last used  18 days ago
  pnpm store        4.8 GB     last used   2 days ago

  Delete yarn cache (12.4 GB)?  [Y/n]
```

Answer `y` to delete, `n` to skip. The tool **never** auto-confirms anything destructive that touches personal data. Press `Enter` for the default (shown in capitals).

The walkthrough is safe to abort with `Ctrl-C` at any time — partial progress is preserved in the log and report.

---

## Step 4 — Review the report (one minute)

When the walkthrough finishes you'll see:

```
── Session summary ──
✓ Recovered: 18.7 GB
ℹ Disk: 142 GB free of 500 GB on /
ℹ Log saved: ~/.linux-cleanup/logs/cleanup-2026-05-10_140312.log
ℹ Report:    ~/.linux-cleanup/reports/report-2026-05-10_140312.json
```

To convert the JSON report to Markdown or HTML for archiving:

```bash
linux-cleanup --export both latest    # writes .md and .html next to the .json
```

Or open the interactive reports manager:

```bash
linux-cleanup --reports
```

See [Reports](./features/reports.md) for the full schema and conversion options.

---

## Step 5 — Set it and forget it (optional)

If you found this useful and want it to run weekly without thinking about it:

```bash
linux-cleanup --install-cron     # Sunday 03:00, --all-safe -y
linux-cleanup --install-alias    # type `cleanup` from anywhere
```

See [Shell alias & weekly cron](./features/shell-alias-and-cron.md) for what each one writes and how to remove it.

---

## What you just learned

| Concept | Where to read more |
|---|---|
| Read-only audits never delete | [Scan mode](./features/scan.md) |
| The walkthrough always asks first | [Walkthrough](./features/walkthrough.md) |
| Safety guards refuse Documents / Pictures / .ssh / .config | [Safety](./safety.md) |
| Reports are canonical JSON, exportable to MD / HTML | [Reports](./features/reports.md) |
| Personal-data scans are interactive only | [Stale personal files](./features/personal-stale-files.md) |
| The visual menu is one flag away | [TUI](./features/tui.md) |

---

## Common follow-ups

- **"I want even more space."** → [How-to: reclaim the most space](./how-to/reclaim-the-most-space.md)
- **"Something broke."** → [Troubleshooting](./troubleshooting.md) → [Send a bug report](./how-to/send-a-bug-report.md)
- **"I don't trust it. What does it actually delete?"** → [Safety](./safety.md) and `linux-cleanup --list-targets`

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) — Senior software engineer, Lahore. [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan).
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
