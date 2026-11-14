import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppLink, Btn, PageHead, PreviewBtn, RouterLink, StateCard, goTo, useRunLive } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT, translate } from '@/i18n';
import { formatDateTime, formatKb } from '@/i18n/format';
import { ALL_SAFE } from '@/data/sections';
import { usePlan } from '@/stores/plan';
import { useReceipts } from '@/stores/receipts';
import { useRun } from '@/stores/run';
import { runsLeft, useAllowance } from '@/stores/allowance';
import { useSession } from '@/stores/session';
import { AccountError, claimRun, refreshAllowance } from '@/services/account';
import { startSafePreview } from '@/services/previewLauncher';
import { env } from '@/config/env';
import { DeviceOwned } from '@/components/allowance/DeviceOwned';

/** A dry run older than this is shown again before a real run: the disk changes. */
const FRESH_MS = 24 * 60 * 60_000;

function AllowanceBox({ checking, offline }: { checking: boolean; offline: boolean }) {
  const t = useT();
  const a = useAllowance((s) => s.allowance);
  const signedIn = useSession((s) => s.signedIn);
  const owned = useAllowance((s) => s.deviceOwned);
  if (!env.accountsConfigured) return <p className="lede">{t('flow.confirm.allowLocal')}</p>;
  if (owned) return <DeviceOwned />;
  if (offline) return <p className="callout warn">{t('flow.confirm.allowOffline')}</p>;
  if (!a || checking) return <p className="lede">{t('flow.confirm.allowChecking')}</p>;
  if (a.plan.unlimited) return <p className="lede">{t('flow.confirm.allowNoLimit')}</p>;
  const left = runsLeft(a);
  if (left > 0) return <p className="lede">{t('flow.confirm.allowUses', { left, after: left - 1 })}</p>;
  return (
    <>
      <div className="callout warn">
        <b>{t('flow.confirm.allowNone')}</b> {signedIn ? t('flow.confirm.allowNoneSignedIn') : t('flow.confirm.allowNoneSignedOut')}
      </div>
      <div className="row-actions mt-3">
        {signedIn ? null : <AppLink to="/account" className="btn btn-quiet">{t('flow.confirm.allowSignIn')}</AppLink>}
        <AppLink to="/plans" className="btn btn-quiet">{t('flow.confirm.allowPlans')}</AppLink>
      </div>
    </>
  );
}

/** Confirm: the only screen that starts a real run. It needs a recent dry run and an allowance run. */
export default function ConfirmPage() {
  const t = useT();
  const navigate = useNavigate();
  const plan = usePlan((s) => s.plan);
  const finding = useReceipts((s) => s.findings[ALL_SAFE] ?? null);
  const start = useRun((s) => s.start);
  const live = useRunLive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The moment this screen opened: the dry-run age is judged against it, not re-read each render.
  const [openedAt] = useState(() => Date.now());
  const allowance = useAllowance((s) => s.allowance);
  const owned = useAllowance((s) => s.deviceOwned);
  const check = useQuery({ queryKey: ['allowance'], queryFn: refreshAllowance, enabled: env.accountsConfigured, retry: 0, staleTime: 0 });

  if (!finding) {
    return (
      <div className="workbench">
        <div className="span-12">
          <StateCard
            icon="play"
            title={t('flow.confirm.noPlan')}
            actions={<PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('flow.ledger.start')}</PreviewBtn>}
          >
            {t('flow.confirm.noPlanBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const items = finding.section.items;
  const remove = items.filter((i) => i.action === 'delete' || i.action === 'trash').length;
  const kept = items.filter((i) => i.action === 'skip').length;
  const stale = openedAt - finding.at > FRESH_MS;
  const offline = check.error instanceof AccountError && (check.error.kind === 'offline' || check.error.kind === 'server');
  const noRuns = env.accountsConfigured && allowance !== null && !allowance.plan.unlimited && runsLeft(allowance) === 0;
  const checking = env.accountsConfigured && (check.isFetching || allowance === null) && !offline;

  const reasons = [
    ...(live ? [t('flow.confirm.reasonBusy')] : []),
    ...(stale ? [t('flow.confirm.reasonStale')] : []),
    ...(noRuns ? [t('flow.confirm.reasonNoRuns')] : []),
    ...(checking ? [t('flow.confirm.reasonChecking')] : []),
  ];
  const blocked = reasons.length > 0 || offline || busy || owned;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      let claimId: string | null = null;
      if (env.accountsConfigured) {
        const claim = await claimRun(plan.sections);
        if (!claim.ok) {
          setError(translate('flow.confirm.claimRefused'));
          return;
        }
        claimId = claim.claim_id;
      }
      const runId = await start({ sections: plan.sections, dryRun: false, profile: plan.profile, name: plan.name, claimId });
      const failed = useRun.getState().startError;
      if (!runId && failed) {
        setError(translate('flow.confirm.claimFailed', { message: failed.message || failed.kind }));
        return;
      }
      goTo(navigate, '/run');
    } catch (e) {
      setError(translate('flow.confirm.claimFailed', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workbench">
      <PageHead
        id="h-confirm"
        dateline={t('flow.confirm.dateline', { when: formatDateTime(finding.at) })}
        title={t('flow.confirm.title')}
        lede={t('flow.confirm.lede')}
        actions={<AppLink to="/preview" className="btn btn-quiet">{t('flow.confirm.back')}</AppLink>}
      />
      <section className="panel span-7" aria-labelledby="h-what" data-tour={t('flow.confirm.whatTour')}>
        <div className="panel-head"><span className="idx">§ 01</span><h2 id="h-what">{t('flow.confirm.whatTitle')}</h2><span className="rule" /></div>
        <ul className="checklist">
          {[
            t('flow.confirm.checkRemove', { count: remove, size: finding.section.plannedKb ? formatKb(finding.section.plannedKb) : '—' }),
            t('flow.confirm.checkKept', { count: kept }),
            t('flow.confirm.checkPreviewed', { when: formatDateTime(finding.at) }),
            t('flow.confirm.checkLog'),
          ].map((line) => (
            <li key={line}><Icon name="check" /><span>{line}</span></li>
          ))}
        </ul>
        <hr className="perf" />
        <p className="callout warn">{t('flow.confirm.permanent')}</p>
      </section>
      <section className="span-5 stack-v" aria-label={t('flow.confirm.allowTitle')}>
        <div className="panel inset" data-tour={t('flow.confirm.allowTour')}>
          <div className="panel-head"><span className="idx">§ 02</span><h2>{t('flow.confirm.allowTitle')}</h2><span className="rule" /></div>
          <AllowanceBox checking={checking} offline={offline} />
        </div>
        <div className="row-actions">
          <Btn variant="run" tag={t('common.run')} isDisabled={blocked} aria-busy={busy} onPress={() => void run()}>
            {t('flow.confirm.run')}
          </Btn>
          {stale ? <PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('flow.ledger.rerun')}</PreviewBtn> : null}
          <RouterLink to="/" className="btn btn-quiet">{t('common.cancel')}</RouterLink>
        </div>
        <p className="lede" aria-live="polite">
          {error ?? (reasons.length ? t('flow.confirm.waiting', { reasons: reasons.join(', ') }) : t('flow.confirm.ready'))}
        </p>
      </section>
    </div>
  );
}
