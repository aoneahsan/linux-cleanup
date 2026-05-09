# Partial / orphan downloads (`--partials`)

> Interactive cleanup of half-finished download files: `*.fdmdownload` (Free Download Manager), `*.crdownload` (Chrome / Brave / Edge), `*.part` (Firefox, generic). These accumulate when downloads are cancelled, fail, or the browser crashes mid-transfer.

**Type**: cleanup mode (interactive)
**Run**: `linux-cleanup --partials`
**Touches personal data**: yes — partial downloads in `~/Downloads`. Interactive-only.

---

## What it does

Scans `~/Downloads` (and any extra personal roots you've configured) for files matching:

- `*.fdmdownload`  ← Free Download Manager
- `*.crdownload`   ← Chromium-family browsers (Chrome, Brave, Edge, Vivaldi, Opera)
- `*.part`         ← Firefox, plus a few generic downloaders
- `*.partial`      ← some Windows-origin downloaders
- `.~lock.*#`      ← LibreOffice lockfiles (orphaned only)

For each candidate it prints size, age, and asks once:

```
── Partial / orphan downloads ──

  ~/Downloads/ubuntu-22.04.iso.crdownload
  3.2 GB    age 47 days    Chrome partial download

  Delete? [y/N]
```

Same `y / n / a / q` controls as the [stale personal files](./personal-stale-files.md) scan.

---

## Why these are usually safe to delete

By definition, a `.crdownload` / `.fdmdownload` / `.part` file is the *incomplete* portion of an interrupted download. The browser or downloader that wrote it has either:

- Forgotten about it (browser closed mid-download, no resume state survived).
- Marked the download as failed in its own UI but left the bytes on disk.
- Had its parent process killed.

In rare cases (mostly Free Download Manager) the partial *can* be resumed — but only if the downloader's metadata is also intact. If you're not actively trying to resume a known download, the partial is safe to remove.

---

## What it will NOT delete

- Files **without** the recognised extensions, even in `~/Downloads`. For those, use [stale personal files](./personal-stale-files.md).
- Files inside protected paths like `~/Documents` (allowlist guard).
- Anything you press `n` on.
- Files **less than 24 hours old** by default — they might be an active download. The 24-hour minimum can't be overridden in v1.3.0.

---

## Typical reclaim

| Browser / downloader | Typical leftover |
|---|---|
| Chrome (`.crdownload`) | 200 MB – 5 GB across a few files |
| Free Download Manager (`.fdmdownload`) | 1–20 GB if FDM is your daily driver |
| Firefox (`.part`) | usually <500 MB |

A user who never thinks about `~/Downloads` typically has 2–10 GB of partials at any given time.

---

## FAQ

**Will this delete my actually-downloading file?**
No — files modified within the last 24 hours are excluded. If your download is older than that and still going, your downloader's resume state is the only thing keeping it alive; deleting the partial only matters if the downloader has already given up.

**Can I batch-confirm?**
No — same policy as all personal-data modes. One `y` per file (or `a` to abort all remaining; never to accept all remaining).

**My downloader is something niche (`aria2c`, `wget -c`, `curl -C`).**
Their resume state is in metadata files (`<file>.aria2`, `<file>.<hash>`), not in well-known extensions. The `--partials` mode won't list them and won't delete them. If you have many old `aria2` partials, see them via [home audit](./home-audit.md) or `find ~ -name '*.aria2' -atime +30`.

**Why include LibreOffice lockfiles?**
`.~lock.<filename>#` files appear when LibreOffice opens a document and survive a crash. Orphaned ones (where the parent doc still exists, but the lock is older than the doc's last-modified time) confuse subsequent opens. Removing them is safe; the next LibreOffice open re-creates a fresh lock.

---

## See also

- [Stale personal files](./personal-stale-files.md) — non-partial files you've forgotten about
- [Home audit](./home-audit.md) — top-20 largest entries, useful for spotting the *folder* a partial lives in
- [Safety](../safety.md) — why personal modes are interactive-only

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan) · [GitHub](https://github.com/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
