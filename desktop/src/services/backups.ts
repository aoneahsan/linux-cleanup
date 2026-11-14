/**
 * Pro receipt backup over the `receipt-backup` Edge Function (CONTRACTS "Receipt backups
 * (2026-10-30)"). Owner decision: section ids, sizes and statuses only, never a path; a
 * backup restores on another Mac. The summary is built here from an allow-list, so a
 * section title, skip reason, run name, report path or log path can never be sent; the
 * server refuses any other key anyway. Signed-in Google accounts only.
 */
import { AccountError, callFunction, ensureSession, getDeviceId } from '@/services/account';
import { supabase } from '@/services/supabase';
import { env } from '@/config/env';
import type { Receipt } from '@/stores/receipts';

/** What one backup holds (schema 1). Mirrors `supabase/functions/receipt-backup/summary.ts`. */
export interface BackupSummary {
  schema: 1;
  receipt_id: string;
  at: number;
  kind: 'manual' | 'scheduled';
  dry_run: boolean;
  interrupted: boolean;
  cancelled: boolean;
  os_version: string;
  app_version?: string;
  freed_kb: number;
  free_before_kb: number | null;
  free_after_kb: number | null;
  total_kb: number | null;
  snapshots: number;
  elapsed_s: number | null;
  tally: { attempted: number; completed: number; skipped: number; failed: number };
  sections: { id: number; status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed'; freed_kb: number; planned_kb: number; item_count: number }[];
}

/** A backup's registry row (no storage id ever reaches the app). */
export interface BackupRow {
  id: string;
  device_id: string;
  receipt_id: string;
  receipt_at: string;
  sections_count: number;
  freed_kb: number;
  size_bytes: number;
  created_at: string;
}

export interface BackupList {
  items: BackupRow[];
  next_cursor: string | null;
  used: number;
  max: number;
  included: boolean;
}

const kb = (n: number | null): number | null => (n === null ? null : Math.max(0, Math.round(n)));
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** Build the allow-listed summary of one local receipt. Pure: numbers, ids and enums only. */
export function toBackupSummary(receipt: Receipt, osVersion: string, appVersion: string = env.appVersion): BackupSummary {
  return {
    schema: 1,
    receipt_id: receipt.id,
    at: receipt.at,
    kind: receipt.schedule ? 'scheduled' : 'manual',
    dry_run: receipt.dryRun,
    interrupted: receipt.interrupted,
    cancelled: receipt.cancelled,
    os_version: osVersion,
    ...(SEMVER.test(appVersion) ? { app_version: appVersion } : {}),
    freed_kb: Math.max(0, Math.round(receipt.freedKb)),
    free_before_kb: kb(receipt.freeBeforeKb),
    free_after_kb: kb(receipt.freeAfterKb),
    total_kb: kb(receipt.totalKb),
    snapshots: Math.max(0, Math.round(receipt.snapshots)),
    elapsed_s: receipt.elapsedS === null ? null : Math.max(0, receipt.elapsedS),
    tally: { ...receipt.tally },
    sections: receipt.sections.map((s) => ({
      id: s.id, status: s.state, freed_kb: Math.max(0, Math.round(s.freedKb)), planned_kb: Math.max(0, Math.round(s.plannedKb)), item_count: s.itemCount,
    })),
  };
}

/**
 * Back up one receipt. Refusals arrive as AccountError codes: `plan_required` (403),
 * `limit_reached` and `duplicate_backup` (409), `signed_in_required`, `device_owned`.
 */
export async function backupReceipt(receipt: Receipt, osVersion: string) {
  return callFunction<{ backup: BackupRow; used: number; max: number }>('receipt-backup', {
    body: { device_id: await getDeviceId(), summary: toBackupSummary(receipt, osVersion) },
  });
}

/** One page of this account's backups, newest first (default 20, max 50). */
export function listBackups(params: { cursor?: string; limit?: number } = {}) {
  const query: Record<string, string> = {};
  if (params.cursor) query.cursor = params.cursor;
  if (params.limit) query.limit = String(params.limit);
  return callFunction<BackupList>('receipt-backup', { method: 'GET', query });
}

/** Fetch one backup with its summary, to restore it on this Mac. */
export function getBackup(id: string) {
  return callFunction<{ backup: BackupRow; summary: BackupSummary }>('receipt-backup', { method: 'GET', query: { id } });
}

/** Delete one backup (the stored file first, then its record). */
export async function deleteBackup(id: string): Promise<void> {
  const sb = supabase();
  if (!sb) throw new AccountError('not_configured', 'VITE_SUPABASE_URL');
  if (!navigator.onLine) throw new AccountError('offline', 'receipt-backup');
  await ensureSession();
  // callFunction covers GET and POST only; DELETE goes through the same client directly.
  const { error } = await sb.functions.invoke(`receipt-backup?${new URLSearchParams({ id }).toString()}`, { method: 'DELETE' });
  if (!error) return;
  const ctx = (error as { context?: unknown }).context;
  let code: string | null = null;
  let message = error.message;
  if (ctx instanceof Response) {
    const body = (await ctx.clone().json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    code = body.error?.code ?? null;
    message = body.error?.message ?? String(ctx.status);
  }
  throw new AccountError('server', message, code);
}
