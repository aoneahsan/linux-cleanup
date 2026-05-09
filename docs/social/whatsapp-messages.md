# WhatsApp Messages — `linux-cleanup`

> Short, punchy messages for sharing with dev friends, group chats, and statuses.
> Each is under 400 characters. Pick whichever fits the chat.

---

## 1 — The casual share

Yo — quick one. If you're on Linux and your disk is always near-full, try this:

  npx linux-cleanup --scan

Read-only. Just shows you what's reclaimable. Yarn caches, old node_modules, Chrome cache, Gradle, etc. I built it. Free, no install needed.

github.com/aoneahsan/linux-cleanup

---

## 2 — One-liner with hook

Reclaimed serious GB on my Linux laptop today. Wrote a tool for it:

  npx linux-cleanup

Walks you through 10 categories, asks before deleting anything, never touches personal files. 100% safe.

github.com/aoneahsan/linux-cleanup

---

## 3 — For dev group chats

Built something you might use 👇

`linux-cleanup` — a Bash CLI that finds and clears yarn/npm/pnpm caches, stale node_modules, Gradle, Cypress, Playwright, browser caches, old kernels, etc.

  npx linux-cleanup --scan

Read-only first. Try it.

github.com/aoneahsan/linux-cleanup

---

## 4 — Status / story format

Disk almost full?

→ npx linux-cleanup --scan

Tells you exactly what's eating your space. No install. Linux only. Free.

github.com/aoneahsan/linux-cleanup

---

## 5 — Direct DM

Hey — saw your laptop was complaining about disk space. Try this:

  npx linux-cleanup

It's a tool I made. Walks you through what to clean, asks before each step, never deletes personal stuff. Should free up tens of GB.

github.com/aoneahsan/linux-cleanup

---

## 6 — Pitch with proof points

New side project: `linux-cleanup`

✓ Allowlist-based safety (won't touch ~/Documents, ~/.ssh, etc)
✓ Per-step running totals
✓ JSON session reports
✓ Self-test mode

  npx linux-cleanup

github.com/aoneahsan/linux-cleanup

---

## 7 — Stale node_modules angle

If you've got a `~/projects` folder full of old code, this one command finds every `node_modules` you haven't touched in 60+ days:

  npx linux-cleanup --node-modules -d 60

Asks before deleting each. Reinstall is one yarn away.

github.com/aoneahsan/linux-cleanup

---

## 8 — System cleanup angle

Ubuntu / Debian disk filling up from old kernels and snap revisions?

  npx linux-cleanup --system

Wraps apt autoremove, journal vacuum, snap purge, /tmp aging. With prompts.

github.com/aoneahsan/linux-cleanup

---

## 9 — Short and friendly

Try this on your Linux box, you'll thank me:

  npx linux-cleanup --scan

Read-only audit. Shows what you can free up. Built it myself, free and open source.

github.com/aoneahsan/linux-cleanup

---

## 10 — Closer / call-to-action

Dropped a new tool: linux-cleanup.

For Linux devs whose machines collect cache junk faster than memes. Run it, see what's reclaimable, choose what to clear.

  npx linux-cleanup

Feedback welcome 🙏

github.com/aoneahsan/linux-cleanup
