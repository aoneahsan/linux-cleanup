# Cleanup modules context

**Verified:** 2026-10-14 · **Next routine context pass:** 2026-11-13

Each module owns a CLI mode called by `../cleanup.sh`. Several modes
can permanently delete files, while `--scan`, version and self-test
are intended for inspection. Preserve the shared protected-path,
staleness and confirmation gates when changing a module. A new
cleanup target needs an exact allowlist and isolated test evidence.
Use the public docs site as the user-facing documentation after
checking it against the code; its 1.4.0 snapshot is pending a 1.6.0
fact-check.
