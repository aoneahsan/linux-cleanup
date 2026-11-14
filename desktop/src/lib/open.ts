/** Open URLs and local paths through the OS, never inside the webview. */
import { isTauri } from '@/lib/tauri';
import { logger } from '@/lib/logger';

/** Open an https URL in the system browser. */
export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//.test(url)) return;
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch (error) {
    logger.warn('open url failed', error);
  }
}

const PANES = {
  fda: 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
  security: 'x-apple.systempreferences:com.apple.preference.security?General',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
} as const;

/** Open System Settings at Privacy & Security → Full Disk Access, Microphone, or Security (Open Anyway). */
export async function openPrivacySettings(pane: keyof typeof PANES): Promise<boolean> {
  if (!isTauri()) return false;
  const url = PANES[pane];
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return true;
  } catch (error) {
    logger.warn('open settings failed', error);
    return false;
  }
}
