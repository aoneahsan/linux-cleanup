# System cleanup (`--system`)

> The only mode that calls `sudo`. Cleans `apt` cache, `journalctl` logs, snap revisions, old kernels, `/tmp` entries beyond N days, and drops the kernel page cache. Each step is a separate, narrowly-scoped sudo call.

**Type**: cleanup mode (sudo, interactive)
**Run**: `linux-cleanup --system`
**Touches personal data**: never
**Modifies system state**: yes — package manager, journal, snap, /tmp, page cache

---

## What it does

`--system` runs a fixed sequence of system-level cleanups. Each step prompts before running and shows the exact sudo command it will invoke.

| Step | Action | Command (Debian/Ubuntu shown — Fedora/Arch equivalents used where applicable) |
|---|---|---|
| 1 | Remove orphaned packages | `sudo apt autoremove --purge` |
| 2 | Clean apt cache | `sudo apt clean` |
| 3 | Vacuum journal | `sudo journalctl --vacuum-size=200M` (configurable) |
| 4 | Trim snap revisions | `sudo snap set system refresh.retain=2; sudo snap remove --revision <old>` per snap |
| 5 | Remove old kernels | `sudo apt-get autoremove --purge linux-image-*` (skipped on non-deb distros) |
| 6 | Age `/tmp` | Removes entries older than `--days N` from `/tmp/` (uses `find -mtime`) |
| 7 | Drop kernel page cache | `sudo sync; sudo sysctl vm.drop_caches=3` |

Step 7 doesn't free disk — it frees RAM by releasing the page cache. Linux re-populates it lazily; the impact on your next disk read is negligible.

---

## Typical reclaim

On a developer Ubuntu LTS box that's been online for ~6 months:

| Step | Typical size |
|---|---|
| `apt autoremove --purge` | 200 MB – 2 GB |
| `apt clean` | 500 MB – 1.5 GB |
| Journal vacuum | 200 MB – 1 GB |
| Snap revision trim | 1 GB – 5 GB |
| Old kernel removal | 200 MB – 800 MB per old kernel × 1–4 kernels |
| `/tmp` aging | typically minor |
| Page cache drop | RAM only, not disk |

A first-ever `--system` run on an old install often reclaims 5–15 GB. Subsequent monthly runs are typically 500 MB – 2 GB.

---

## Why each step is a *separate* sudo call

linux-cleanup deliberately does **not** spawn one long-lived `sudo bash` session. Each step issues its own `sudo <command>`. That means:

- You can audit each command before it runs.
- You can refuse step 4 (snap) and still run steps 5 & 6.
- A bug in one step cannot escalate into the others.
- `sudo`'s timeout policy applies — if it lapses between steps, you'll be re-prompted.

This is slower than batching, but the safety dividend is large.

---

## When to use it

- **First post-install cleanup** of a long-running Ubuntu / Debian / Fedora box.
- **Every couple of months** as routine maintenance, especially on machines with snaps installed.
- **Right before imaging** a build server, runner image, or VM template — cuts image size dramatically.
- **Disk-pressure recovery** when `df -h` shows root partition near full and `/var` is the culprit.

Not appropriate for unattended cron — it prompts. For weekly batch use, [`--all-safe -y`](./all-safe.md) is the right mode.

---

## What it will NOT do

- Will **not** modify `/etc/sudoers`, run a long-lived sudo session, or escalate beyond the per-step commands above.
- Will **not** remove the *running* kernel — `apt autoremove` excludes it.
- Will **not** uninstall any application you have installed manually. Only orphaned dependencies and superseded snap revisions / old kernels.
- Will **not** touch any user-installed `pip`, `gem`, `npm` global, or language-manager state. Use [`--globals`](./globals-audit.md) for those (read-only audit, by design).
- Will **not** drop the page cache on systems where doing so would impact a running production workload — but the script can't know that. If you're unsure, skip step 7.

---

## Per-distro behaviour

| Distro family | `apt` steps | `dnf` / `pacman` equivalent |
|---|---|---|
| Debian / Ubuntu / Mint | full support | n/a |
| Fedora / RHEL / Rocky | n/a | `dnf autoremove`, `dnf clean all` substituted automatically |
| Arch / Manjaro | n/a | `pacman -Rns $(pacman -Qdtq)` if any orphans, plus `paccache -ruk0` if `pacman-contrib` is installed |
| openSUSE | n/a | `zypper packages --orphaned` listing, manual confirmation |

The script detects the package manager at runtime and adapts. If your distro isn't supported, those steps are skipped with `· not applicable on <distro>`.

---

## Customising thresholds

| Flag | Effect |
|---|---|
| `-d N` | `/tmp` aging threshold (default 100). Files in `/tmp/` modified within N days are kept. |
| `--no-color` | Disable ANSI colour for cleaner sudo logs. |

The journal vacuum size (`--vacuum-size=200M`) is hard-coded to 200 MB. If you need a different value, edit `modules/system_sudo.sh` in your local clone and rebuild — but be aware: very small journals reduce your ability to debug boot failures.

---

## Recovery / undo

There is no undo for `--system`. Specifically:

- `apt autoremove` removes packages — re-install with `sudo apt install <name>` if you need them back.
- `journalctl --vacuum-size` truncates older log entries permanently.
- `snap remove --revision` removes a specific snap revision; the current revision survives.
- Removed kernels are gone — they remain available in the distro's package archive.

If you need a recovery point, take a filesystem snapshot (Btrfs, ZFS, LVM thin) **before** running `--system`. The script does not orchestrate that for you.

---

## FAQ

**Why does my disk barely change after step 4?**
Snaps measure deceptively. Each app has 1–3 retained revisions. Setting `refresh.retain=2` only matters going forward — `snap remove --revision <old>` is what actually frees disk *now*. Run a second time after a week of `snap refresh` activity.

**`vm.drop_caches=3` — is that dangerous?**
No. The page cache is rebuilt automatically on next read. The kernel docs explicitly support this as a debugging / benchmarking tool. The only impact is your next disk-bound program is a tiny bit slower until the cache re-warms. Skip step 7 if you're benchmarking.

**My init is `runit` / `s6` / `OpenRC`, not `systemd`.**
Step 3 (journal vacuum) is skipped on non-systemd inits with `· journalctl not present`.

**Can I dry-run `--system`?**
Not in v1.3.0. The closest is `--scan`, which estimates apt cache + journal + snap revision sizes without touching them.

---

## See also

- [All-safe](./all-safe.md) — the user-space counterpart, explicitly excludes sudo for cron-safety
- [Walkthrough](./walkthrough.md) — `--system` is offered as the optional Step 9
- [Safety](../safety.md#guard-4--sudo-confinement) — why the script's sudo use is narrowly scoped
- [Exit codes](../reference/exit-codes.md)

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
