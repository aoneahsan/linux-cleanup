/**
 * The push half of the update flow: the database broadcasts every published release on the
 * public Realtime topic `app-releases` (migration 20261114092255_release_broadcast). This is the
 * one subscription; layer 2 (the release gate) and layer 1 (the updater check) both listen here,
 * so no client reads the record on a timer. A reconnect re-runs the listeners, which closes any
 * gap a dropped socket left (realtime-not-polling: re-read on rejoin, never on a clock).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase';
import { logger } from '@/lib/logger';

export interface PublishedRelease {
  platform: string;
  channel: string;
  version: string;
  severity: string;
}

type Listener = (release: PublishedRelease | null) => void;

const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

function notify(release: PublishedRelease | null): void {
  for (const listener of listeners) {
    try {
      listener(release);
    } catch (error) {
      logger.warn('release listener failed', error instanceof Error ? error.message : String(error));
    }
  }
}

function ensureChannel(): void {
  if (channel) return;
  const client = supabase();
  if (!client) return;
  let joinedOnce = false;
  channel = client
    .channel('app-releases')
    .on('broadcast', { event: 'release_published' }, ({ payload }) => {
      const p = payload as Partial<PublishedRelease> | undefined;
      if (p && typeof p.version === 'string' && typeof p.platform === 'string' && typeof p.channel === 'string') {
        notify({ platform: p.platform, channel: p.channel, version: p.version, severity: String(p.severity ?? '') });
      }
    })
    .subscribe((status) => {
      // A re-join after a drop may have missed a broadcast: let every listener re-read once.
      if (status === 'SUBSCRIBED') {
        if (joinedOnce) notify(null);
        joinedOnce = true;
      }
    });
}

/** Listen for published releases (`null` = re-read after a reconnect). Returns the cleanup. */
export function onReleasePublished(listener: Listener): () => void {
  listeners.add(listener);
  ensureChannel();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && channel) {
      void channel.unsubscribe();
      channel = null;
    }
  };
}
