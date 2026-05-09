# About the author

> linux-cleanup is built and maintained by **[Ahsan Mahmood](https://aoneahsan.com)** — independent senior software engineer specialising in safe-by-default developer tooling, full-stack web and mobile apps, and well-architected open-source utilities.

---

## Hi — I'm Ahsan

I'm a senior software engineer based in Lahore, Pakistan, with a decade of professional experience across web (React, Next.js, TanStack), mobile (Capacitor, React Native, Flutter), backend (Node.js, Firebase, Cloudflare Workers, Laravel), and developer tooling. I build for clarity, reliability, and the kind of small details that separate a tool you tolerate from a tool you trust.

linux-cleanup is one of those tools — built because I needed it on my own machines, then polished into something I'd give to teammates without hand-holding.

---

## Where to find me

| Where | Link | What you'll find |
|---|---|---|
| **Portfolio** | [aoneahsan.com](https://aoneahsan.com) | Project showcase, services, hire me |
| **Email** | [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com) | Direct contact — I read every email |
| **WhatsApp** | [+92 304 6619706](https://wa.me/923046619706) | Fast async chat |
| **LinkedIn** | [linkedin.com/in/aoneahsan](https://linkedin.com/in/aoneahsan) | Professional network, work history, recommendations |
| **GitHub** | [github.com/aoneahsan](https://github.com/aoneahsan) | Open-source projects, this tool's source |
| **npm** | [npmjs.com/~aoneahsan](https://npmjs.com/~aoneahsan) | Published packages including linux-cleanup |
| **Address** | [zaions.com/address](https://zaions.com/address) | Postal / business address |

---

## What I work on

- **Developer tooling** like this one — CLIs, bash utilities, repo health automation, dotfiles.
- **Full-stack web apps** with React + TanStack Query/Router + Tailwind + Firebase or Cloudflare Workers backends.
- **Cross-platform mobile** with Capacitor and React Native for clients who want one codebase across Android, iOS, and the web.
- **Browser extensions** (Chrome / Firefox / Edge — Manifest V3, security-audited).
- **WordPress plugins and themes** for clients with existing CMS investments.
- **Documentation, audits, and rescue work** on inherited codebases that need the engineering equivalent of `linux-cleanup`.

If any of that overlaps with what you need, [send me an email](mailto:aoneahsan@gmail.com) — I take a small number of contracts each year and the conversation costs nothing.

---

## Why I built linux-cleanup

I kept running out of disk space on my dev laptop. Every "Linux cleaner" I tried was either:

- **A GUI** that hid what it was about to delete behind a single big button.
- **A `bash one-liner blog post`** that worked great until it deleted my SSH keys via an over-eager `find`.
- **An enterprise tool** that wanted my email, my analytics opt-in, and a paid tier for the actually-useful features.

linux-cleanup is the opposite of all three:

- Transparent — every deletion is logged, every path is enumerated by `--list-targets`, every guard is testable.
- Safe — allowlist-based refusal of personal data, staleness gates for tools, interactive-only for anything personal, four independent guards before `safe_rm` runs.
- Free — and zero-telemetry. No phone-home. The only data leaving your machine is what *you* email.

The tool exists because I'd rather spend half a weekend writing 3,000 lines of careful bash than rewrite that one-liner blog post for the fifth time.

---

## How you can support the work

If linux-cleanup saved you disk space, time, or a panicked `df -h /`, you can:

1. **Star the repo** — [github.com/aoneahsan/linux-cleanup](https://github.com/aoneahsan/linux-cleanup).
2. **Share it** — LinkedIn, your team's `#dev-tools` channel, your distro's subreddit. Word-of-mouth is what keeps independent open source going.
3. **Endorse on LinkedIn** — [linkedin.com/in/aoneahsan](https://linkedin.com/in/aoneahsan). Skill endorsements help me stay visible to the kind of clients I enjoy working with.
4. **Tip the author** — [aoneahsan.com/payment](https://aoneahsan.com/payment?project-id=linux-cleanup&project-identifier=linux-cleanup). Anything from "buy me a coffee" to "fund a feature you want next" is welcome and personally noticed.
5. **Hire me** — for tooling, web apps, mobile apps, or audits. [aoneahsan@gmail.com](mailto:aoneahsan@gmail.com).

The script is free forever. The tip jar and the work pipeline are how the next version ships.

---

## Other things I've published

A small selection — full lists are on [npmjs.com/~aoneahsan](https://npmjs.com/~aoneahsan) and [github.com/aoneahsan](https://github.com/aoneahsan).

| Project | What it is |
|---|---|
| **linux-cleanup** | This tool — safe modular disk and cache cleanup utility for Linux |
| **capacitor-** packages | Capgo / Capacitor plugins for native features missing from upstream |
| **react-** utilities | Hooks and providers for forms, state, and analytics in React+Capacitor apps |
| **wordpress-** plugins | WordPress utilities for content sites, SEO, and admin productivity |
| **agent-skills** | Open skill definitions for AI coding assistants |

I publish, audit, and document everything to the same standard you see in linux-cleanup. If you want to evaluate my work before reaching out, the source is the best testimonial.

---

## Author quick contact

```
Name:      Ahsan Mahmood
Email:     aoneahsan@gmail.com
WhatsApp:  +92 304 6619706
Web:       https://aoneahsan.com
LinkedIn:  https://linkedin.com/in/aoneahsan
GitHub:    https://github.com/aoneahsan
npm:       https://npmjs.com/~aoneahsan
Address:   https://zaions.com/address
```

---

## License

linux-cleanup is licensed under the **Source-Available, No-Derivatives, Non-Commercial v1.0** licence. You can read it, run it, share it, and use it personally or in your team. You can't fork it, ship a derivative, or sell it. Read the full terms in [LICENSE](../LICENSE). For commercial use cases the licence blocks, [email me](mailto:aoneahsan@gmail.com) — most can be accommodated with a custom agreement.

---

**Last updated**: 2026-05-10 · **Tool version**: 1.3.0

> _"Build the small thing properly, document it once, and never apologise for it again."_
