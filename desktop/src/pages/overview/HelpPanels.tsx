import { AppLink, Panel, Stamp, ExternalLink } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { AccountsOff } from '@/components/states/NotInApp';
import { PunchCard } from '@/components/allowance/PunchCard';
import { useT } from '@/i18n';
import { formatKb } from '@/i18n/format';
import { SECTION_IDS, TIER, type Tier } from '@/data/sections';
import { useCliInfo, useHealth, useSystemInfo } from '@/hooks/useLocal';
import { env, missingSupabaseVars } from '@/config/env';
import { Plates } from '@/pages/overview/OverviewPage';

const TIERS: Tier[] = ['routine', 'trash', 'permanent', 'read'];

function Health() {
  const t = useT();
  const sys = useSystemInfo();
  const cli = useCliInfo();
  const health = useHealth();
  const h = health.data;
  const na = t('overview.health.na');
  const rows: [string, string, boolean][] = [];
  if (h) {
    rows.push([t('overview.health.smart'), h.smart_status ?? na, Boolean(h.smart_status && !/verified/i.test(h.smart_status))]);
    if (h.battery.present) {
      rows.push([t('overview.health.battery'), h.battery.condition ?? na, Boolean(h.battery.condition && !/normal/i.test(h.battery.condition))]);
      rows.push([t('overview.health.cycles'), h.battery.cycle_count !== null ? String(h.battery.cycle_count) : na, false]);
    }
    rows.push([t('overview.health.fda'), h.full_disk_access === null ? na : t(h.full_disk_access ? 'overview.health.granted' : 'overview.health.notGranted'), h.full_disk_access === false]);
  }
  if (sys.data) {
    rows.push([t('overview.health.macos'), sys.data.os_version, false]);
    rows.push([t('overview.health.chip'), sys.data.arch, false]);
    rows.push([t('overview.health.memory'), formatKb(sys.data.ram_bytes / 1024), false]);
  }
  if (cli.data) rows.push([t('overview.health.script'), cli.data.ok ? t('overview.health.verified') : t('overview.health.failed'), !cli.data.ok]);
  return (
    <Panel idx={t('overview.health.idx')} title={t('overview.health.title')} titleId="h-health" className="span-3">
      <div className="readouts">
        {rows.map(([k, v, warn]) => (
          <div className="readout" key={k}>
            <span>{k}</span>
            <b className={warn ? 'warn' : undefined}>{v}</b>
          </div>
        ))}
      </div>
      <p className="lede mt-3">{t('overview.health.lede')}</p>
    </Panel>
  );
}

function Allowance() {
  const t = useT();
  return (
    <Panel idx={t('overview.allowance.idx')} title={t('overview.allowance.title')} titleId="h-allow" className="span-7" tour={t('overview.allowance.tour')}>
      {env.accountsConfigured ? <PunchCard /> : <AccountsOff vars={missingSupabaseVars} />}
      <p className="lede mt-3">{t('overview.allowance.lede')}</p>
      <p className="lede mt-2">
        <AppLink to="/plans" className="link-arrow">{t('overview.allowance.compare')}</AppLink>
      </p>
    </Panel>
  );
}

function Tiers() {
  const t = useT();
  return (
    <Panel idx={t('overview.tiers.idx')} title={t('overview.tiers.title')} titleId="h-tiers" className="span-5" inset>
      <div className="tiers">
        {TIERS.map((tier) => {
          const ids = SECTION_IDS.filter((n) => TIER[n] === tier);
          return (
            <div className="tier" key={tier}>
              <Stamp tier={tier} />
              <div>
                {t(`overview.tiers.${tier}`)} <b>{t('overview.tiers.count', { count: ids.length })}</b>
                <Plates ids={ids} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Release() {
  const t = useT();
  const cli = useCliInfo();
  return (
    <section className="release span-8 wide" aria-labelledby="h-new">
      <div className="ver">
        <small>{t('overview.release.small')}</small>
        {cli.data?.version ?? env.appVersion}
      </div>
      <div>
        <h2 id="h-new">{t('overview.release.title')}</h2>
        <p>{t('overview.release.body')}</p>
      </div>
      <ExternalLink href={`${env.docsUrl}/getting-started/upgrading-to-5`} className="link-arrow">
        {t('overview.release.notes')}
      </ExternalLink>
    </section>
  );
}

function Tips() {
  const t = useT();
  const tips = [
    ['before-you-run/dry-run', t('overview.tips.dryRun'), t('overview.tips.dryRunSub')],
    ['before-you-run/what-gets-deleted', t('overview.tips.deleted'), t('overview.tips.deletedSub')],
    ['recovery', t('overview.tips.recovery'), t('overview.tips.recoverySub')],
  ] as const;
  return (
    <Panel idx={t('overview.tips.idx')} title={t('overview.tips.title')} titleId="h-tips" className="span-4">
      <div className="tips">
        {tips.map(([path, title, sub]) => (
          <ExternalLink key={path} href={`${env.docsUrl}/${path}`} className="tip">
            <Icon name="book" />
            <span>
              <b>{title}</b>
              {sub}
            </span>
          </ExternalLink>
        ))}
      </div>
    </Panel>
  );
}

/** Overview panels: health, allowance, safety stamps, release and the manual. */
export function HelpPanels() {
  return (
    <>
      <Health />
      <Allowance />
      <Tiers />
      <Release />
      <Tips />
    </>
  );
}
