# Installation

> linux-cleanup ships three ways: zero-install via `npx`, global install via `npm`, or a direct `git clone` for advanced use. All three are byte-identical — pick whichever fits how you already work.

**Audience**: anyone with a Linux machine and bash.
**Prerequisites**: bash ≥ 4, GNU coreutils. Node.js is only needed for `npx` / `npm` install paths. `jq` is optional but unlocks Markdown / HTML report export.

---

## Option 1 — `npx` (recommended for trying it out)

```bash
npx linux-cleanup           # guided walkthrough
npx linux-cleanup --scan    # read-only audit, no deletes
npx linux-cleanup --help    # full flag list
```

`npx` fetches the package into a temporary npm cache directory and runs it. **Your logs and reports persist at `~/.linux-cleanup/`** (not in the temp dir), so they survive npm cache eviction and are always there for the next run.

This is the fastest way to evaluate the tool — no global install, no `PATH` changes, no leftover files if you decide it's not for you.

---

## Option 2 — `npm install -g`

```bash
npm install -g linux-cleanup
linux-cleanup --version
linux-cleanup           # guided walkthrough, anywhere on your machine
```

After this, `linux-cleanup` is on your `PATH` everywhere. Logs and reports still go to `~/.linux-cleanup/{logs,reports}/`.

To upgrade: `npm install -g linux-cleanup@latest`.
To uninstall: `npm uninstall -g linux-cleanup` (and see [Uninstall](./how-to/uninstall.md) for cleanup of cron / aliases).

---

## Option 3 — `git clone` (for advanced use)

```bash
git clone https://github.com/aoneahsan/linux-cleanup ~/linux-cleanup
cd ~/linux-cleanup
chmod +x cleanup.sh
./cleanup.sh --self-test    # verify deps + safety guards
./cleanup.sh                # run guided walkthrough
```

The npm package is just a thin Node.js launcher (`bin/linux-cleanup.js`) that locates this same bash script. The cloned repo is identical bytes to what npm publishes.

Use this option if you want to inspect, audit, or hack on the script directly. Note: the [LICENSE](../LICENSE) prohibits derivative works; description-only feature requests are welcome by email.

---

## Optional dependencies

| Dependency | What it unlocks | Install |
|---|---|---|
| `jq` | Markdown / HTML report export, structured queries against JSON reports | `sudo apt install jq` (Debian/Ubuntu) · `sudo dnf install jq` (Fedora) · `sudo pacman -S jq` (Arch) |
| `whiptail` | Visual TUI menu (`--tui`) | `sudo apt install whiptail` (Debian/Ubuntu) · `sudo dnf install newt` (Fedora) · `sudo pacman -S libnewt` (Arch) |
| `dialog` | Fallback for `--tui` when `whiptail` isn't available | `sudo apt install dialog` |
| `lsb_release` | Better distro detection in feedback bundles | usually pre-installed; `sudo apt install lsb-release` if missing |

Without `jq`: JSON reports still write fine, but `--export md / html` and the reports manager's Markdown / HTML conversions are unavailable.
Without `whiptail` / `dialog`: `--tui` falls back to the regular CLI menu after a one-line install hint.

---

## Verify the install

```bash
linux-cleanup --version       # prints v1.3.0 + author
linux-cleanup --self-test     # runs every safety check
```

A clean self-test ends with `✓ all checks passed — script is ready.`

---

## What linux-cleanup does NOT install

- No system services
- No background daemons
- No telemetry agent
- No remote configuration fetcher
- No browser extension or VSCode plugin

The only persistent state outside the package itself is `~/.linux-cleanup/{logs,reports,feedback}/` — and even those are only created when you actually run the tool.

---

## Next

- [Quick start](./quick-start.md) — your first real cleanup, in under five minutes
- [Safety](./safety.md) — what the allowlist refuses to delete

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) — [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
