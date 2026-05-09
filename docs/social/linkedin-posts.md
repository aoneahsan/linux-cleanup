# LinkedIn Posts — `linux-cleanup`

> 10 ready-to-publish posts. Each is under 2,900 characters.
> Pick one per week, or rotate angles. Edit the CTA link if you publish before npm propagates.

---

## Post 1 — The "where did my disk go?" hook - USED

My laptop kept yelling "Disk almost full."

I hadn't downloaded anything large in weeks.

So I wrote a tool to find out where the space actually went.

The answer wasn't movies, photos, or even Docker.

It was:
• Yarn / npm / pnpm caches I forgot existed
• Chrome, Firefox and Brave caches across 3 profiles
• Gradle build caches from an Android project I shipped last year
• Cypress + Playwright binary caches
• `node_modules` in 40+ project folders I hadn't touched in months
• Old kernels and snap revisions Ubuntu never cleaned up
• Half-finished downloads (`.crdownload`, `.part`, `.fdmdownload`) sitting in Downloads

I built `linux-cleanup` to find and clear all of it — safely, transparently, and only with my permission.

Run it with zero install:

  npx linux-cleanup

It walks you through 10 categories. Each step asks before deleting anything. You see exactly how many bytes you've reclaimed in real time. A JSON report is written at the end so you know what happened.

No GUI. No "one big red button." No telemetry.

If you live on Linux and write code, give it a try.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#Linux #DeveloperTools #OpenSource #DevOps

---

## Post 2 — Safety-first framing - USED

A dangerous category of "cleaner" tools exists on Linux:

The kind with one big button that wipes "everything you don't need."

These tools have deleted people's SSH keys, GPG keyrings, browser bookmarks, and home-folder configs. Real reports. Real data loss.

I refuse to ship that.

`linux-cleanup` takes the opposite approach:

→ **Allowlist-based safety.** Its `safe_rm` function refuses to touch anything inside `~/Documents`, `~/Pictures`, `~/Music`, `~/Videos`, `~/.ssh`, `~/.gnupg`, `~/.config`, `/etc`, `/boot`, `/usr`, or bare `$HOME`. The check is hard-coded. No flag can override it.

→ **Personal data is interactive only.** Stale-file scans never auto-delete. There is no `--yes` for personal files. Ever.

→ **Self-test mode** (`--self-test`) verifies dependencies, syntax, and safety guards before you run a real cleanup.

→ **Read-only scan mode** (`--scan`) shows you what's reclaimable without touching anything.

→ **JSON session reports** so you can audit every run after the fact.

The whole thing is a Bash script. You can read it. You can fork it. You can audit it line by line.

  npx linux-cleanup --scan

That's the safest first command. Try it.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#Linux #OpenSource #DeveloperExperience #Cybersecurity

---

## Post 3 — The npx angle (zero-install demo)

The friction of installing "yet another CLI tool" is real.

So `linux-cleanup` runs without installing:

  npx linux-cleanup

That's it. npx fetches it, runs the guided walkthrough, and you can choose what to clean.

What gets persisted? Only your logs and JSON session reports — and those live at `~/.linux-cleanup/`, not in the npx temp dir. So they survive npx cache eviction and are there next time.

If you want a permanent install:

  npm install -g linux-cleanup
  linux-cleanup

Either way, no compilation, no system packages, no PPA, no curl-pipe-bash.

Tested on Ubuntu, Pop!_OS, Linux Mint, and Debian-derived distros. Should work anywhere with Bash 4+ and Node 14+.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#NodeJS #Linux #CLI #DeveloperTools

---

## Post 4 — Stale `node_modules` story

I have one folder: `~/Documents/01-code/projects/`.

Inside it are about 60 project folders. Maybe 8 are active. The rest are paused, archived, or "I'll come back to that."

Every one of them has a `node_modules` folder. Some are 800 MB.

I added a flag for this:

  linux-cleanup --node-modules -d 60

It scans your project roots, finds every `node_modules` directory whose parent project hasn't been touched in 60+ days, and offers to delete them — one by one, with the size shown, with your explicit yes/no for each.

Reinstall is one `yarn` away when you actually return to the project.

For me, that single command reclaimed more than every browser cache combined.

If your `~/Documents` looks anything like mine, try it:

  npx linux-cleanup --node-modules -d 60

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#JavaScript #NodeJS #WebDev #Linux

---

## Post 5 — JSON reports + auditability

Most cleanup tools delete things and tell you "Done!"

That's not enough.

Every run of `linux-cleanup` produces a JSON session report:

• Schema-versioned
• Lists every category run
• Records bytes reclaimed per category
• Records the running total
• Saved to `~/.linux-cleanup/reports/`

You can list them:

  linux-cleanup --reports

Or export to Markdown / HTML for sharing or archiving:

  linux-cleanup --export both latest
  linux-cleanup --export html all

Why does this matter?

