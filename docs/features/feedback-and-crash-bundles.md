# Feedback & crash bundles (`--feedback`, `--debug-bundle`, automatic crash trap)

> linux-cleanup ships three feedback paths, in increasing order of automation: `--feedback` (mailto draft), `--debug-bundle` (manual tar.gz of latest log + report), and an automatic crash bundler that captures state when the script exits unexpectedly. **No telemetry — nothing leaves your machine until you choose to email it.**

**Type**: feedback / diagnostic
**Modes**: `--feedback`, `--debug-bundle`; the crash trap is always armed
**Touches**: only `~/.linux-cleanup/feedback/` (creates tar.gz files); does not call any network endpoint

---

## The three paths

| Path | Trigger | Use when |
|---|---|---|
| **`--feedback`** | You run it manually | You have an idea, a question, or a non-crash bug to report |
| **`--debug-bundle`** | You run it manually | You want to package the latest log + report into a single tar.gz to attach |
| **Auto crash bundle** | Script exits non-zero unexpectedly | Something blew up — the bundle is created for you |

All three end with: "review this, then email it to `aoneahsan@gmail.com`". Nothing is uploaded automatically. Ever.

---

## `--feedback`

```bash
linux-cleanup --feedback
```

Prints:

- Author contact (email, web, LinkedIn).
- A "what to include in your report" checklist (distro, bash version, tool version, exact command, expected vs actual).
- A pointer to `--debug-bundle` for the easy-mode log packaging.
- A reminder that the tool makes **no network calls** — privacy guarantee in plain language.
- An offer to open a **pre-filled `mailto:` draft** in your default mail client (via `xdg-open`). The draft body includes auto-filled system info: tool version, distro, kernel, bash. You add the description above the auto-filled section before sending.

Decline the mailto offer and you can copy-paste the address yourself.

---

## `--debug-bundle`

```bash
linux-cleanup --debug-bundle
```

Creates `~/.linux-cleanup/feedback/debug-bundle-<timestamp>.tar.gz` containing:

| File | Source |
|---|---|
| `MANIFEST.txt` | System info (distro, kernel, bash version, node, jq) + linux-cleanup self-test output + privacy note |
| `cleanup-<timestamp>.log` | The most-recent session log |
| `report-<timestamp>.json` | The most-recent JSON session report (if any) |

Output:

```
✓ Bundle created: /home/you/.linux-cleanup/feedback/debug-bundle-2026-05-10_142318.tar.gz
  Size:   84 KB
! Review the bundle before sending — it contains $HOME paths + cache inventory.
  Extract to inspect:   tar -tzf /home/you/.linux-cleanup/feedback/debug-bundle-….tar.gz
  Send to:              aoneahsan@gmail.com
```

The bundle is plain `tar.gz` — open it with any archive manager, or `tar -tzf` / `tar -xzf` from the CLI. **Review every file before emailing it.** Logs and reports include `$HOME`-relative paths from your machine.

---

## Automatic crash bundle (v1.3.0+)

If the script exits unexpectedly — uncaught error, signal kill (other than `Ctrl-C`), syntax error, unset variable trip — an EXIT trap creates `~/.linux-cleanup/feedback/crash-<timestamp>.tar.gz` automatically and prints:

```
══════════════════════════════════════════════════════════════════════════════
  linux-cleanup exited unexpectedly (exit 137).
══════════════════════════════════════════════════════════════════════════════

  Crash bundle: /home/you/.linux-cleanup/feedback/crash-2026-05-10_142318.tar.gz
  Size:         48 KB

  Help the author fix this:
    1. Review the bundle (it contains $HOME paths from your machine).
       tar -tzf /home/you/.linux-cleanup/feedback/crash-….tar.gz
    2. Email it to aoneahsan@gmail.com
    3. Or run linux-cleanup --feedback for a pre-filled draft.

  Nothing was sent. linux-cleanup makes no network calls.
```

The bundle contents are similar to `--debug-bundle`, plus a `CRASH_MANIFEST.txt` with:

- The exit code
- The mode that was running
- A minimal system info snapshot

### When the crash trap is *not* triggered

Deliberately suppressed for:

