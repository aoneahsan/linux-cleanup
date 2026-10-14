# Safety core context

**Verified:** 2026-10-14 · **Next routine context pass:** 2026-11-13

This directory holds shared path guards, pruning, roots and reporting
helpers. The protected-path refusal and symlink resolution are
security boundaries for a tool with permanent deletion. Read the
named helper and its caller before changing it. Verify with the
self-test and isolated temporary fixtures; do not exercise a
destructive mode on the actual workspace or system.
