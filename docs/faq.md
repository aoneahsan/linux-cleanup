# FAQ

> The questions that come up most often. For symptom → fix recipes see [Troubleshooting](./troubleshooting.md). For full design rationale see [Safety](./safety.md).

---

## Will it delete my code?

The protected-path guard refuses the listed personal and system paths; `--node-modules` can offer project dependency directories for separate confirmation. Review the exact targets and a dry run before deleting. See [Safety](./safety.md).

---

## Does it phone home?

It checks a public release record for updates when online. Cleanup results, logs and crash bundles are kept locally; none is uploaded by the update check.

```bash
# Verify yourself:
grep -rE 'curl|wget|http(s)?://[^/]' cleanup.sh lib/ modules/
```

The live release check is in `modules/update_check.sh`; inspect it to see the network request.

---

## Why bash and not Python / Rust / Go?

Bash is already on every Linux system the script targets. Adding a runtime dependency would mean either bundling a binary (security questions, audit overhead) or requiring users to install one (friction). The script is ~3,000 lines of well-commented bash that any senior dev can audit in an afternoon. That's the right trade for a tool that operates at scale on filesystems with `sudo` available.

---

## I'm scared. What's the safest way to try it?

1. `linux-cleanup --self-test` — verifies syntax and safety guards, deletes nothing.
2. `linux-cleanup --scan` — read-only inventory of target roots and sizes, not a reclaim estimate.
3. `linux-cleanup --list-targets` — shows every path the script can touch.

Then run `linux-cleanup --all-safe --dry-run` to preview the batch cleanup. A local log and update-check state may be written. Run the guided walkthrough only when you are ready to review each step.

---

## Why doesn't it have an undo?

Cache deletion is intentionally one-way. An undo log would itself be write-amplification on the disk you're trying to free, and would create a false sense of safety that incentivises sloppy use. The actual safety model — allowlists, staleness gates, interactive confirmation — is the better defence. See [Safety](./safety.md#what-happens-when-something-goes-wrong) for the full reasoning.

---

## Will it speed up my computer?

A little, sometimes. Specifically:

- VS Code launches faster when `~/.vscode/extensions/` has 12 directories instead of 50.
- `yarn install` is a tiny bit faster on cold caches than on bloated old ones (less metadata to skim).
- Browser cold-starts are unaffected (caches are key-value, lookups are O(1)).
- Page-cache drop (`vm.drop_caches=3`) frees RAM, not disk; impact on programs is usually unmeasurable.

The honest answer: the speedup is in your developer flow ("disk full" no longer blocking work), not in benchmark numbers.

---

## What happens if I `Ctrl-C` mid-cleanup?

The process exits with code `130` after interruption. A log may contain output up to that point; do not treat it as a complete receipt. A walkthrough report may be absent or incomplete if interrupted.

---

## Can I run it as root?

You can, but you shouldn't. The tool is designed to run as a normal user. Running as root only widens the blast radius if a bug ever slipped past the safety guards. The `--system` mode handles all the legitimate sudo needs internally, with each command audited separately.

---

## My distro isn't Debian/Ubuntu. Will it work?

Home cache cleanup uses GNU utilities and paths from installed tools. The `--system` mode calls `apt` and `dpkg` directly, so use it only on a Debian-family system with those tools. Run `--self-test` first on other distributions.

---

## What about WSL?

It runs on the Linux side of WSL. The path guard resolves symlinks but does not recognize Windows personal folders as protected Linux folders. Inspect configured roots and a dry run if they point into `/mnt/`.

---

## What license is it under?

linux-cleanup is released under the **[MIT License](../LICENSE)** — a short, permissive, OSI-approved open-source license. You can use it (personally or commercially), read it, modify it, fork it, embed it in other tools, and redistribute it. The only condition is that you keep the copyright notice and the MIT permission notice in copies or substantial portions. The software is provided "AS IS" with no warranty — see the [LICENSE](../LICENSE) for the full text.

---

## I want to add a feature. How?

**Pull requests are welcome** under the MIT License — fork the repo and open a PR. If you'd rather not code, description-only feature requests are just as welcome: email [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com) with:

- The use case ("I'd want to clean X because Y")
- Why existing modes don't already cover it
- Any references / examples

If the request is in scope, it'll show up in a future release.

---

## How often should I run it?

| Mode | Cadence |
|---|---|
| `--scan` | Monthly, as a baseline |
| `--all-safe -y` | Weekly (use [`--install-cron`](./features/shell-alias-and-cron.md)) |
| `--system` | Quarterly, manually |
| `--node-modules` | Yearly, after side projects pile up |
| `--editor-ext` | Whenever VS Code feels slow (also covered by `--all-safe`) |
| `-p` / `--stale` | Quarterly, deliberately |
| `--doctor` | When `<tool>: command not found` happens |
| `--globals` | Before reinstalling Node or migrating machines |

---

## What's in v1.3.0 that wasn't in v1.0?

| Version | Added |
|---|---|
| 1.1.0 | Reports manager (`--reports`), MD/HTML export |
| 1.2.0 | Default-stale-only deletion (≥100d staleness gate) |
| 1.2.1 | Staleness gate extended to AVDs and editor extensions |
| 1.2.2 | Bug fixes |
| **1.3.0** | **TUI mode (`--tui`), automatic crash bundles** |

See the [CHANGELOG](../CHANGELOG.md) for full details.

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) — [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan) · [npm](https://npmjs.com/~aoneahsan)
**Last updated**: 2026-07-11 · **Tool version**: 1.4.0
