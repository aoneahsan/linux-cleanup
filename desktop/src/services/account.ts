/**
 * Account calls over Supabase Edge Functions (CONTRACTS §3). Every device signs
 * in anonymously first, so each call carries a JWT. Payloads omit blank keys.
 */
import { supabase } from '@/services/supabase';
import { useAllowance, type Allowance } from '@/stores/allowance';
import { useSession } from '@/stores/session';
import { commands, isTauri } from '@/lib/tauri';
import { logger } from '@/lib/logger';
import { load, save } from '@/lib/storage';

export class AccountError extends Error {
  constructor(
    public readonly kind: 'not_configured' | 'offline' | 'server' | 'auth' | 'google_off',
    message: string,
    /** The envelope's machine code (`device_owned`, `plan_required`, …) when the server sent one. */
    public readonly code: string | null = null,
  ) {
    super(message);
  }
}

/** True when an error carries this server code. */
export const hasCode = (e: unknown, code: string): boolean => e instanceof AccountError && e.code === code;

async function envelopeCode(error: unknown): Promise<{ code: string | null; message: string }> {
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: { code?: string; message?: string } };
      return { code: body.error?.code ?? null, message: body.error?.message ?? String(ctx.status) };
    } catch {
      return { code: null, message: String(ctx.status) };
    }
  }
  return { code: null, message: error instanceof Error ? error.message : String(error) };
}

/** Ensure a session exists (anonymous on first launch). */
export async function ensureSession(): Promise<void> {
  const sb = supabase();
  if (!sb) throw new AccountError('not_configured', 'VITE_SUPABASE_URL');
  const { data } = await sb.auth.getSession();
  if (data.session) return;
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw new AccountError('auth', error.message);
}

/** Call one Edge Function with the session JWT. */
export async function callFunction<T>(name: string, init: { method?: 'GET' | 'POST'; body?: object; query?: Record<string, string> } = {}): Promise<T> {
  const sb = supabase();
  if (!sb) throw new AccountError('not_configured', 'VITE_SUPABASE_URL');
  if (!navigator.onLine) throw new AccountError('offline', name);
  await ensureSession();
  const path = init.query ? `${name}?${new URLSearchParams(init.query).toString()}` : name;
  const { data, error } = await sb.functions.invoke<T>(path, { method: init.method ?? 'POST', body: init.body });
  if (error) {
    const { code, message } = await envelopeCode(error);
    throw new AccountError('server', message, code);
  }
  return data as T;
}

let deviceId: string | null = null;
const OVERRIDE_KEY = 'device-id-override';

/** This Mac's device id: a replacement stored after a failed hand-over, else system_info's. */
export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  const override = load<string | null>(OVERRIDE_KEY, null);
  if (override) return (deviceId = override);
  if (!isTauri()) throw new AccountError('not_configured', 'not_in_app');
  deviceId = (await commands.systemInfo()).device_id;
  return deviceId;
}

/** Use a fresh device id when the old one belongs to another account and cannot be handed over. */
export function replaceDeviceId(): string {
  const id = crypto.randomUUID();
  save(OVERRIDE_KEY, id);
  deviceId = id;
  return id;
}

/** Fetch this month's allowance and publish it to the store. */
export async function refreshAllowance(): Promise<Allowance> {
  let a: Allowance;
  try {
    a = await callFunction<Allowance>('allowance', { method: 'GET', query: { device_id: await getDeviceId() } });
  } catch (e) {
    if (hasCode(e, 'device_owned')) useAllowance.getState().setDeviceOwned(true);
    throw e;
  }
  useAllowance.getState().setDeviceOwned(false);
  useAllowance.getState().setAllowance(a);
  useSession.getState().setSession({ plan: (['free', 'pro', 'team'].includes(a.plan.id) ? a.plan.id : 'free') as 'free' | 'pro' | 'team' });
  return a;
}

export type ClaimResult =
  | { ok: true; claim_id: string; pool: 'device' | 'account' | 'plan'; allowance: Allowance }
  | { ok: false; reason: 'limit_reached'; allowance: Allowance };

/** Claim one real run before it starts. Previews never call this. */
export async function claimRun(sections: number[]): Promise<ClaimResult> {
  let res: ClaimResult;
  try {
    res = await callFunction<ClaimResult>('claim-run', { body: { device_id: await getDeviceId(), sections } });
  } catch (e) {
    if (hasCode(e, 'device_owned')) useAllowance.getState().setDeviceOwned(true);
    throw e;
  }
  useAllowance.getState().setAllowance(res.allowance);
  return res;
}

/** Load the allowance at boot; failures leave the card in its named waiting/offline state. */
export async function bootAccount(): Promise<void> {
  if (!supabase()) return;
  try {
    await ensureSession();
    const { refreshSession } = await import('@/services/auth');
    await refreshSession();
    await refreshAllowance();
  } catch (error) {
    logger.warn('allowance unavailable', error instanceof AccountError ? error.kind : 'unknown');
  }
}

/** Begin handing this device to the next session; null when this session does not own it. */
export async function handoffBegin(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('device_handoff_begin', { p_device_id: await getDeviceId() });
  if (error) {
    logger.warn('device_handoff_begin failed', error.code ?? 'unknown');
    return null;
  }
  return (data as { code?: string } | null)?.code ?? null;
}

/** Finish the hand-over in the new session; without a valid code the Mac gets a new device id. */
export async function handoffComplete(code: string | null): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  if (code) {
    const { error } = await sb.rpc('device_handoff_complete', { p_device_id: await getDeviceId(), p_code: code });
    if (!error) return;
    logger.warn('device_handoff_complete failed', error.code ?? 'unknown');
  }
  replaceDeviceId();
}
