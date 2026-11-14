import { useState } from 'react';
import { Input, Label, Text, TextField } from 'react-aria-components';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { AppLink, Btn, PageHead, RouterLink, StateCard, Stamp, goTo, useRunLive } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT, translate } from '@/i18n';
import { formatDateTime, plate } from '@/i18n/format';
import { DEEP_CONFIRM, SUDO, TIER, needsDeepOk, type Tier } from '@/data/sections';
import { Plates } from '@/pages/overview/OverviewPage';
import { uniqueKeys } from '@/pages/flow/PreviewPage';
import { usePlan } from '@/stores/plan';
import { useReceipts } from '@/stores/receipts';
import { useRun } from '@/stores/run';
import { runsLeft, useAllowance } from '@/stores/allowance';
import { useSession } from '@/stores/session';
import { AccountError, claimRun, refreshAllowance } from '@/services/account';
import { env } from '@/config/env';
import { DeviceOwned } from '@/components/allowance/DeviceOwned';

const TIERS: Tier[] = ['routine', 'trash', 'permanent', 'read'];
/** Paths the CLI accepts for keep/archive (CONTRACTS §2): absolute, single line, at most 5000. */
const MAX_PATHS = 5000;
const usable = (p: string) => p.startsWith('/') && !/[\r\n]/.test(p);

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

