/**
 * Update flow, layer 2 (CONTRACTS "Releases (2026-10-30)"). The app reads ONE row, the
 * latest release for its platform and channel, from the public `latest_app_releases`
 * view; the decision itself is the pure `decide()` in `@/lib/releaseGate`. A failed or
 * impossible read is `{ ok: false }`, which the gate treats as fail-open. Admin reads and
 * writes go through the `admin` Edge Function (role checked and audited server-side).
 */
import { supabase } from '@/services/supabase';
import { callFunction } from '@/services/account';
import { logger } from '@/lib/logger';
import { isSemver, type ReleaseRecord, type ReleaseSeverity } from '@/lib/releaseGate';

export type ReleasePlatform = 'desktop' | 'web' | 'docs';
export type ReleaseChannel = 'production' | 'test';

/** One row of `latest_app_releases` as PostgREST returns it. */
interface LatestRow {
  version: string;
  severity: ReleaseSeverity;
  reason: string;
  min_native_version: string | null;
}

export type LatestRelease = { ok: true; record: ReleaseRecord | null } | { ok: false };

/** Read the latest release for this build's channel (one row; fail-open on any error). */
export async function fetchLatestRelease(channel: ReleaseChannel, platform: ReleasePlatform = 'desktop'): Promise<LatestRelease> {
  const sb = supabase();
  if (!sb || !navigator.onLine) return { ok: false };
  try {
    const { data, error } = await sb
      .from('latest_app_releases')
      .select('version, severity, reason, min_native_version')
      .eq('platform', platform)
      .eq('channel', channel)
      .limit(1)
      .maybeSingle<LatestRow>();
    if (error) {
      logger.warn('release check failed', error.message);
      return { ok: false };
    }
    if (!data) return { ok: true, record: null };
    return {
      ok: true,
      record: { version: data.version, severity: data.severity, reason: data.reason, minNativeVersion: data.min_native_version },
    };
  } catch (error) {
    logger.warn('release check failed', error instanceof Error ? error.message : String(error));
    return { ok: false };
  }
}

/** A release as the admin list returns it. */
export interface AdminRelease {
  id: string;
  platform: ReleasePlatform;
  channel: ReleaseChannel;
  version: string;
  severity: ReleaseSeverity;
  reason: string;
  min_native_version: string | null;
  published_at: string;
  published_by: string;
}

/** Newest first, at most 20 per page (`releases.list`). */
export function listReleases(params: { platform?: ReleasePlatform; channel?: ReleaseChannel; cursor?: string; limit?: number } = {}) {
  return callFunction<{ items: AdminRelease[]; next_cursor: string | null }>('admin', { body: { action: 'releases.list', ...params } });
}

export interface PublishReleaseInput {
  platform: ReleasePlatform;
  channel: ReleaseChannel;
  version: string;
  severity: ReleaseSeverity;
  reason: string;
  minNativeVersion?: string;
}

/**
 * Publish a release (`releases.publish`). Never edits one: a mistake is corrected by a
 * newer row. `previous_version` lets the admin page warn (never block) when the new
 * version is not above it. The optional key is omitted when blank.
 */
export function publishRelease(input: PublishReleaseInput) {
  const minNative = input.minNativeVersion?.trim();
  return callFunction<{ release: Omit<AdminRelease, 'published_by'>; previous_version: string | null }>('admin', {
    body: {
      action: 'releases.publish',
      platform: input.platform,
      channel: input.channel,
      version: input.version.trim(),
      severity: input.severity,
      reason: input.reason.trim(),
      ...(minNative ? { min_native_version: minNative } : {}),
    },
  });
}

/** Whether a version is acceptable to publish (the server re-checks with the same rule). */
export const isPublishableVersion = (v: string): boolean => isSemver(v.trim());
