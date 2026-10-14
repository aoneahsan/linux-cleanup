# Node launcher context

**Verified:** 2026-10-14 · **Next routine context pass:** 2026-11-13

`linux-cleanup.js` is the npm executable shim. It locates and runs the
Bash utility and gives packaged installations a persistent data
directory. Keep Node >=14 compatibility and never make package
installation itself delete files. Test launcher changes with an
isolated temporary data directory and the source's self-test.
