import { Switch } from 'react-aria-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useT, translate } from '@/i18n';
import { env } from '@/config/env';
import { useSession } from '@/stores/session';
import { callFunction } from '@/services/account';
import { openExternal } from '@/lib/open';
import { toast } from '@/lib/feedback';

type NewsStatus = 'none' | 'active' | 'pending_confirmation' | 'unsubscribed' | 'blocked';

/**
 * Optional release emails for the signed-in account's Google address (the `news` function, FilesHub
 * "linux-cleanup releases" list). Account emails and important product updates never depend on this switch.
 */
export function NewsEmails() {
  const t = useT();
  const qc = useQueryClient();
  const { signedIn, userId } = useSession();
  const q = useQuery({
    queryKey: ['news', userId],
    enabled: signedIn,
    staleTime: 5 * 60_000,
    queryFn: () => callFunction<{ status: NewsStatus }>('news', { method: 'GET' }),
  });
  const m = useMutation({
    mutationFn: (on: boolean) => callFunction<{ status: NewsStatus }>('news', { body: { on } }),
    onSuccess: (data, on) => {
      qc.setQueryData(['news', userId], data);
      toast(translate(on ? 'account.newsOn' : 'account.newsOff'));
    },
    onError: () => toast(translate('account.newsFailed')),
  });

  if (!signedIn) {
    return (
      <p className="lede">
        {t('account.newsSignIn')}
        <button type="button" className="link-arrow" onClick={() => void openExternal(`${env.websiteUrl}/download#updates`)}>{t('account.newsSignInLink')}</button>.
      </p>
    );
  }
  const status = m.isPending ? (m.variables ? 'active' : 'none') : q.data?.status;
  const on = status === 'active' || status === 'pending_confirmation';
  return (
    <>
      <div className="setting-row">
        <div><b>{t('account.newsTitle')}</b><p>{t('account.newsBody')}</p></div>
        <Switch className="switch" isSelected={on} isDisabled={q.isPending || m.isPending || status === 'blocked'} aria-label={t('account.newsTitle')}
          onChange={(next) => m.mutate(next)}>
          <span className="track" aria-hidden="true" />
          <span className="sr-only">{t(on ? 'settings.on' : 'settings.off')}</span>
        </Switch>
      </div>
      {q.error ? <p className="lede mt-3">{t('states.server.body')}</p> : null}
      {status === 'pending_confirmation' ? <p className="lede mt-3">{t('account.newsPending')}</p> : null}
      {status === 'blocked' ? <p className="lede mt-3">{t('account.newsBlocked')}</p> : null}
      <p className="lede mt-3">{t('account.newsAlways')}</p>
    </>
  );
}
