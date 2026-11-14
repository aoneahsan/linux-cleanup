/**
 * Build `RunOptions` from Settings for every run_cli. Only values the user set are
 * passed. `~/` is expanded to the home folder so the CLI never ignores a
 * "Never touch" folder it cannot resolve.
 */
import { useSettings } from '@/stores/settings';
import { isTauri, type RunOptions } from '@/lib/tauri';
import { logger } from '@/lib/logger';

const clampDays = (n: number) => Math.min(3650, Math.max(1, Math.round(n)));

async function home(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { homeDir } = await import('@tauri-apps/api/path');
    return (await homeDir()).replace(/\/$/, '');
  } catch (error) {
    logger.warn('homeDir failed', error);
    return null;
  }
}

/** Expand a leading `~/`; returns null when it cannot (the caller must not drop it silently). */
export function expand(path: string, homePath: string | null): string | null {
  if (path.startsWith('/')) return path;
  if (path.startsWith('~/') && homePath) return `${homePath}${path.slice(1)}`;
  return null;
}

/** The options for the next run, or an error naming a folder that cannot be passed. */
export async function buildRunOptions(): Promise<{ options: RunOptions } | { unresolved: string }> {
  const s = useSettings.getState().settings;
  const options: RunOptions = {};
  if (s.ageDays !== null) {
    const d = clampDays(s.ageDays);
    Object.assign(options, { idleDays: d, cacheAgeDays: d, unusedAppDays: d, staleBuildDays: d, largeFileDays: d });
  }
  if (s.largeFileGb !== null) options.largeFileSizeGb = Math.min(1024, Math.max(1, Math.round(s.largeFileGb)));
  const h = s.scanRoots.length || s.excludes.length ? await home() : null;
  const roots: string[] = [];
  for (const p of s.scanRoots) {
    const e = expand(p, h);
    if (!e) return { unresolved: p };
    roots.push(e);
  }
  const excl: string[] = [];
  for (const p of s.excludes) {
    const e = expand(p, h);
    if (!e) return { unresolved: p };
    excl.push(e);
  }
  if (roots.length) options.scanRoots = roots;
  if (excl.length) options.excludePaths = excl;
  return { options };
}