Because if a regression happens — "wait, where did that file go?" — you have a paper trail. You can see exactly what was cleared, when, and how much was reclaimed.

This is the kind of transparency I wish more system tools had.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#OpenSource #DeveloperTools #Linux #Observability

---

## Post 6 — Weekly cron, set-and-forget

Most disk-fill problems aren't from a single moment.

They're from accumulation. A few hundred MB a day. Over weeks. Over months.

`linux-cleanup` ships with a one-line installer for a weekly cron:

  linux-cleanup --install-cron

That schedules an `--all-safe` run every Sunday at 03:00. It only touches regenerable caches. It never touches personal files. It logs to `~/.linux-cleanup/cron.log`.

To remove it:

  linux-cleanup --uninstall-cron

Or, if you prefer to keep things manual but want a shorter command:

  linux-cleanup --install-alias

…adds a `cleanup` alias to your `.bash_aliases` / `.zshrc`.

Both are uninstalls are clean. No leftover files. No surprises.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#Linux #Automation #DeveloperProductivity #DevOps

---

## Post 7 — Dev caches you forgot about

A non-exhaustive list of caches sitting on your dev machine right now:

• Yarn cache: `~/.cache/yarn`
• npm cache: `~/.npm`
• pnpm store: `~/.local/share/pnpm/store`
• Composer cache: `~/.cache/composer`
• pip cache: `~/.cache/pip`
• Gradle: `~/.gradle/caches`
• Cypress binaries: `~/.cache/Cypress`
• Playwright browsers: `~/.cache/ms-playwright`
• TypeScript watcher: `~/.cache/typescript`
• Flutter pub cache: `~/.pub-cache`
• Dart analysis server: `~/.dartServer`
• Android emulator images: `~/.android/avd`
• VS Code old extension versions: `~/.vscode/extensions`
• Cursor old extension versions: `~/.cursor/extensions`
• Brave/Chrome/Firefox/Chromium/Edge/Vivaldi caches across every profile
• Snap revisions Ubuntu doesn't auto-prune
• Old kernels apt didn't autoremove

`linux-cleanup` knows about all of these. Run a read-only audit:

  npx linux-cleanup --scan

You'll be surprised. I was.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#WebDev #MobileDev #Linux #DeveloperTools

---

## Post 8 — Modular by design

I built `linux-cleanup` modular on purpose.

The walkthrough is 10 categories. You can also jump straight to the one you need:

  linux-cleanup --node-modules     # stale project node_modules
  linux-cleanup --editor-ext       # superseded VS Code / Cursor extensions
  linux-cleanup --partials         # orphan .crdownload, .part, .fdmdownload
  linux-cleanup --audit            # top 20 largest entries in $HOME
  linux-cleanup --system           # apt, journal, snap, kernels, /tmp, page cache
  linux-cleanup --list-targets     # print every path the script can touch

The last one is my favorite. Before you trust any cleanup tool, you should be able to ask: "What can you actually touch?"

`linux-cleanup --list-targets` answers that. No code reading required.

That's the level of transparency I think system tools should default to.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#OpenSource #Linux #SoftwareEngineering #CLI

---

## Post 9 — A note on what it does NOT do

Honest framing matters more than features.

`linux-cleanup` does NOT:

✗ Delete anything in your home folder without asking (personal data is always interactive)
✗ Send telemetry, analytics, or crash reports anywhere
✗ Touch `/etc`, `/boot`, `/usr`, `~/.ssh`, `~/.gnupg`, `~/.config`, or `~/.claude`
✗ Promise a specific GB number — your reclaim depends entirely on what's on your machine
✗ Work on macOS or Windows (Linux only — the paths and tooling are Linux-specific)
✗ Replace BleachBit if you need a GUI
✗ Replace `apt autoremove` — it wraps it, with prompts

What it does is give a developer a single, scriptable, transparent entry point to reclaim regenerable junk on a Linux dev machine.

If that's what you need, you'll like it. If you need a one-button GUI, you won't, and that's fine.

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

#Linux #OpenSource #DeveloperExperience

---

## Post 10 — The license + ethos

I shipped `linux-cleanup` under a Source-Available, No-Derivatives, Non-Commercial license.

You can:

✓ Read every line of the source
✓ Run it on your own machines, including at work
✓ Audit it, fork it for personal study
✓ Open issues, ask questions

You cannot:

✗ Repackage it under a different name
✗ Sell it or bundle it into a paid product
✗ Ship modified forks publicly

This is intentional. Cleanup tools touch real data. Multiple unmaintained forks make that more dangerous, not less. Centralizing maintenance is how I keep the safety guards trustworthy.

If you want a feature added, file an issue. If you want commercial use, email me. The code is here:

GitHub: https://github.com/aoneahsan/linux-cleanup
npm: https://npmjs.com/package/linux-cleanup

  npx linux-cleanup --scan

Try the read-only scan first. Decide for yourself.

#OpenSource #SoftwareEngineering #Linux #DeveloperTools
