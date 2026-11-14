import { useEffect, useState } from 'react';
import { track } from '@/services/analytics';
import { Label, NumberField, Input, Radio, RadioGroup } from 'react-aria-components';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AppLink, Btn, PageHead, Panel, StateCard } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { AccountsOff } from '@/components/states/NotInApp';
import { ConsentLine } from '@/components/plans/ConsentLine';
import { useT, translate } from '@/i18n';
import { formatMoney, formatNumber } from '@/i18n/format';
import { env, missingSupabaseVars } from '@/config/env';
import { levelOfTier, usePlans, type PlanRow } from '@/hooks/usePlans';
import { usePublicConfig } from '@/hooks/usePublicConfig';
import { useSession } from '@/stores/session';
import { callFunction } from '@/services/account';
import { openExternal } from '@/lib/open';
import { toast } from '@/lib/feedback';

type Interval = 'month' | 'year';

function Features({ p, device, account }: { p: PlanRow; device: number | null; account: number | null }) {
  const t = useT();
  const d = p.device_real_runs_per_month ?? device;
  const a = p.account_extra_real_runs_per_month ?? account;
  const lines = [
    p.real_runs_unlimited ? t('account.plans.unlimited') : d !== null && a !== null ? t('account.plans.runs', { device: d, account: a }) : null,
    t('account.plans.all'),
    t('account.plans.previews'),
    p.history_sync && p.max_synced_machines ? t('account.plans.sync', { n: p.max_synced_machines }) : null,
    p.schedules ? t('account.plans.schedules') : null,
    p.exports ? t('account.plans.exports') : null,
    p.fleet_reports ? t('account.plans.fleet', { n: p.min_seats }) : null,
    p.ai_questions_per_month > 0 ? t('account.plans.assistant', { n: formatNumber(p.ai_questions_per_month), level: t(`common.levels.${levelOfTier(p.ai_tier)}`) }) : null,
    p.receipt_backup && p.receipt_backup_max > 0 ? t('account.plans.backups', { n: formatNumber(p.receipt_backup_max) }) : null,
  ].filter((x): x is string => Boolean(x));
  return <ul>{lines.map((l) => <li key={l}><Icon name="check" /><span>{l}</span></li>)}</ul>;
}