/** Confirm: the only screen that starts a real run. Typed gate, sudo notice, allowance claim. */
export default function ConfirmPage() {
  const t = useT();
  const navigate = useNavigate();
  const plan = usePlan((s) => s.plan);
  const decisions = usePlan((s) => s.decisions);
  const findings = useReceipts((s) => s.findings);
  const start = useRun((s) => s.start);
  const live = useRunLive();
  // The typed gate is a form field; its live value decides whether Run enables.
  const { control } = useForm<{ typed: string }>({ defaultValues: { typed: '' } });
  const typed = useWatch({ control, name: 'typed' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowance = useAllowance((s) => s.allowance);
  const owned = useAllowance((s) => s.deviceOwned);
  const check = useQuery({ queryKey: ['allowance'], queryFn: refreshAllowance, enabled: env.accountsConfigured, retry: 0, staleTime: 0 });

  if (!plan) {
    return (
      <div className="workbench">
        <div className="span-12">
          <StateCard icon="play" title={t('flow.confirm.noPlan')} actions={<RouterLink to="/sections" className="btn btn-preview"><span className="tag">{t('common.dryRun')}</span>{t('flow.live.pick')}</RouterLink>}>
            {t('flow.confirm.noPlanBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const deep = plan.sections.filter((id) => DEEP_CONFIRM.includes(id));
  const sudo = plan.sections.filter((id) => SUDO.includes(id));
  const unique = uniqueKeys(plan.sections, findings);
  const archive = unique.filter((u) => decisions[u.key] === 'archive').map((u) => u.path);
  const keep = unique.filter((u) => decisions[u.key] !== 'archive' && decisions[u.key] !== 'delete').map((u) => u.path);
  const previewedAt = Math.max(0, ...plan.sections.map((id) => findings[id]?.at ?? 0));
  const word = t('flow.confirm.typedWord');
  const typedOk = !deep.length || typed.trim().toLowerCase() === word;
  const offline = check.error instanceof AccountError && (check.error.kind === 'offline' || check.error.kind === 'server');
  const noRuns = env.accountsConfigured && allowance !== null && !allowance.plan.unlimited && runsLeft(allowance) === 0;
  const checking = env.accountsConfigured && (check.isFetching || allowance === null) && !offline;

  // A keep/archive choice the CLI cannot receive must stop the run, never be dropped.
  const unpassable = [...keep, ...archive].some((p) => !usable(p)) || keep.length > MAX_PATHS || archive.length > MAX_PATHS;
  const reasons = [
    ...(live ? [t('flow.confirm.reasonBusy')] : []),
    ...(unpassable ? [t('flow.confirm.reasonPaths')] : []),
    ...(noRuns ? [t('flow.confirm.reasonNoRuns')] : []),
    ...(checking ? [t('flow.confirm.reasonChecking')] : []),
    ...(!typedOk ? [t('flow.confirm.reasonTyped')] : []),
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
      const runId = await start({
        sections: plan.sections,
        dryRun: false,
        deepOk: needsDeepOk(plan.sections) && typedOk,
        profile: plan.profile,
        name: plan.name,
        claimId,
        keepPaths: keep,
        archivePaths: archive,
      });
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
        dateline={t('flow.confirm.dateline', { name: plan.name, count: plan.sections.length })}
        title={t('flow.confirm.title')}
        lede={t('flow.confirm.lede')}
        actions={<AppLink to="/preview" className="btn btn-quiet">{t('flow.confirm.back')}</AppLink>}
      />
      <section className="panel span-7" aria-labelledby="h-what" data-tour={t('flow.confirm.whatTour')}>
        <div className="panel-head"><span className="idx">§ 01</span><h2 id="h-what">{t('flow.confirm.whatTitle')}</h2><span className="rule" /></div>
        <div className="tiers">
          {TIERS.map((tier) => {
            const ids = plan.sections.filter((id) => (TIER[id] ?? 'read') === tier);
            return ids.length ? (
              <div className="tier" key={tier}>
                <Stamp tier={tier} />
                <div><Plates ids={ids} /></div>
              </div>
            ) : null;
          })}
        </div>
        <hr className="perf" />
        <ul className="checklist">
          {[
            ...(previewedAt ? [t('flow.confirm.checkPreviewed', { when: formatDateTime(previewedAt) })] : []),
            archive.length ? t('flow.confirm.checkArchive', { count: archive.length }) : t('flow.confirm.checkNoUnique'),
            ...(keep.length ? [t('flow.confirm.checkKeep', { count: keep.length })] : []),
            t('flow.confirm.checkLog'),
          ].map((line) => (
            <li key={line}><Icon name="check" /><span>{line}</span></li>
          ))}
        </ul>
      </section>
      <section className="span-5 stack-v" aria-label={t('flow.confirm.whatTitle')}>
        {sudo.length ? (
          <div className="panel" data-tour={t('flow.confirm.sudoTour')}>
            <div className="panel-head"><span className="idx">§ 02</span><h2>{t('flow.confirm.sudoTitle')}</h2><span className="rule" /></div>
            <div className="keycard">
              <Icon name="key" />
              <div className="stack-v">
                <p className="lede">{t('flow.confirm.sudoWhy', { ids: sudo.map(plate).join(', ') })}</p>
                <p className="help lede">{t('flow.confirm.sudoHow')}</p>
              </div>
            </div>
          </div>
        ) : null}
        {deep.length ? (
          <div className="panel" data-tour={t('flow.confirm.typedTour')}>
            <div className="panel-head"><span className="idx">§ 03</span><h2>{t('flow.confirm.typedTitle')}</h2><span className="rule" /></div>
            <Controller control={control} name="typed" render={({ field }) => (
              <TextField className="field" value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={Boolean(typed) && !typedOk} autoComplete="off" spellCheck="false">
                <Label>{t('flow.confirm.typedLabel', { what: t('flow.confirm.typedWhat', { count: deep.length, ids: deep.map(plate).join(', ') }) })}</Label>
                <Input className="input mono typed" ref={field.ref} />
                <Text slot="description" className="help">{t('flow.confirm.typedHelp')}</Text>
              </TextField>
            )} />
          </div>
        ) : null}
        <div className="panel inset" data-tour={t('flow.confirm.allowTour')}>
          <div className="panel-head"><span className="idx">§ 04</span><h2>{t('flow.confirm.allowTitle')}</h2><span className="rule" /></div>
          <AllowanceBox checking={checking} offline={offline} />
        </div>
        <div className="row-actions">
          <Btn variant="run" tag={t('common.run')} isDisabled={blocked} aria-busy={busy} onPress={() => void run()}>
            {t('flow.confirm.run', { count: plan.sections.length })}
          </Btn>
          <RouterLink to="/" className="btn btn-quiet">{t('common.cancel')}</RouterLink>
        </div>
        <p className="lede" aria-live="polite">
          {error ?? (reasons.length ? t('flow.confirm.waiting', { reasons: reasons.join(', ') }) : t('flow.confirm.ready'))}
        </p>
      </section>
    </div>
  );
}
