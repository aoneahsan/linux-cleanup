# How to uninstall

> Three steps depending on how you installed. Removes the tool, the alias, the cron entry, and (optionally) the local data directory.

---

## Step 1 — Remove the tool itself

### If you installed via `npm install -g`

```bash
npm uninstall -g linux-cleanup
```

### If you ran via `npx` (no install needed)

Nothing to do — `npx` cleans itself up. The package was never globally installed.

### If you cloned the git repo

```bash
rm -rf ~/linux-cleanup    # or wherever you cloned it
```

---

## Step 2 — Remove the alias and cron entry (if installed)

```bash
linux-cleanup --uninstall-alias    # remove `cleanup` shell alias
linux-cleanup --uninstall-cron     # remove the weekly cron entry
```

These work as long as `linux-cleanup` is still on your `PATH` — run them **before** Step 1 if you'd already installed via `npm -g`.

If the tool is already gone:

```bash
# Remove the alias manually
sed -i.bak '/# linux-cleanup tool/d; /alias cleanup=/d' ~/.bashrc ~/.zshrc ~/.bash_aliases 2>/dev/null

# Remove the cron entry manually
crontab -l 2>/dev/null | grep -v 'cleanup.sh' | crontab -
```

---

## Step 3 — Remove the data directory (optional)

linux-cleanup keeps your session logs, JSON reports, and any feedback / crash bundles at `~/.linux-cleanup/`. **These are not removed by Steps 1 or 2** — the assumption is that you may want to keep your audit trail.

To remove everything:

```bash
rm -rf ~/.linux-cleanup/
```

To remove only logs but keep reports:

```bash
rm -rf ~/.linux-cleanup/logs/
```

---

## Step 4 — Remove the personal-roots config (optional)

If you ever ran `--node-modules` or `-p` and added custom project / personal roots:

```bash
rm -f ~/.config/linux-cleanup/project-roots.txt
rm -f ~/.config/linux-cleanup/personal-roots.txt
rmdir ~/.config/linux-cleanup/ 2>/dev/null
```

---

## What stays

After a complete uninstall, **nothing** related to linux-cleanup remains on your machine. The tool never wrote outside the locations above. No system services, no `/etc/*` modifications, no kernel modules, no global PATH entries beyond what `npm install -g` adds (and `npm uninstall -g` removes).

---

## Re-install

```bash
npm install -g linux-cleanup           # global install
# or
npx linux-cleanup                      # zero-install run
```

Your previous reports survive the uninstall + reinstall cycle (since `~/.linux-cleanup/reports/` isn't auto-deleted). If you want a clean slate, run Step 3 too.

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.0
