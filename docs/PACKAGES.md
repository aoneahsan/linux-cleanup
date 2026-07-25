# Package inventory — linux-cleanup

The dependency and manifest record for this package. Keep it accurate on every add, removal, or upgrade.

**Last Updated:** 2026-07-25

---

## Manifest units

One `package.json`, at the repository root. There is no monorepo, no workspace member, and no build step that
emits a second manifest — verified with
`find . -name package.json -not -path './node_modules/*' -not -path './.git/*'`, which returns exactly one
path. Publishing can therefore only ever happen from the repository root.

## Dependencies

**None — of any kind.** No `dependencies`, no `devDependencies`, no `peerDependencies`, no `optionalDependencies`.

This is deliberate and worth preserving. The package is Bash plus a ~110-line Node launcher that uses only
built-in modules (`path`, `fs`, `os`, `child_process`). A user running `npx linux-cleanup` downloads one
52 kB tarball and nothing else, which is a meaningful property for a tool that runs with `sudo` and deletes
files. Adding a runtime dependency would weaken that and should be treated as a design decision, not a
convenience.

`yarn.lock` exists but contains only the workspace self-reference.

## External commands (not npm packages)

The real dependencies are system binaries, resolved at runtime with `command -v` and degrading gracefully
when absent. `linux-cleanup --self-test` reports which are missing.

| Command | Required? | Used for |
|---|---|---|
| `bash` >= 4.0 | required | Everything. Associative arrays and `${var,,}` are not in Bash 3.2. |
| GNU coreutils (`realpath`, `du`, `df`, `stat`, `sort`, `numfmt`) | required | `realpath -m` backs the symlink-resolving safety guard. The BSD build has no `-m`. |
| `find`, `awk`, `sed`, `grep` | required | Scanning and measurement. |
| `jq` | optional | JSON report export to Markdown / HTML only. |
| `sudo` | optional | `--system` only. |
| `whiptail` / `dialog` | optional | `--tui` only; falls back to the CLI menu. |
| `snap`, `crontab`, `xdg-open`, `less` | optional | One feature each. |

## Manifest decisions

| Field | Value | Why |
|---|---|---|
| `bin` | `"bin/linux-cleanup.js"` (string form) | The string form takes the command name from `name`, which is already `linux-cleanup`. Equivalent to the object form used before 1.4.0; confirmed by the `bin` map in `yarn.lock` and by installing the packed tarball. |
| `main` | `bin/linux-cleanup.js` | Unusual for a CLI and not needed, but removing it deletes a public entry point, which is a **major** change under semver. Left in place deliberately; revisit at the next major. |
| `engines.node` | `>=14` | Accurate — the launcher uses no syntax or API newer than Node 14. Node 14 is past end-of-life, but **raising this floor is a major version bump**, so it is an owner decision rather than a maintenance tidy-up. |
| `os` | `["linux"]` | npm refuses to install on other platforms. The launcher independently exits `2` on non-Linux, so both the install and the run are guarded. |
| `files` | allowlist of 8 entries | An allowlist, never `.npmignore` — a denylist ships whatever it forgets. Verified against the extracted tarball. |
| `preferGlobal` | `true` | Ignored by current npm; harmless legacy hint. |
| `sideEffects` | absent | Bundler metadata for JS libraries. Meaningless for a Bash CLI with no importable surface. |

## Published contents

`npm pack` emits 24 files — ~55 kB packed, ~174 kB unpacked: `bin/`, `lib/`, `modules/`, `cleanup.sh`,
`README.md`, `LICENSE`, `CHANGELOG.md`, `VERSION`, `package.json`.

`docs/` is deliberately **not** shipped. It is ~32 pages, the README links every page by absolute URL, and
keeping it out holds the install small for a tool many people run through `npx` repeatedly.

Confirmed absent from the extracted tarball: `CLAUDE.md`, `AGENTS.md`, `.env*`, keys, credentials, logs,
reports, and the portfolio-info file. Because `files` is an allowlist and no shipped directory contains an
internal file, no `!**/CLAUDE.md` negation is required — re-verify this if a new directory is ever added to
`files`.

## Verification

```bash
find . -name package.json -not -path './node_modules/*' -not -path './.git/*'   # exactly one
npm pack --dry-run                                                              # 24 files
tar -tzf linux-cleanup-*.tgz | grep -iE 'CLAUDE|AGENTS|\.env|secret|\.pem'      # must be empty
bash cleanup.sh --self-test                                                     # Linux only
```
