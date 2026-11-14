/** Paths the router actually serves; the source list and palette show only these. */
const registered = new Set<string>();

/** Record a served path (called by the router as it is built). */
export function registerPaths(paths: readonly string[]): void {
  for (const p of paths) registered.add(p);
}

/** True when a path has a screen. */
export const isRegistered = (path: string): boolean => registered.has(path);
