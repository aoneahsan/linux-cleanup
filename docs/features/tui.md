# TUI mode (`--tui` / `-t` / `--gui` / `-g`)

> A visual point-and-shoot menu rendered with `whiptail` (or `dialog` as a fallback). Same actions as the [CLI menu](./menu.md), in a dialog-style interface for users who prefer arrows and Enter to typing numbers.

**Type**: cleanup mode (interactive, visual)
**Run**: `linux-cleanup --tui` or `linux-cleanup -t`
**Added in**: v1.3.0
**Touches personal data**: only when you pick a personal-data category

---

## What it does

`--tui` opens a full-screen `whiptail`-driven menu:

```
╔════════════════════════════════════════════════════════════════════════════╗
║                       linux-cleanup v1.3.0                                 ║
║         Safe modular disk + cache cleanup  ·  Ahsan Mahmood                ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║   Pick an action — Esc / Cancel to quit                                    ║
║                                                                            ║
║     scan         Scan & report (read-only, no deletes)                     ║
║     walkthrough  Guided walkthrough — every category, with prompts         ║
║     all-safe     All regenerable caches in one shot                        ║
║     pkg          Package-manager caches (yarn, npm, pnpm, pip, composer)   ║
║     apps         App caches (Chrome, Gradle, Cypress, Playwright, Zoom)    ║
║     …                                                                      ║
║     about        About linux-cleanup (version, author, license)            ║
║     quit         Exit                                                      ║
║                                                                            ║
║                       <  OK  >          < Cancel >                         ║
╚════════════════════════════════════════════════════════════════════════════╝
```

Use **arrow keys** to navigate, **Enter** to select, **Esc** or **Cancel** to quit. After each selected action runs (with full CLI output), press Enter to return to the menu.

---

## When to use it

- You don't want to memorise option numbers from the CLI menu.
- You're handing the script to a less command-line-fluent teammate.
- You want a clearly-labelled "About" dialog with version, contact, license, and the privacy guarantee in one screen.
- Working over SSH on a small terminal and the dialog rendering helps focus.

For unattended / scripted use, the TUI is the wrong tool — use [`--all-safe -y`](./all-safe.md) or specific mode flags instead.

---

## Requirements

`--tui` needs one of:

- **`whiptail`** — recommended. Pre-installed on Debian / Ubuntu. Otherwise:
  - Debian / Ubuntu: `sudo apt install whiptail`
  - Fedora / RHEL: `sudo dnf install newt`
  - Arch: `sudo pacman -S libnewt`
- **`dialog`** — fallback if `whiptail` isn't found. `sudo apt install dialog`.

**If neither is installed**, linux-cleanup prints a one-line install hint per distro family and offers to fall back to the regular CLI menu:

```
! TUI mode needs 'whiptail' (recommended) or 'dialog'.
  Install:  sudo apt install whiptail   (Debian/Ubuntu)
            sudo dnf install newt        (Fedora/RHEL)
            sudo pacman -S libnewt       (Arch)

  Fall back to the regular CLI menu now? [Y/n]
```

The graceful fallback means `--tui` is never a hard failure — you always have a way forward.

---

## How it differs from `--menu`

| | `--menu` | `--tui` |
|---|---|---|
| Dependencies | none | `whiptail` or `dialog` |
| Input | typed numbers | arrow keys + Enter |
| Selection labels | numbered (1–19) | named (`scan`, `walkthrough`, `pkg`, …) |
| About dialog | bundled with `--version` | dedicated menu entry, modal dialog |
| Navigation | scroll, type, Enter | arrows, tab, Enter, Esc |
| Falls back? | n/a | yes — to `--menu` if dependencies missing |

Both menus dispatch to the **exact same** `run_*` functions internally. There's no difference in what gets cleaned or how guards behave.

---

## Privacy (same as the rest of the tool)

The TUI does not change anything about the tool's privacy model:

- No network calls, ever.
- No telemetry, no analytics.
- Logs and reports stay on your machine.
- Only what you explicitly email leaves the computer.

The "About" dialog repeats this guarantee in plain language.

---

## FAQ

**Can I make `--tui` the default?**
Add a shell alias: `alias cleanup='linux-cleanup --tui'` in `~/.bashrc` / `~/.zshrc`. Or use `--install-alias` and edit it manually.

**The dialog colours look weird in my terminal.**
That's a `whiptail` / `dialog` rendering quirk and depends on your terminal palette. Try `linux-cleanup --menu` for plain ANSI, or change your terminal scheme.

**Does it work over SSH?**
Yes. `whiptail` and `dialog` both render fine over an SSH session. Resize the local terminal first; both libraries query the dimensions on dialog open.

**Can I use it from `tmux` / `screen`?**
Yes. The dialog auto-fits to the pane. If the dialog is wider than the pane, expand the pane and re-open the menu.

**It works fine but `Ctrl-C` doesn't quit cleanly.**
Press `Esc` or pick the `quit` entry instead. `Ctrl-C` inside `whiptail` can leave the terminal in a weird state — `reset` fixes it.

---

## See also

- [Menu mode](./menu.md) — the CLI menu the TUI wraps
- [Walkthrough](./walkthrough.md) — fixed-order guided cleanup
- [Installation](../installation.md#optional-dependencies) — how to install `whiptail` / `dialog`
- [About the author](../about-the-author.md) — what the About dialog points to

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) — built the TUI to lower the barrier for non-CLI-fluent teammates without compromising the script's safety model. [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan).
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
