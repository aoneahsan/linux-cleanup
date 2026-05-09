# Doctor (`--doctor`)

> Detects and (with your confirmation) repairs the most common shell-init breakage on developer machines: `nvm`, `pnpm`, `bun`, `deno`, `cargo` not sourced in `~/.bashrc` / `~/.zshrc`. The "why does my CI work but my terminal doesn't?" diagnostic.

**Type**: inspection + repair mode (interactive)
**Run**: `linux-cleanup --doctor`
**Touches personal data**: only `~/.bashrc` / `~/.zshrc` / `~/.profile`, with explicit confirmation, with a `.bak` backup written first

---

## What it does

`--doctor` walks each of these well-known toolchains and asks two questions per tool:

1. Is it installed on disk?
2. Is its init script sourced from the user's shell rc?

| Toolchain | Install path | Init line expected in rc |
|---|---|---|
| `nvm` | `~/.nvm/nvm.sh` | `[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"` |
| `pnpm` | `~/.local/share/pnpm` | `export PNPM_HOME=…; export PATH="$PNPM_HOME:$PATH"` |
| `bun` | `~/.bun` | `export BUN_INSTALL=…; export PATH="$BUN_INSTALL/bin:$PATH"` |
| `deno` | `~/.deno` | `export DENO_INSTALL=…; export PATH="$DENO_INSTALL/bin:$PATH"` |
| `cargo` | `~/.cargo` | `. "$HOME/.cargo/env"` |

Any toolchain that's installed but **not** sourced is flagged. The doctor offers to add the missing init line — once, with your approval, with a backup.

```
── Shell init doctor ──

✓ nvm    installed, sourced in ~/.bashrc
✗ pnpm   installed at ~/.local/share/pnpm, NOT sourced in any rc
         Add init lines to ~/.bashrc? [y/N]
✓ bun    installed, sourced in ~/.bashrc
· deno   not installed (skipped)
✓ cargo  installed, sourced in ~/.bashrc

Detected shell: bash (login + interactive)
Will write to:  ~/.bashrc  (backup: ~/.bashrc.bak.20260510)
```

`y` = append to your rc + write a `.bak` backup.
`n` = skip; report shows the line you'd need to add manually.

---

## When to use it

- **`pnpm: command not found`** in a fresh terminal but `which pnpm` works in another.
- **GUI VS Code launches don't see your `nvm` Node version** even though terminal does.
- **CI passes, local dev fails** with `cannot find module …`.
- **Just installed a new toolchain** and want to verify the init wired up.

---

## Why this is a problem worth a dedicated mode

Modern dev toolchains all install via curl-pipe-bash scripts that *try* to edit your shell rc. They almost always succeed — but several common scenarios silently fail:

- The installer wrote to `~/.profile` but your terminal launches `~/.bashrc` and doesn't source `~/.profile`.
- The installer wrote to `~/.bashrc` but your daily driver is `zsh`.
- You re-imported your dotfiles from a different machine and the init lines were skipped.
- Two toolchains both modified `~/.zshrc` and the second overwrote the first's lines.

Each of these results in: tool installed, tool invisible. The doctor diagnoses all four cases.

---

## What it writes

For a missing tool, the doctor appends a clearly-marked block to your shell rc:

```bash
# Added by linux-cleanup --doctor on 2026-05-10
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# End linux-cleanup --doctor block
```

The `case` guard prevents duplicate `PATH` entries if you re-run the doctor.

A `.bak` backup of the rc file is written **before** any append. Filename pattern: `~/.bashrc.bak.<YYYYMMDD>`. To roll back: `mv ~/.bashrc.bak.20260510 ~/.bashrc`.

---

## What the doctor will NOT do

- Will not modify `/etc/*` or any file outside `$HOME`.
- Will not append to a file that doesn't already exist (won't create `~/.zshrc` if you don't have one — assumes you don't use zsh).
- Will not remove existing init lines, even broken ones. If you have a duplicate-but-malformed init for `nvm`, the doctor leaves it alone and reports the issue; you fix it manually.
- Will not source the init in the current shell. After the doctor finishes, run `source ~/.bashrc` or open a fresh terminal.

---

## FAQ

**It says my tool is "installed but not sourced" but I'm sure it works.**
Check whether it works in a *fresh login shell*: open a new terminal tab and run `which <tool>`. If that fails, the doctor's diagnosis is correct. If it works there but not in some other context (`tmux`, GUI launchers), the issue is shell-init ordering — see the doctor's report for the exact init line.

**Can it fix system-wide installs?**
No — the doctor is intentionally scoped to per-user installs. System-wide tools belong in `/usr/local/bin` or distro packages, both of which should already be in `$PATH` without per-user init.

**My shell is `fish` / `nushell` / `xonsh`.**
The doctor detects `bash` and `zsh` only. For other shells it prints the bash-flavoured init line and asks you to translate. Adding native fish/nushell support is a candidate feature — [email feature requests](mailto:aoneahsan@gmail.com).

**The append broke my prompt / theme.**
Roll back: `mv ~/.bashrc.bak.<DATE> ~/.bashrc`. Then either source the init manually or report the conflict.

---

## See also

- [Globals audit](./globals-audit.md) — pairs well; "doctor first, then audit"
- [Troubleshooting](../troubleshooting.md) — for failures the doctor doesn't cover
- [Send a bug report](../how-to/send-a-bug-report.md) — if the doctor fails on your specific toolchain

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
