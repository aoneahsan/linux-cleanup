/**
 * POST /team { action, ... }  (signed-in Google accounts)
 *   create { name }            -> { ok, team_id, name, seats }
 *   invite { email }           -> { ok, invite_id, email_sent }   (owner; seats enforced in SQL)
 *   invites {}                 -> { ok, invites: [{ invite_id, team_name, invited_by, expires_at }] }  (the caller's own, verified email)
 *   accept { invite_id }       -> { ok, team_id }                  (the invited, verified email only)
 *   remove { user_id | invite_id } -> { ok, removed }             (owner, or a member leaving)
 *   fleet  {}                  -> { ok, team, members, invites, totals }  (aggregated in SQL)
 * The SQL functions take the authenticated caller as p_actor and re-check ownership.
 */
import { requireCaller, requireSignedIn } from '../_shared/auth.ts';
import { ok } from '../_shared/envelope.ts';
import { inviteEmail } from '../_shared/email/compose.ts';
import { sendEmail } from '../_shared/email/send.ts';
import { serve } from '../_shared/http.ts';
import { rpc } from '../_shared/rpc.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { readBody, z } from '../_shared/validate.ts';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal('invite'), email: z.email().max(254) }).strict(),
  z.object({ action: z.literal('invites') }).strict(),
  z.object({ action: z.literal('accept'), invite_id: z.uuid() }).strict(),
  z.object({ action: z.literal('remove'), user_id: z.uuid().optional(), invite_id: z.uuid().optional() }).strict()
    .refine((b) => (b.user_id ? 1 : 0) + (b.invite_id ? 1 : 0) === 1, 'give exactly one of user_id or invite_id'),
  z.object({ action: z.literal('fleet') }).strict(),
]);

serve('team', ['POST'], async (req) => {
  const body = await readBody(req, Body); // 1 shape
  const caller = await requireCaller(req); // 2 authentication
  requireSignedIn(caller); // 3 authorization (ownership/membership re-checked in SQL)
  const db = serviceClient(); // the SQL takes the verified caller as p_actor

  switch (body.action) {
    case 'create':
      return ok(await rpc(db, 'team_create', { p_actor: caller.id, p_name: body.name }));
    case 'invite': {
      const invite = await rpc<{
        invite_id: string; team_name: string; invited_by: string; email: string; send_email: boolean;
      }>(db, 'team_invite', { p_actor: caller.id, p_email: body.email });
      // SQL decides: a new invite, or the last send is older than 24 h. Otherwise no email.
      const sent = invite.send_email
        ? await sendEmail(invite.email, inviteEmail({
          teamName: invite.team_name, invitedBy: invite.invited_by,
        }), 'team_invite')
        : false;
      return ok({ invite_id: invite.invite_id, email_sent: sent });
    }
    case 'invites':
      return ok({ invites: await rpc(db, 'team_my_invites', { p_actor: caller.id }) });
    case 'accept':
      return ok(await rpc(db, 'team_accept', { p_actor: caller.id, p_invite: body.invite_id }));
    case 'remove':
      return ok(await rpc(db, 'team_remove', {
        p_actor: caller.id, p_user: body.user_id ?? null, p_invite: body.invite_id ?? null,
      }));
    case 'fleet':
      return ok(await rpc(db, 'team_fleet', { p_actor: caller.id }));
  }
});
