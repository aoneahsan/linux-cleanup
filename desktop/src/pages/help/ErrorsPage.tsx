import { startSafePreview } from '@/services/previewLauncher';
import { useQueryClient } from '@tanstack/react-query';
import { AppLink, Btn, ExternalLink, PageHead, PreviewBtn, StateCard } from '@/components/ui/primitives';
import { useNavigate } from '@tanstack/react-router';
import { useT, translate } from '@/i18n';
import { plate } from '@/i18n/format';
import { useOnline } from '@/hooks/useOnline';
import { useReceipts } from '@/stores/receipts';
import { refreshAllowance } from '@/services/account';
import { toast } from '@/lib/feedback';
import { SUPPORT_EMAIL } from '@/config/env';

/** Errors & offline: every state names the problem, what still works, and one next step. */
export default function ErrorsPage() {
  const t = useT();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const online = useOnline();
  // Select the raw slice; derive outside the selector (a fresh array per read loops useSyncExternalStore).
  const receipts = useReceipts((s) => s.receipts);
  const failedReceipt = receipts.find((r) => r.sections.some((x) => x.state === 'failed'));
  const failedSection = failedReceipt?.sections.find((x) => x.state === 'failed');
  const failed = failedReceipt && failedSection ? { ...failedSection, id2: failedReceipt.id } : null;
  return (
    <div className="workbench">
      <PageHead id="h-err" dateline={t('help.errors.dateline')} title={t('help.errors.title')} lede={t('help.errors.lede')} />
      <section className="span-6" aria-label={t('states.cliMissing.title')} data-tour={t('help.errors.tour')}>
        <StateCard tone="error" icon="terminal" title={t('states.cliMissing.title')} actions={
          <>
            <AppLink to="/updates" className="btn btn-run"><span className="tag">{t('common.fix')}</span>{t('states.cliMissing.fix')}</AppLink>
            <Btn onPress={() => void navigator.clipboard.writeText(t('help.errors.checkCmd')).then(() => toast(translate('help.errors.copied')))}>{t('states.cliMissing.copy')}</Btn>
          </>
        }>
          {t('states.cliMissing.body')}
        </StateCard>
      </section>
      <section className="span-6" aria-label={t('states.permission.title')}>
        <StateCard tone="error" icon="lock" title={t('states.permission.title')} actions={
          <>
            <Btn onPress={() => void navigate({ to: '/onboarding', search: { step: 3 } })}>{t('states.permission.grant')}</Btn>
            <AppLink to="/receipt" className="btn btn-quiet">{t('help.errors.seeReceipt')}</AppLink>
          </>
        }>
          {t('states.permission.body')}
        </StateCard>
      </section>
      <section className="span-6" aria-label={t('states.offline.title')}>
        <StateCard tone="offline" icon="wifioff" title={t('states.offline.title')} actions={
          <PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('states.offline.keepWorking')}</PreviewBtn>
        }>
          {t('states.offline.body')}
        </StateCard>
      </section>
      <section className="span-6" aria-label={t('states.server.title')}>
        <StateCard tone="offline" icon="alert" title={t('states.server.title')} actions={
          <Btn icon="refresh" isDisabled={!online} onPress={() => {
            void refreshAllowance()
              .then(() => { void qc.invalidateQueries(); toast(translate('help.errors.answered')); })
              .catch(() => toast(translate('help.errors.stillNo')));
          }}>{t('states.server.retry')}</Btn>
        }>
          {t('states.server.body')}
        </StateCard>
      </section>
      <section className="span-6" aria-label={t('states.runFailed.title')}>
        <StateCard tone="error" icon="alert" title={t('states.runFailed.title')} actions={
          <>
            {failed ? <Btn onPress={() => void navigate({ to: '/receipt', search: { id: failed.id2 } })}>{t('states.runFailed.receipt')}</Btn> : null}
            <ExternalLink href="https://github.com/aoneahsan/linux-cleanup/issues/new" className="btn btn-quiet">{t('states.runFailed.report')}</ExternalLink>
          </>
        }>
          {failed ? t('help.errors.lastFailed', { id: plate(failed.id), reason: failed.reason ?? '' }) : t('help.errors.noneFailed')}
        </StateCard>
      </section>
      <section className="span-6" aria-label={t('states.nothing.title')}>
        <StateCard icon="check" title={t('states.nothing.title')} actions={<AppLink to="/settings" className="btn btn-quiet">{t('states.nothing.adjust')}</AppLink>}>
          {t('states.nothing.body')}
        </StateCard>
      </section>
      <p className="lede span-12">{t('help.errors.support', { email: SUPPORT_EMAIL })}</p>
    </div>
  );
}