- **Clean exit (code 0)** — nothing wrong, no bundle needed.
- **`Ctrl-C` (exit 130)** — user-initiated abort.
- **`SIGTERM` (exit 143)** — user-initiated abort.
- **Argument parse errors (exit 2)** — `--bogus-flag` shows usage and exits; no need to bundle.

For everything else (signal kills like `SIGKILL=137`, syntax errors during sourcing, unset-var trips, internal panics), the trap fires and the bundle is created.

### Privacy

The crash trap is a local file write only. There is no network code, no upload step, no automated submission. The bundle stays in `~/.linux-cleanup/feedback/` until you delete it or email it. The script's "no network calls" guarantee is preserved literally — `grep -r "curl\|wget\|http" cleanup.sh lib/ modules/` returns matches only inside this documentation and inside the `--feedback` mailto helper, never as live network code.

---

## Reading the manifest

Inside any `crash-*.tar.gz` or `debug-bundle-*.tar.gz`:

```bash
mkdir /tmp/lc-bundle && cd /tmp/lc-bundle
tar -xzf ~/.linux-cleanup/feedback/crash-2026-05-10_142318.tar.gz
cat CRASH_MANIFEST.txt    # or MANIFEST.txt for debug-bundle
less cleanup-*.log
jq . report-*.json | less
```

The manifest is the entry point — it tells you what happened, what's in the bundle, and how to send it.

---

## What the author can and cannot do

**Can:**

- Read your bundle and reproduce the issue if you've described what you expected.
- Push a fix in a future release. `npm install -g linux-cleanup@latest` (or rerun `npx`) pulls it.
- Acknowledge feedback by email, usually within a few business days.

**Cannot:**

- See your logs unless you send them.
- Push a fix to your machine — releases go out via npm; you re-pull when convenient.
- Accept code contributions (the [LICENSE](../../LICENSE) prohibits derivative works). Description-only feature requests are very welcome by email.

---

## What you should review before sending a bundle

Every bundle contains:

- `$HOME`-relative paths from your machine (e.g. `~/code/old-side-project/`)
- Cache directory sizes and last-used timestamps
- The mode you ran and the flags you passed
- For crash bundles: the exit code

Bundles do **not** contain:

- File contents of any kind (the script never reads file contents to log them; it only stat()s).
- Credentials, environment variables, or shell history.
- Anything outside `$HOME` that wasn't a `du` size of a system path the script measured.

But: an attacker who got hold of your bundle could learn what tools you have installed, which projects you've worked on recently, and how big they are. Treat the bundle like any other operational diagnostic — review before sending, prefer encrypted email if your environment requires it.

---

## FAQ

**Will the script ever auto-send a crash report?**
No. There is no network code in the crash trap. Auto-submission would violate the no-telemetry guarantee — and if I ever change that, it would be a major-version bump with a clearly-documented opt-in.

**Why a tarball instead of a JSON-only payload?**
Logs are line-oriented text and play badly with JSON-in-string encoding. The tar.gz is easy for the author to extract and review with normal tools; it's also what most bug-tracking workflows expect.

**Can I disable the crash trap?**
Not in v1.3.0. The trap is local-only and produces a single small file when triggered — there's no privacy or performance concern that warrants making it opt-out.

**The bundle is huge.**
Unusual. The crash bundle is normally <100 KB (manifest + a single log file + a JSON report). If yours is >10 MB, send it anyway — that's information about something unexpected.

**Where do I find old bundles?**
`ls -la ~/.linux-cleanup/feedback/`. Delete them with `rm` when no longer needed. The tool doesn't auto-clean this dir.

---

## See also

- [How-to: send a bug report](../how-to/send-a-bug-report.md) — the step-by-step recipe
- [Reports](./reports.md) — what's inside the JSON report attached to bundles
- [Safety](../safety.md) — why no-telemetry is a foundational design decision
- [Privacy section in README](../../README.md#privacy)

---

**Author**: [Ahsan Mahmood](https://aoneahsan.com) — author of linux-cleanup. Reach me directly at [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com), or [LinkedIn](https://linkedin.com/in/aoneahsan), or [GitHub](https://github.com/aoneahsan). I read every email.
**Last updated**: 2026-05-10 · **Tool version**: 1.3.1
