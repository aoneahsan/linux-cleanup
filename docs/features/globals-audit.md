# Global packages audit (`--globals`)

> **Read-only** audit of globally-installed npm, pnpm, yarn, bun, and deno packages. Reports which globals you have, which are stale (no dependents seen, no recent invocation), and points you at the manual remove command. Never deletes for you.

**Type**: inspection mode (read-only)
**Run**: `linux-cleanup --globals`
**Touches personal data**: never
**Modifies the filesystem**: no

---

## Why read-only

Global package removal is genuinely high-stakes. A globally-installed `eslint`, `tsc`, `prettier`, or `wrangler` may be referenced by unrelated scripts, IDE integrations, or muscle memory across years. Auto-removing a stale global is the kind of operation that leaves users typing `command not found` on a Monday morning with no clue why.

The tool reports — and prints the exact removal command for you to run by hand. That's it.

---

## What it shows

```
── Global package audit (read-only) ──

npm globals (5)
  ✓ pnpm                    9.10.0   used 2 days ago    (kept)
  ✓ wrangler                3.45.0   used 7 days ago    (kept)
  · http-server             14.1.1   never invoked      (candidate)
  · jshint                  2.13.5   not invoked ≥365d  (candidate)
  · gulp-cli                3.0.0    not invoked ≥365d  (candidate)

pnpm globals (2)
  ✓ pnpm                    9.10.0   used 2 days ago    (kept)
  · @anthropic-ai/cli       0.18.0   not invoked ≥120d  (candidate)

yarn globals (0)
  · (no global packages found)

bun globals (1)
  ✓ bun                     1.1.30   used 1 day ago    (kept)

deno globals (1)
  · deployctl               1.12.0   not invoked ≥200d  (candidate)

──────────────────────────────────────────────────────────────────────────────
To remove a candidate manually:
  npm uninstall -g http-server
  npm uninstall -g jshint
  npm uninstall -g gulp-cli
  pnpm rm -g @anthropic-ai/cli
  deno uninstall deployctl
```

Copy-paste the lines you want, hit enter, done.

---

## How "stale" is determined

For each global package, the audit checks (in order):

1. **Recent invocation?** Last `mtime` on the global's bin shim (e.g., `~/.local/share/npm/bin/eslint`). Bin shims are touched by every invocation on most Linux setups.
2. **Has any project depended on it recently?** Scans configured [project roots](./node-modules-finder.md#configuring-project-roots) for `package.json` entries that reference the global by name. Only counts projects modified in the last `--days N` window.
3. **In `$PATH` and shadowed by a project's local install?** A common reason a global is "never invoked" is that every project ships its own `node_modules/.bin/<tool>` and the global is dead weight. The audit flags this case explicitly.

If none of (1), (2), (3) put the package in active use within `--days N` (default 100), it's tagged as a candidate.

---

## When to use it

- **Quarterly hygiene** of your global install pile, especially if you've been using the same machine for years.
- **Before reinstalling Node / setting up a new machine**, to decide which globals are worth re-installing on the new box.
- **Diagnosing PATH conflicts** where a global is shadowing a project-local tool. The audit's "shadowed by local install" line surfaces this directly.

Pair it with [`--doctor`](./doctor.md) if you suspect your shell init is missing or sourcing things in the wrong order.

---

## What it doesn't do

- Does **not** uninstall anything.
- Does **not** modify your `PATH`.
- Does **not** call any registry. The audit is fully offline — version numbers come from local install metadata.
- Does **not** track invocations going forward (no shim wrapping, no shell hook).

---

## FAQ

**Why doesn't it just `npm uninstall -g` for me?**
See "Why read-only" above. Removing globals is the operation most likely to break a workflow days later. The script gives you the exact commands; you're one paste away from running them.

**`npm root -g` is empty but I have globals — what gives?**
You're using `nvm`, `volta`, `fnm`, or another Node version manager that scopes globals per-Node-version. The audit handles this — it walks the active version manager's prefix. If you switch Node versions, your globals are different; that's correct behaviour, not a bug.

**It missed a global I just installed.**
The bin-shim `mtime` heuristic uses install time as a fallback. If you installed a tool but never invoked it, it correctly shows `never invoked`. That's not a bug — it's a candidate.

**Does it work with `bun install -g` and `deno install`?**
Yes — both are detected from their default install dirs (`~/.bun/bin`, `~/.deno/bin`). If you've moved them via `BUN_INSTALL` / `DENO_INSTALL`, the audit follows the env var.

---

## See also

- [Doctor](./doctor.md) — fixes the most common reason globals "don't work": shell init that doesn't source the version manager
- [Stale `node_modules`](./node-modules-finder.md) — same reasoning, scoped to projects
- [How-to: reclaim the most space](../how-to/reclaim-the-most-space.md)

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
