# Editor extensions cleanup (`--editor-ext`)

> Removes superseded VS Code and Cursor extension versions when a newer version exists *and* the older version's directory has been idle ≥ N days. The two-condition gate (newer-exists + stale) keeps recently-loaded older versions safe.

**Type**: cleanup mode (interactive, staleness-gated)
**Run**: `linux-cleanup --editor-ext`
**Touches personal data**: only the editor's extension directories — never your code, never your settings
**Modifies editor state**: superseded version directories are removed; current version stays intact

---

## What it does

VS Code (and its forks like Cursor) keeps every extension version it has ever installed under `~/.vscode/extensions/<publisher>.<name>-<version>/`. When you update an extension, the new version directory is added; the *old* one stays on disk indefinitely. Over years, this accumulates.

`--editor-ext` walks both editor's extension dirs:

- VS Code: `~/.vscode/extensions/`
- Cursor: `~/.cursor/extensions/`

Groups by `<publisher>.<name>`. Within each group, identifies the highest semver as "current". Marks the rest as candidates — but only deletes them when both:

1. The current (highest) version exists and is the current install, AND
2. Every superseded version directory has `mtime` ≥ `--days N` days old (default 100).

```
── Editor extension cleanup (≥100d idle) ──

VS Code
  ✓ ms-python.python              4 versions  →  keep 2024.4.0, remove 3 superseded (idle 142d, 188d, 240d)   312 MB
  ✓ esbenp.prettier-vscode        3 versions  →  keep 11.0.0,  remove 2 superseded (idle 121d, 168d)            48 MB
  · dbaeumer.vscode-eslint        2 versions  →  superseded version idle only 12d, kept

Cursor
  · (no superseded versions ≥100d)

  Delete 5 superseded extension directories totalling 360 MB? [y/N]
```

Single yes/no — the prompt batches per editor.

---

## Why staleness AND newer-version-exists

The "newer exists" check covers the common case: you updated to v2 of an extension, so v1 is dead weight. But occasionally an update breaks something and you've manually re-pinned to the older version — its directory's `mtime` updates because the editor reloads it on every launch. The staleness gate (`mtime ≥ N days`) catches this case: a recently-loaded older version is *not* dead weight, and the cleanup leaves it alone.

This was added in v1.2.1 after a v1.2.0 user reported losing a recently-pinned older version of an extension.

---

## What it will NOT delete

- The current version of any extension.
- Older versions whose `mtime` is within `--days N`.
- Any extension where the current version is missing (could indicate broken install — left alone).
- Extensions installed via `code --install-extension` from a `.vsix` you downloaded — same logic; no special-casing.
- Settings, keybindings, snippets, themes, workspace state — these are in `~/.config/Code/User/` and never touched.

---

## When to use it

- **VS Code feels slow or boots slowly** — fewer extension directories means fewer to scan on startup.
- **You're imaging a dev VM** and want to trim editor state.
- **`~/.vscode/extensions/` is showing up in `--audit`** as a top-20 disk hog.
- **After upgrading several extensions** in a single day and wanting to clean superseded versions.

For a daily / cron-friendly run, this is included in `--all-safe` automatically (with the same staleness gate). Running `--editor-ext` directly is for the case where you want to see the per-extension breakdown.

---

## FAQ

**Will this break my workspace?**
No. VS Code reads from the *current* (highest) version of each extension. Removing older sibling directories is invisible to the editor.

**My extension misbehaves after a `--editor-ext` run.**
Reload the window (`Cmd/Ctrl+Shift+P → Developer: Reload Window`). If still broken, reinstall the extension (`code --uninstall-extension <id> && code --install-extension <id>`). The cleanup did not touch your settings; only directory siblings.

**What about JetBrains, Cursor, Zed, Sublime, Vim plugins?**
- Cursor: yes, supported (forks VS Code's extension model).
- JetBrains IDEs: not supported in v1.3.0 — JetBrains plugins live in `~/.cache/JetBrains/<IDE>/plugins/` and have a different versioning scheme.
- Zed / Sublime / Vim: not supported. Their plugin systems don't keep multiple installed versions side-by-side, so there's nothing to clean.

**Why is "kept" a possible verdict for stale superseded versions?**
A superseded version that's still inside the staleness window (e.g., idle only 12 days) is kept because the user might have manually re-loaded it recently. After 100 days of true non-use, the cleanup picks it up.

---

## See also

- [All-safe](./all-safe.md) — includes this category automatically (same gate)
- [Walkthrough](./walkthrough.md) — Step 5 is `--editor-ext`
- [Safety](../safety.md#guard-2--staleness-gate-default--100-days-since-120) — staleness gate rationale

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