function PlanCard({ p, interval, current, signedIn, device, account }: { p: PlanRow; interval: Interval; current: boolean; signedIn: boolean; device: number | null; account: number | null }) {
  const t = useT();
  const [seats, setSeats] = useState(Math.max(1, p.min_seats));
  const [busy, setBusy] = useState(false);
  const cents = interval === 'year' ? p.price_year_cents : p.price_month_cents;
  const free = p.price_month_cents === 0 && p.price_year_cents === 0;
  const per = p.per_seat ? (interval === 'year' ? 'perSeatYear' : 'perSeatMonth') : interval === 'year' ? 'perYear' : 'perMonth';
  const buy = async () => {
    setBusy(true);
    try {
      toast(translate('account.plans.opening'));
      track('checkout_opened', { plan_id: p.id, interval });
      const body: { plan_id: string; interval: Interval; seats?: number } = { plan_id: p.id, interval };
      if (p.per_seat) body.seats = seats;
      const { url } = await callFunction<{ url: string }>('polar-checkout', { body });
      await openExternal(url);
    } catch (e) {
      toast(translate('account.plans.checkoutFailed', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className={`plan-card${current ? ' current' : ''}`}>
      <h3>{p.name}</h3>
      <div className="price">{free ? formatMoney(0) : formatMoney(cents)}{free ? null : <small>{t(`account.plans.${per}`)}</small>}</div>
      {p.description ? <p className="lede">{p.description}</p> : null}
      <Features p={p} device={device} account={account} />
      <div className="foot">
        {current ? <span className="badge accent">{t('account.plans.current')}</span> : free ? null : (
          <>
            {p.per_seat ? (
              <NumberField className="field" value={seats} minValue={p.min_seats} maxValue={1000} onChange={(n) => Number.isFinite(n) && setSeats(n)}>
                <Label>{t('account.plans.seats')}</Label>
                <Input className="input mono" />
              </NumberField>
            ) : null}
            <Btn variant="run" isDisabled={!signedIn || busy} aria-busy={busy} onPress={() => void buy()}>{t('account.plans.choose', { name: p.name })}</Btn>
            <ConsentLine />
          </>
        )}
      </div>
    </article>
  );
}

/** Plans: Free / Pro / Team from the plans table; Polar checkout opens in the browser. */
export default function PlansPage() {
  const t = useT();
  const navigate = useNavigate({ from: '/plans' });
  const { interval = 'year' } = useSearch({ from: '/plans' });
  const plans = usePlans();
  useEffect(() => track('plan_viewed'), []);
  const cfg = usePublicConfig();
  const { signedIn, plan } = useSession();
  const device = cfg.data?.deviceRuns ?? null;
  const account = cfg.data?.accountExtraRuns ?? null;
  const rows = plans.data ?? [];
  const team = rows.find((p) => p.per_seat);
  const cell = (p: PlanRow, k: 'runs' | 'machines' | 'schedules' | 'exports' | 'fleet' | 'assistant' | 'backups') => {
    if (k === 'assistant') return p.ai_questions_per_month > 0 ? t('account.plans.assistantCell', { n: formatNumber(p.ai_questions_per_month), level: t(`common.levels.${levelOfTier(p.ai_tier)}`) }) : t('account.plans.dash');
    if (k === 'backups') return p.receipt_backup && p.receipt_backup_max > 0 ? formatNumber(p.receipt_backup_max) : t('account.plans.dash');
    if (k === 'runs') return p.real_runs_unlimited ? t('account.plans.unlimitedShort') : `${p.device_real_runs_per_month ?? device ?? '—'} + ${p.account_extra_real_runs_per_month ?? account ?? '—'}`;
    if (k === 'machines') return p.history_sync && p.max_synced_machines ? String(p.max_synced_machines) : t('account.plans.dash');
    const on = k === 'schedules' ? p.schedules : k === 'exports' ? p.exports : p.fleet_reports;
    return on ? t('account.plans.yes') : t('account.plans.dash');
  };

  return (
    <div className="workbench">
      <PageHead
        id="h-plans"
        dateline={t('account.plans.dateline')}
        title={t('account.plans.title')}
        lede={t('account.plans.lede')}
        actions={
          <RadioGroup className="billing-toggle" aria-label={t('account.plans.billing')} orientation="horizontal" value={interval}
            onChange={(v) => void navigate({ search: { interval: v === 'year' ? undefined : (v as Interval) }, replace: true })}>
            <Radio value="month">{t('account.plans.monthly')}</Radio>
            <Radio value="year">{t('account.plans.yearly')}</Radio>
          </RadioGroup>
        }
      />
      <section className="span-12" aria-label={t('account.plans.title')} data-tour={t('account.plans.tour')}>
        {!env.accountsConfigured ? <AccountsOff vars={missingSupabaseVars} /> : plans.error ? (
          <StateCard tone="offline" icon="alert" title={t('states.server.title')}>{t('account.plans.loadFailed')}</StateCard>
        ) : (
          <div className="plan-cards">
            {rows.map((p) => <PlanCard key={p.id} p={p} interval={interval} current={p.id === plan} signedIn={signedIn} device={device} account={account} />)}
          </div>
        )}
        {env.accountsConfigured && !signedIn ? <p className="lede mt-3"><AppLink to="/account" className="link-arrow">{t('account.plans.signInToBuy')}</AppLink></p> : null}
      </section>
      {rows.length ? (
        <Panel idx="§ 02" title={t('account.plans.compareTitle')} titleId="h-compare" className="span-8">
          <table className="ledger">
            <thead><tr><th>{t('account.plans.colWhat')}</th>{rows.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
            <tbody>
              {(['runs', 'machines', 'schedules', 'exports', 'fleet', 'assistant', 'backups'] as const).map((k) => (
                <tr key={k}>
                  <td>{t(`account.plans.row${k[0]?.toUpperCase()}${k.slice(1)}` as never)}</td>
                  {rows.map((p) => <td key={p.id}>{cell(p, k)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}
      <Panel idx="§ 03" title={t('account.plans.faqTitle')} titleId="h-plan-faq" className="span-4" inset>
        <dl className="kv faq-kv">
          <dt>{t('account.plans.faqCancel')}</dt><dd>{t('account.plans.faqCancelBody')}</dd>
          <dt>{t('account.plans.faqCheckout')}</dt><dd>{t('account.plans.faqCheckoutBody')}</dd>
          <dt>{t('account.plans.faqPreviews')}</dt><dd>{t('account.plans.faqPreviewsBody')}</dd>
          {team ? <><dt>{t('account.plans.faqSeats')}</dt><dd>{t('account.plans.faqSeatsBody', { n: team.min_seats })}</dd></> : null}
        </dl>
      </Panel>
    </div>
  );
}
