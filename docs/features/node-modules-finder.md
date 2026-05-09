# Stale `node_modules` finder (`--node-modules`)

> Finds `node_modules/` directories inside your project trees that haven't been touched in N+ days, presents them as a sized list, and offers to delete them one-by-one. Interactive only.

**Type**: cleanup mode (interactive, project)
**Run**: `linux-cleanup --node-modules` (optionally `-d N`)
**Touches personal data**: indirectly — `node_modules/` is regenerable via `yarn install` / `npm install`, but the *project* is yours
**Cannot be automated**: by design

---

## What it does

Walks a configured set of "project roots" (default: `~/code`, `~/projects`, `~/Documents/projects` if it exists, plus any roots you've added) looking for `node_modules/` directories where:

- The `node_modules/` directory's `mtime` is older than `--days N` (default 100), AND
- The *parent project* (the directory containing `node_modules/`) has not been modified in the same window, AND
- The path is not on the [protected allowlist](../safety.md).

Each candidate is presented with size and idle days:

```
── Stale node_modules — projects untouched ≥100d ──

  [1/12]  ~/code/old-side-project
          node_modules: 412 MB    project last touched: 384 days ago

          Delete node_modules? [y/N/a]
```

`y / n / a / q` controls — same as other interactive modes.

---

## When to use it

- **Yearly storage cleanup.** Old side projects accumulate huge `node_modules/`. Cleaning them is a single `yarn install` away from being restored.
- **Before backing up your code directory.** `node_modules/` is the largest non-essential thing in any web project.
- **After cloning a lot of repos.** `git clone` doesn't ship `node_modules/`, but `yarn install` does — a year later, those installs are usually obsolete.

For active projects you're working on right now, this mode won't list them — the staleness check filters them out. If you want to wipe an active project's `node_modules/` to force a clean re-install, do it manually: `rm -rf node_modules && yarn install`.

---

## Configuring project roots

On first run, the tool checks for the default roots. If none exist, it prompts:

```
No project roots found. Add one now? (e.g., /home/you/code)
→
```

Your answer is appended to `~/.config/linux-cleanup/project-roots.txt`. To add more later, just edit that file (one path per line).

To **add** a root permanently:

```bash
echo "$HOME/work" >> ~/.config/linux-cleanup/project-roots.txt
```

---

## What it filters out

- Active projects (parent directory modified within `--days N`).
- `node_modules/` inside `node_modules/` (nested deps — tracked by the outer `node_modules/`'s size).
- Projects on a non-default branch where the lockfile has changed recently (treated as active).
- Symlinked `node_modules/` (`pnpm` style) — the symlink is followed for size, the underlying store is **not** deleted by this mode. Use [`--all-safe`](./all-safe.md) which targets `~/.local/share/pnpm/store` directly.

---

## What it will NOT delete

- `node_modules/` outside your configured project roots.
- Anything in `~/Documents` (allowlist guard) unless you explicitly added it as a project root *and* its `node_modules/` ancestor is below `~/Documents/projects/<thing>/node_modules`.
- Active projects.
- Anything you press `n` on.

---

## Recovery

```bash
cd ~/code/old-side-project
yarn install        # or npm install / pnpm install — depends on the lockfile
```

That's it. `node_modules/` is, by design, derivable from the lockfile. If a project is unrecoverable without its `node_modules/`, the project itself is broken; deleting `node_modules/` simply made the breakage visible.

---

## FAQ

**It listed a project I'm actively working on.**
Shouldn't happen — the staleness gate excludes recently-modified parents. If it did, [send a bug report](../how-to/send-a-bug-report.md) with the log; it's likely a corner case in `mtime` propagation (e.g., a CI commit-bot bumped the parent dir but no human touched it).

**Why doesn't it just delete every `node_modules/` it finds?**
That would break active projects. The staleness gate is the whole point. Use `find ~ -name node_modules -type d -exec rm -rf {} +` if you want the unsafe nuke option, but you wouldn't be reading this doc if that's what you wanted.

**Can it run alongside `pnpm`-style content-addressable stores?**
Yes. The mode targets per-project `node_modules/` trees only. The pnpm shared store lives at `~/.local/share/pnpm/store` and is handled by [`--all-safe`](./all-safe.md) and [package-manager caches](./all-safe.md#what-it-does) — separately, with its own staleness gate.

**Does it understand workspaces / monorepos?**
Yes — a yarn / pnpm / npm workspace's outer `node_modules/` is treated as the candidate; the staleness check uses the entire monorepo's `mtime`, not a single package's.

---

## See also

- [All-safe](./all-safe.md) — wipes pnpm shared store + yarn/npm caches; the *complement* to this mode
- [Stale personal files](./personal-stale-files.md) — for non-project folders
- [Globals audit](./globals-audit.md) — for global `npm`/`pnpm`/`yarn`/`bun`/`deno` installs
- [Safety](../safety.md) — staleness-gate rationale

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
