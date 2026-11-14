/**
 * Google sign-in: system browser + PKCE + the one-shot loopback listener from
 * `oauth_listen`. Google is linked to the anonymous user; when that Google
 * account already exists, it signs in to it instead (CONTRACTS §3).
 */
import { supabase } from '@/services/supabase';
import { AccountError, callFunction, ensureSession, handoffBegin, handoffComplete, refreshAllowance } from '@/services/account';
import { useSession, type Role } from '@/stores/session';
import { useSettings } from '@/stores/settings';
import { commands, on } from '@/lib/tauri';
import { openExternal } from '@/lib/open';
import { load, save } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { pullSettings } from '@/services/settingsSync';
import { identify, track } from '@/services/analytics';

const CALLBACK_MS = 5 * 60_000;

function waitForCallback(): Promise<string> {
  return new Promise((resolve, reject) => {
    let off: (() => void) | null = null;
    const timer = window.setTimeout(() => { off?.(); reject(new AccountError('auth', 'timeout')); }, CALLBACK_MS);
    void on('oauth-callback', ({ url }) => {
      window.clearTimeout(timer);
      off?.();
      resolve(url);
    }).then((fn) => { off = fn; });
  });
}

/** Read who is signed in, their role and plan, and publish it. */
export async function refreshSession(): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  const user = data.user;
  const google = Boolean(user && !user.is_anonymous);
  let role: Role = 'user';
  if (user && google) {
    const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', user.id).limit(1);
    if (roles?.[0]?.role === 'admin' || roles?.[0]?.role === 'superadmin') role = 'admin';
  }
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? null;
  const was = useSession.getState().signedIn;
  useSession.getState().setSession({ signedIn: google, email: google ? user?.email ?? null : null, displayName: google ? name : null, role, userId: user?.id ?? null });
  identify(google ? user?.id ?? null : null);
  if (google && !was) await pullSettings();
}

type Start = (redirectTo: string) => Promise<{ url: string | null; error: { message: string } | null }>;

/** One browser round trip: listen on a fresh loopback port, open the URL, return the PKCE code. */
async function oauthRound(start: Start): Promise<string> {
  const { port, nonce } = await commands.oauthListen();
  const callback = waitForCallback();
  const { url, error } = await start(`http://127.0.0.1:${port}/callback?n=${encodeURIComponent(nonce)}`);
  if (error && /provider.*(not enabled|disabled)|unsupported provider/i.test(error.message)) throw new AccountError('google_off', error.message);
  if (error || !url) throw new AccountError('auth', error?.message ?? 'no url');
  await openExternal(url);
  const back = new URL(await callback);
  const code = back.searchParams.get('code');
  if (!code && /provider.*(not enabled|disabled)/i.test(back.searchParams.get('error_description') ?? '')) throw new AccountError('google_off', 'provider disabled');
  if (!code) throw new AccountError('auth', back.searchParams.get('error_description') ?? 'no code');
  return code;
}

/** Run the whole Google flow. Resolves when the session is in place. */
export async function signInWithGoogle(): Promise<void> {
  const sb = supabase();
  if (!sb) throw new AccountError('not_configured', 'VITE_SUPABASE_URL');
  await ensureSession();
  const signIn: Start = async (redirectTo) => {
    const r = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    return { url: r.data.url ?? null, error: r.error };
  };
  let handoff: string | null | undefined;
  const link: Start = async (redirectTo) => {
    const r = await sb.auth.linkIdentity({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (!r.error) return { url: r.data.url ?? null, error: null };
    // Linking is refused: this becomes a session switch, so the device hand-over starts first.
    handoff = await handoffBegin();
    return signIn(redirectTo);
  };
  const ex = await sb.auth.exchangeCodeForSession(await oauthRound(link));
  if (ex.error) {
    // The Google identity already belongs to another account: hand the device over, then sign in to it.
    if (!/already|exists/i.test(ex.error.message)) throw new AccountError('auth', ex.error.message);
    handoff ??= await handoffBegin();
    const again = await sb.auth.exchangeCodeForSession(await oauthRound(signIn));
    if (again.error) throw new AccountError('auth', again.error.message);
  }
  if (handoff !== undefined) await handoffComplete(handoff);
  await refreshSession();
  track('sign_in', { method: 'google' });
  await welcomeOnce();
  await refreshAllowance().catch(() => undefined);
}

/** Call `account-welcome` once per account, passing an invite code when present. */
async function welcomeOnce(): Promise<void> {
  const id = useSession.getState().userId;
  if (!id || load<boolean>(`welcomed:${id}`, false)) return;
  const invite = useSettings.getState().settings.inviteCode;
  try {
    await callFunction('account-welcome', { body: invite ? { invite_code: invite } : {} });
    save(`welcomed:${id}`, true);
  } catch (error) {
    logger.warn('account-welcome failed', error instanceof AccountError ? error.kind : 'unknown');
  }
}

/** Sign out of Google; the device continues with a fresh anonymous session. */
export async function signOut(): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const code = await handoffBegin();
  await sb.auth.signOut();
  await ensureSession();
  await handoffComplete(code);
  await refreshSession();
  await refreshAllowance().catch(() => undefined);
}

/** Catalogue message for a sign-in failure (named states, never a raw crash). */
export function signInErrorKey(error: unknown): 'account.googleOff' | 'account.signInFailed' {
  return error instanceof AccountError && error.kind === 'google_off' ? 'account.googleOff' : 'account.signInFailed';
}
