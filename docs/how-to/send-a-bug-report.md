# How to send a bug report

> Three minutes from "something's wrong" to "the author has everything needed to reproduce". The script does the bundling for you; you review and email.

---

## If the script just crashed

linux-cleanup already created the bundle for you. Look for the message that ended your session:

```
Crash bundle: /home/you/.linux-cleanup/feedback/crash-2026-05-10_142318.tar.gz
```

Skip to **Step 2 — Review the bundle**.

---

## If the script ran but did something wrong

```bash
# 1. Package the latest log + report into a tar.gz
linux-cleanup --debug-bundle
# → ~/.linux-cleanup/feedback/debug-bundle-<timestamp>.tar.gz

# 2. (Optional) Open a pre-filled mailto draft
linux-cleanup --feedback
```

`--feedback` prints what to include in your description and offers to open a `mailto:` draft in your default mail client. The draft body is auto-filled with system info (tool version, distro, kernel, bash). You write the description above the auto-filled section.

---

## Step 2 — Review the bundle (mandatory)

**Always inspect what you're about to send.** Bundles contain `$HOME` paths from your machine.

```bash
# Where is it?
ls -la ~/.linux-cleanup/feedback/

# What's inside?
tar -tzf ~/.linux-cleanup/feedback/<bundle-name>.tar.gz

# Read the manifest
mkdir /tmp/lc-review && cd /tmp/lc-review
tar -xzf ~/.linux-cleanup/feedback/<bundle-name>.tar.gz
cat MANIFEST.txt        # or CRASH_MANIFEST.txt for crash bundles
less cleanup-*.log
jq . report-*.json | less
```

What's in there:

| File | What it shows |
|---|---|
| `MANIFEST.txt` / `CRASH_MANIFEST.txt` | Distro, kernel, bash version, mode that ran, exit code (if crash), self-test output |
| `cleanup-*.log` | Full session output as you saw it on screen |
| `report-*.json` | Per-category candidate paths, sizes, and verdicts |

What's **not** in there:

- File contents (the script never reads file contents).
- Credentials, env vars, shell history.
- Anything outside `$HOME` that wasn't a `du` size of a system path.

---

## Step 3 — Write the description

Useful descriptions answer four questions:

1. **What command did you run?** Verbatim, including flags.
2. **What did you expect?** One sentence.
3. **What actually happened?** One sentence.
4. **Anything unusual about your setup?** Custom shell, exotic distro, unusual path, weird filesystem. Often the smoking gun.

Skip:

- Apologies (no need)
- Reproduction steps the script's log already captures
- Screenshots — the log is more useful

Include:

- Your subjective sense of severity ("annoyance" vs "data-loss-near-miss")
- Whether you can reproduce it deterministically

---

## Step 4 — Email

Send the bundle as an attachment to **[aoneahsan@gmail.com](mailto:aoneahsan@gmail.com)**. Subject line that helps me triage:

- `linux-cleanup v1.3.0 — bug: <one-line summary>`
- `linux-cleanup v1.3.0 — feature request: <one-line summary>`
- `linux-cleanup v1.3.0 — crash on <action>` (when the bundle is a crash bundle)

I read every email. Response is usually within a few business days.

---

## What happens next

The author will:

1. Open the bundle and read the manifest.
2. Reproduce locally if your description has enough detail.
3. Push a fix in a future release if the bug is real and reproducible.
4. Reply with either "fixed in v1.3.x, please re-pull" or "couldn't reproduce — could you run X and share the result?".

The author cannot:

- See your bundle unless you send it.
- Push a fix to your machine — releases go out via npm; you re-pull when convenient (`npm install -g linux-cleanup@latest`).
- Accept code contributions (the LICENSE prohibits derivative works). Description-only feature requests are very welcome.

---

## Privacy

Sending the bundle is your decision. The tool never uploads anything for you. If your environment requires it, encrypt the bundle (`gpg -c bundle.tar.gz`) before emailing. The author's GPG key is on [keys.openpgp.org](https://keys.openpgp.org) if you need it — search for `aoneahsan@gmail.com`.

---

## See also

- [Feedback & crash bundles](../features/feedback-and-crash-bundles.md) — full design of the three feedback paths
- [Troubleshooting](../troubleshooting.md) — for symptoms that don't need a bug report yet
- [About the author](../about-the-author.md) — who you're writing to

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) · [LinkedIn](https://linkedin.com/in/aoneahsan)
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
