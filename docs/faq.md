# FAQ

> The questions that come up most often. For symptom → fix recipes see [Troubleshooting](./troubleshooting.md). For full design rationale see [Safety](./safety.md).

---

## Will it delete my code?

No. The script refuses any path inside `~/Documents`, `~/Pictures`, `~/Music`, `~/Videos`, `~/Desktop`, `~/Public`, `~/.ssh`, `~/.gnupg`, `~/.config`, `~/.claude`, `/`, `/etc`, `/usr`, `/boot`, `/sys`, or `/proc` — see [Safety](./safety.md). The closest the tool comes to "code" is finding stale `node_modules/` directories inside your project roots, and those are interactive-only with explicit per-project confirmation.

---

## Does it phone home?

No. linux-cleanup makes **zero network calls**. There's no telemetry, no analytics, no crash reporter that auto-uploads, no update check that pings a server. The only data that leaves your machine is what you explicitly email.

```bash
# Verify yourself:
grep -rE 'curl|wget|http(s)?://[^/]' cleanup.sh lib/ modules/
```

You'll find URLs only in comments, the `--feedback` mailto helper, and this documentation — never in live network code.

---

## Why bash and not Python / Rust / Go?

Bash is already on every Linux system the script targets. Adding a runtime dependency would mean either bundling a binary (security questions, audit overhead) or requiring users to install one (friction). The script is ~3,000 lines of well-commented bash that any senior dev can audit in an afternoon. That's the right trade for a tool that operates at scale on filesystems with `sudo` available.

---

## I'm scared. What's the safest way to try it?

1. `linux-cleanup --self-test` — verifies syntax and safety guards, deletes nothing.
2. `linux-cleanup --scan` — read-only audit, prints what *would* be reclaimed.
3. `linux-cleanup --list-targets` — shows every path the script can touch.

After those three, you've seen the safety model in action without losing a byte. Then run `linux-cleanup` (the guided walkthrough) and answer `n` to anything that surprises you.

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

The current `safe_rm` finishes (typically <100 ms — Linux unlinks are fast), then the script exits with code `130`. The session log captures everything up to the abort. The JSON report is **not** written if the abort is mid-walkthrough — only the log. The crash trap does **not** fire on `Ctrl-C`; it's deliberately suppressed.

---

## Can I run it as root?

You can, but you shouldn't. The tool is designed to run as a normal user. Running as root only widens the blast radius if a bug ever slipped past the safety guards. The `--system` mode handles all the legitimate sudo needs internally, with each command audited separately.

---

## My distro isn't Debian/Ubuntu. Will it work?

Yes. The cleanup tool is distro-aware:

| Distro family | `--system` step support |
|---|---|
| Debian / Ubuntu / Mint | full (apt, journal, snap, kernels, /tmp, page cache) |
| Fedora / RHEL / Rocky | mostly (dnf substitutes for apt; no kernel-removal step on RPM-based systems by default) |
| Arch / Manjaro | most (pacman + pacman-contrib's paccache; otherwise listed as candidates only) |
| openSUSE | some (zypper orphan listing only; no auto-removal) |

Cleanup of caches in `$HOME` works identically on every Linux distro.

---

## What about WSL?

It works fine. linux-cleanup runs on the Linux side of WSL — its safety model and behaviour are identical to a native Linux box. The `/mnt/c/` mount is not on the protected allowlist (it's not your `$HOME`), but the tool also doesn't go looking inside it. If you've manually configured `~/Downloads` to point at `/mnt/c/Users/<you>/Downloads` via symlink, the [allowlist guard](./safety.md) follows the symlink and rejects deletions inside Windows-side Documents/Pictures.

---

## Why a non-commercial license?

The author wants the script to remain a single, auditable, drift-free codebase that everyone benefits equally from. A permissive license would invite forks that might add telemetry, paid tiers, or "premium" features — the exact model the script was built to avoid. The current license (Source-Available, No-Derivatives, Non-Commercial v1.0) keeps the source visible for audit, allows free personal and team use, but blocks both forks and commercial rebadging. See the [LICENSE](../LICENSE) for the legal text.

If you have a use case the license blocks (e.g., your company wants to ship it inside an internal tool), email the author to discuss.

---

## I want to add a feature. How?

The license blocks code contributions, but **description-only feature requests are very welcome**. Email [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com) with:

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
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
