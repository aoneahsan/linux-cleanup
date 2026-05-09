# Home audit (`--audit`)

> A read-only "where is my disk going?" answer. Prints the top 20 largest entries directly under `$HOME`, sorted by size, with a `du -sh` total per entry.

**Type**: inspection mode (read-only)
**Run**: `linux-cleanup --audit`
**Touches personal data**: never
**Modifies the filesystem**: no

---

## What it does

Runs `du -sh $HOME/*` (with hidden-files variant) and prints the 20 largest entries in descending size order:

```
── Top 20 largest entries in $HOME ──

  18.3 GB   .cache/
  12.1 GB   .npm/
   9.4 GB   .gradle/
   8.6 GB   .android/
   6.2 GB   code/
   4.8 GB   .local/
   3.7 GB   Downloads/
   3.1 GB   .mozilla/
   2.8 GB   .vscode/
   2.4 GB   .config/
   1.6 GB   .docker/
   1.3 GB   snap/
   …
```

That's it. No deletions, no prompts, no JSON report — `--audit` is a one-shot orientation tool.

---

## When to use it

- **You don't know what's eating disk.** This is the fastest "where do I even start?" answer.
- **Before a serious cleanup.** Spot a category that linux-cleanup *doesn't* know about (e.g., a bespoke `~/datasets/` folder you fill with scrap data).
- **After a cleanup.** Re-run to confirm the big hitters dropped.

For a deeper category-by-category breakdown of *reclaimable* junk specifically, use [`--scan`](./scan.md) instead.

---

## Why only 20

Twenty is enough to cover the obvious offenders without becoming a wall of text. If you want everything, run `du -sh $HOME/*` directly and pipe it through `sort -h` — `--audit` is a convenience, not a `du` replacement.

---

## What it does NOT do

- Does not descend into protected paths in any unusual way — `du` reads sizes, the script does not delete anything.
- Does not call `sudo`. Files you don't own (rare in `$HOME`) may show as `0 B` if `du` can't read them.
- Does not touch the JSON report. If you want a structured record, use `--scan` and the report shows the same information plus reclaim estimates.

---

## See also

- [Scan](./scan.md) — same orientation, but with reclaim-estimate breakdown per category
- [Stale personal files](./personal-stale-files.md) — once `--audit` shows `~/Downloads` is huge, use this to clean it
- [Stale `node_modules`](./node-modules-finder.md) — once `--audit` shows `~/code/` is huge, use this

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
