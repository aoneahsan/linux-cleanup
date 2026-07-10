# Contributing to linux-cleanup

Thanks for your interest! **linux-cleanup is free and open source under the
[MIT License](./LICENSE)**, so forks, pull requests, and feature requests are all
welcome.

---

## Ways to contribute

- **Report a bug** or **suggest a feature** → open a [GitHub issue](https://github.com/aoneahsan/linux-cleanup/issues),
  or email **aoneahsan@gmail.com** if you'd rather not use a tracker.
- **Fix or improve the code** → fork the repo and open a pull request.
- **Improve the docs** → PRs against `docs/` are just as valuable as code.

You don't need any special access to contribute — anyone can fork and open a PR.

---

## Governance — how changes land

- **`main` is protected.** Every change lands through a **pull request**; direct
  pushes to `main` are restricted to the maintainer.
- The maintainer (**Ahsan Mahmood** · [@aoneahsan](https://github.com/aoneahsan)) is
  the only one who pushes to `main` directly. Everyone else — including anyone granted
  write access — contributes through reviewed PRs. Write access does **not** let you
  bypass review on `main`.

### Requesting contributor / write access

- **Fork + PR** works for anyone and needs no access at all — start there.
- Want collaborator (write) access for ongoing work? Open a
  **"Contributor access request"** issue or email the maintainer. It's granted at the
  maintainer's discretion and still can't bypass PR review on `main`.

---

## Development setup

linux-cleanup is a **Bash tool** — there is no build step.

```bash
git clone https://github.com/aoneahsan/linux-cleanup.git
cd linux-cleanup
bash cleanup.sh --scan        # read-only: see what it would reclaim
bash cleanup.sh --self-test   # run the built-in checks
```

**Requirements:** Bash 4+, standard GNU coreutils. `jq` is optional (used only for
Markdown/HTML report export). The tool is Linux-only by design.

---

## Coding standards

- **Bash targeting 4+**, `set -euo pipefail` discipline, and clean
  [ShellCheck](https://www.shellcheck.net/) output.
- **Safety first.** Never delete outside the `PROTECTED_PATHS` allowlist. Keep
  interactive confirmation for anything touching personal data — `--yes` must never
  apply to personal files.
- **Stay offline.** The tool makes **zero network calls** (no telemetry, no analytics).
  Do not add any. That verifiable no-network stance is a core promise.
- **Use the existing helpers** for logging and output rather than raw `echo`/`printf`
  where a helper already exists (see `lib/common.sh`).
- Keep each PR to **one logical change**.

---

## Commit & PR conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
  `docs:`, `chore:`, `refactor:`, etc.
- Explain **what** changed and **why**; call out any new cache targets or
  safety-relevant behavior.
- Update **`CHANGELOG.md`** (under `[Unreleased]`) and the relevant `docs/` page when
  behavior changes.
- Run **`bash cleanup.sh --self-test`** before opening the PR, and — because this tool
  deletes files — manually verify your change on a real Linux system.

---

## Security

Please report security vulnerabilities **privately** to **aoneahsan@gmail.com** rather
than opening a public issue.

---

## Support the project

If linux-cleanup saved you time, you can support the work here:
**https://aoneahsan.com/payment?project-id=linux-cleanup&project-identifier=linux-cleanup**

---

## License

By contributing, you agree that your contributions are licensed under the project's
[MIT License](./LICENSE).
