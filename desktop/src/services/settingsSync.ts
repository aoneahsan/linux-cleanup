/**
 * Shortcuts, appearance and the legal-notice flag follow a signed-in Google
 * account through `user_settings` (CONTRACTS §3). Anonymous devices stay local.
 * Remote wins on sign-in; local changes push debounced. Writes are insert-then-
 * update on a unique violation (23505), never an upsert.
 */
import { supabase } from '@/services/supabase';
import { useSession } from '@/stores/session';
import { useSettings, type ShortcutId } from '@/stores/settings';
import { usePrefs } from '@/stores/prefs';
import { useAppearance } from '@/theme/apply';
import type { Appearance } from '@/theme/axes';
import { logger } from '@/lib/logger';

const DEBOUNCE_MS = 800;
let timer = 0;
let applying = false;

/** `appearance` json also carries `tours` (pages whose one-time tour hint was shown). */
type AppearanceJson = Partial<Appearance> & { tours?: Record<string, boolean>; notify?: { emailOnSchedule?: boolean } };
type Patch = { shortcuts?: Record<string, string>; appearance?: AppearanceJson; legal_notice_seen_at?: string };

async function write(patch: Patch): Promise<void> {
  const sb = supabase();
  const { signedIn, userId } = useSession.getState();
  if (!sb || !signedIn || !userId) return;
  const ins = await sb.from('user_settings').insert({ user_id: userId, ...patch });
  if (!ins.error) return;
  if (ins.error.code !== '23505') throw ins.error;
  const up = await sb.from('user_settings').update(patch).eq('user_id', userId);
  if (up.error) throw up.error;
}

/** Push the current shortcuts and appearance (debounced). */
export function schedulePush(): void {
  if (applying || !useSession.getState().signedIn) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void write({ shortcuts: useSettings.getState().bindings, appearance: { ...useAppearance.getState().values, tours: usePrefs.getState().toursSeen, notify: { emailOnSchedule: useSettings.getState().settings.emailOnSchedule } } })
      .catch((e: unknown) => logger.warn('user_settings push failed', e instanceof Error ? e.message : 'unknown'));
  }, DEBOUNCE_MS);
}

/** Record that the legal notice was shown to this account. */
export function pushLegalSeen(): void {
  void write({ legal_notice_seen_at: new Date().toISOString() }).catch((e: unknown) => logger.warn('legal flag push failed', e instanceof Error ? e.message : 'unknown'));
}

/** Pull the account's settings after sign-in; the remote copy wins, then local edits push. */
export async function pullSettings(): Promise<void> {
  const sb = supabase();
  const { signedIn, userId } = useSession.getState();
  if (!sb || !signedIn || !userId) return;
  const { data, error } = await sb.from('user_settings').select('shortcuts, appearance, legal_notice_seen_at').eq('user_id', userId).limit(1);
  if (error) {
    logger.warn('user_settings pull failed', error.message);
    return;
  }
  const row = data?.[0] as Patch | undefined;
  if (!row) {
    schedulePush();
    return;
  }
  applying = true;
  try {
    if (row.appearance) {
      const { tours, notify, ...axes } = row.appearance;
      if (typeof notify?.emailOnSchedule === 'boolean') useSettings.getState().update({ emailOnSchedule: notify.emailOnSchedule });
      useAppearance.getState().replace(axes);
      if (tours && typeof tours === 'object') usePrefs.getState().mergeToursSeen(tours);
    }
    if (row.shortcuts) useSettings.getState().replaceBindings(row.shortcuts as Partial<Record<ShortcutId, string>>);
    if (row.legal_notice_seen_at && !usePrefs.getState().legalSeen) usePrefs.getState().markLegalSeen();
  } finally {
    applying = false;
  }
}

/** Subscribe to local changes once (AppShell). Returns the cleanup. */
export function bindSettingsSync(): () => void {
  const a = useAppearance.subscribe((s, prev) => s.values !== prev.values && schedulePush());
  const b = useSettings.subscribe((s, prev) => (s.bindings !== prev.bindings || s.settings.emailOnSchedule !== prev.settings.emailOnSchedule) && schedulePush());
  return () => { a(); b(); };
}
