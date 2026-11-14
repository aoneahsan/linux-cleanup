/**
 * POST /account-welcome { referral_code? }  ->  { ok, welcome_sent, referral }
 * The app calls this after an anonymous device links Google (and on later sign-ins; it is
 * idempotent). It records who invited the account (confirmation itself is decided by the
 * verified-email trigger, never by this call), sends the welcome email once, and tells
 * the referrer once when their friend's account is confirmed.
 */
import { requireCaller, requireSignedIn } from '../_shared/auth.ts';
import { ok } from '../_shared/envelope.ts';
import { referralEmail, welcomeEmail } from '../_shared/email/compose.ts';
import { sendEmail } from '../_shared/email/send.ts';
import { serve } from '../_shared/http.ts';
import { rpc } from '../_shared/rpc.ts';
import { serviceClient, type SupabaseClient } from '../_shared/supabase.ts';
import { readBody, z } from '../_shared/validate.ts';

const Body = z.object({ referral_code: z.string().regex(/^[A-Za-z0-9]{10}$/).optional() }).strict();

// bounded: app_config holds a handful of admin fields, read by key.
async function configNumbers(db: SupabaseClient, keys: string[]): Promise<Record<string, number>> {
  const { data } = await db.from('app_config').select('key, value').in('key', keys).limit(keys.length);
  return Object.fromEntries((data ?? []).map((row) => [row.key as string, Number(row.value)]));
}

/** Claim welcome_sent_at atomically (only the first caller gets the row back), then send. */
async function sendWelcomeOnce(db: SupabaseClient, userId: string, email: string): Promise<boolean> {
  const { data } = await db.from('profiles').update({ welcome_sent_at: new Date().toISOString() })
    .eq('id', userId).is('welcome_sent_at', null).select('id');
  if (!data?.length) return false;
  const cfg = await configNumbers(db, ['device_real_runs_per_month', 'account_extra_real_runs_per_month']);
  return sendEmail(email, welcomeEmail({
    email, deviceRuns: cfg.device_real_runs_per_month ?? 0, accountRuns: cfg.account_extra_real_runs_per_month ?? 0,
  }), 'welcome');
}

/** Tell the referrer once, after the trigger has confirmed this account's referral. */
async function notifyReferrerOnce(db: SupabaseClient, inviteeId: string): Promise<void> {
  const { data } = await db.from('referrals').update({ notified_at: new Date().toISOString() })
    .eq('invitee_id', inviteeId).eq('status', 'confirmed').is('notified_at', null)
    .select('referrer_id, points_awarded, reward_grant_id');
  const row = data?.[0];
  if (!row) return;
  const [{ data: referrer }, { count }, cfg] = await Promise.all([
    db.from('profiles').select('email').eq('id', row.referrer_id).maybeSingle(),
    db.from('referrals').select('id', { count: 'exact', head: true })
      .eq('referrer_id', row.referrer_id).eq('status', 'confirmed'),
    configNumbers(db, ['referral_pro_month_threshold']),
  ]);
  if (!referrer?.email) return;
  await sendEmail(referrer.email as string, referralEmail({
    points: row.points_awarded as number, confirmed: count ?? 0,
    threshold: cfg.referral_pro_month_threshold ?? 0, rewarded: row.reward_grant_id !== null,
  }), 'referral_confirmed');
}

serve('account-welcome', ['POST'], async (req) => {
  const body = await readBody(req, Body); // 1 shape
  const caller = await requireCaller(req); // 2 authentication
  requireSignedIn(caller); // 3 authorization: a real account only
  const db = serviceClient(); // writes columns no client role holds (welcome_sent_at, notified_at)

  const referral = body.referral_code
    ? await rpc<{ result: string }>(db, 'referral_claim', { p_invitee: caller.id, p_code: body.referral_code })
    : null;
  const welcomeSent = await sendWelcomeOnce(db, caller.id, caller.email);
  await notifyReferrerOnce(db, caller.id);
  return ok({ welcome_sent: welcomeSent, referral: referral?.result ?? null });
});
