# linux-cleanup — Documentation

> **linux-cleanup** is a safe, modular, scriptable disk and cache cleanup utility for Linux that helps developers reclaim 10–50+ GB of regenerable junk — yarn / npm / pnpm caches, Chrome / Firefox / Brave caches, Gradle, Cypress, Playwright binaries, Android emulator images, stale `node_modules`, browser partial downloads, system journals, old kernels — without ever putting personal data at risk.

This documentation is structured along the [Diátaxis framework](https://diataxis.fr/): four kinds of writing for four kinds of reader need.

---

## Start here

| If you want to… | Read |
|---|---|
| Get installed in under a minute | [Installation](./installation.md) |
| Run your very first cleanup | [Quick start](./quick-start.md) |
| Understand the safety model before deleting anything | [Safety](./safety.md) |
| Learn about a specific mode or flag | [Features](#features) |
| Look up an exact flag or exit code | [Reference](#reference) |
| Solve a specific problem | [How-to guides](#how-to-guides) |
| File a bug or send feedback | [Feedback & crash bundles](./features/feedback-and-crash-bundles.md) |
| Know who built this | [About the author](./about-the-author.md) |

---

## Features

Every cleanup mode and helper is documented in its own page so you can jump straight to what you need.

### Inspection

- [Scan mode](./features/scan.md) — read-only audit, no deletes
- [Home audit](./features/home-audit.md) — show the 20 largest things in `$HOME`
- [Doctor](./features/doctor.md) — detect and repair broken shell-init for `nvm`, `pnpm`, `bun`, `deno`, `cargo`

### Cleanup — regenerable / safe

- [Walkthrough](./features/walkthrough.md) — guided step-by-step through every category (default)
- [Menu](./features/menu.md) — jump-to CLI menu, pick one category at a time
- [TUI](./features/tui.md) — visual whiptail / dialog menu (new in 1.3.0)
- [All-safe](./features/all-safe.md) — wipe every regenerable cache in one shot
- [System cleanup (sudo)](./features/system-cleanup.md) — apt, journal, snap, kernels, `/tmp`, page cache

### Cleanup — interactive only (personal data)

- [Stale personal files](./features/personal-stale-files.md) — files unused N+ days
- [Partial / orphan downloads](./features/partial-downloads.md) — `.fdmdownload`, `.crdownload`, `.part`
- [Stale `node_modules`](./features/node-modules-finder.md) — projects untouched N+ days
- [Global packages audit](./features/globals-audit.md) — npm / pnpm / yarn / bun / deno globals
- [Editor extensions](./features/editor-extensions.md) — superseded VS Code / Cursor extension versions

### Reports & operations

- [Reports](./features/reports.md) — JSON / Markdown / HTML session reports
- [Shell alias & weekly cron](./features/shell-alias-and-cron.md) — one-time setup
- [Feedback & crash bundles](./features/feedback-and-crash-bundles.md) — how to report bugs (1.3.0+)

---

## Reference

Information-oriented pages. Look up an exact value, don't read top-to-bottom.

- [CLI flags](./reference/cli-flags.md) — every flag, alphabetised
- [Modes](./reference/modes.md) — every mode, what it does, what it touches
- [Environment variables](./reference/environment-variables.md)
- [Output paths](./reference/output-paths.md) — where logs, reports, and feedback bundles live
- [Exit codes](./reference/exit-codes.md)
- [Report JSON schema](./reference/report-schema.md)

---

## How-to guides

Problem-oriented recipes. "I want to do X — what's the minimum?"

- [Reclaim the most space](./how-to/reclaim-the-most-space.md)
- [Send a bug report](./how-to/send-a-bug-report.md)
- [Uninstall](./how-to/uninstall.md)

---

## Explanation

Understanding-oriented background. Read these once, refer back rarely.

- [Safety philosophy](./safety.md) — why allowlists, staleness gates, interactive-only personal mode
- [FAQ](./faq.md) — common questions
- [Troubleshooting](./troubleshooting.md) — symptom → fix
- [About the author](./about-the-author.md) — who built this and why

---

## Quick contact

| | |
|---|---|
| **Author** | [Ahsan Mahmood](https://aoneahsan.com) |
| **Email** | [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com) |
| **Web** | [aoneahsan.com](https://aoneahsan.com) |
| **LinkedIn** | [linkedin.com/in/aoneahsan](https://linkedin.com/in/aoneahsan) |
| **GitHub** | [github.com/aoneahsan](https://github.com/aoneahsan) |
| **npm** | [npmjs.com/~aoneahsan](https://npmjs.com/~aoneahsan) |
| **Support the work** | [aoneahsan.com/payment](https://aoneahsan.com/payment?project-id=linux-cleanup&project-identifier=linux-cleanup) |

---

**Last updated**: 2026-05-10 · **Tool version**: 1.3.1 · **License**: Source-Available, No-Derivatives, Non-Commercial v1.0
