import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Btn, Panel } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { callFunction, hasCode, refreshAllowance } from '@/services/account';
import { toast } from '@/lib/feedback';

interface Invite { invite_id: string; team_name: string; invited_by: string | null; expires_at: string }

const REFUSALS = ['invite_not_found', 'invite_email_mismatch', 'already_in_team', 'no_seats'] as const;

/**
 * The invitee's side of a team invite: the newest pending invite sent to this account's verified
 * email, with Accept. The server matches the email and seats again on accept (`team_accept`).
 */
export function TeamInvitation() {
  const t = useT();
  const qc = useQueryClient();
  const [refusal, setRefusal] = useState<string | null>(null);
  const invites = useQuery({
    queryKey: ['team-invites'],
    retry: 0,
    queryFn: () => callFunction<{ invites: Invite[] }>('team', { body: { action: 'invites' } }),
  });
  const accept = useMutation({
    mutationFn: (inv: Invite) => callFunction('team', { body: { action: 'accept', invite_id: inv.invite_id } }),
    onSuccess: async (_r, inv) => {
      setRefusal(null);
      toast(translate('account.team.joined', { team: inv.team_name }));
      await refreshAllowance().catch(() => undefined); // the seat's plan replaces the locked view
      void qc.invalidateQueries({ queryKey: ['team-fleet'] });
      void qc.invalidateQueries({ queryKey: ['team-invites'] });
    },
    onError: (e) => {
      const code = REFUSALS.find((c) => hasCode(e, c));
      setRefusal(code ? translate(`account.team.refusals.${code}`) : translate('account.team.failed', { message: e instanceof Error ? e.message : String(e) }));
    },
  });

  const inv = invites.data?.invites[0];
  if (!inv) return null;
  return (
    <Panel idx="§ 00" title={t('account.team.invitationTitle')} titleId="h-invitation" className="span-12 mb-4" tour={t('account.team.invitationTour')}>
      <p className="lede">{t('account.team.invitationLede', { team: inv.team_name })}</p>
      <table className="ledger">
        <tbody>
          <tr><td>{t('account.team.invitationTeam')}</td><td>{inv.team_name}</td></tr>
          <tr><td>{t('account.team.invitationBy')}</td><td>{inv.invited_by ?? '—'}</td></tr>
          <tr><td>{t('account.team.invitationSeat')}</td><td>{t('account.team.invitationSeatValue')}</td></tr>
          <tr><td>{t('account.team.invitationExpires')}</td><td>{formatDate(Date.parse(inv.expires_at))}</td></tr>
        </tbody>
      </table>
      <p className="lede mt-3">{t('account.team.invitationNote')}</p>
      {refusal ? <p className="callout warn mt-3" role="alert">{refusal}</p> : null}
      <div className="row-actions mt-3">
        <Btn variant="run" tag={t('account.team.acceptTag')} isDisabled={accept.isPending} onPress={() => accept.mutate(inv)}>{t('account.team.accept')}</Btn>
      </div>
    </Panel>
  );
}
