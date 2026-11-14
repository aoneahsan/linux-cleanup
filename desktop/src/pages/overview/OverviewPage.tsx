import { Radio, RadioGroup } from 'react-aria-components';
import { AppLink, PreviewBtn, PageHead, Panel, Plate, RouterLink, Stamp, TagChip } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { DiskGauge } from '@/components/disk/DiskGauge';
import { ReceiptSlip } from '@/components/receipt/ReceiptSlip';
import { NotInApp } from '@/components/states/NotInApp';
import { useT } from '@/i18n';
import { formatDate, formatGiB } from '@/i18n/format';
import { PROFILES, SAFE_BATCH, TIER, type ProfileId, type Tier } from '@/data/sections';
import { useDisk, useSystemInfo } from '@/hooks/useLocal';
import { useReceipts } from '@/stores/receipts';
import { usePlan } from '@/stores/plan';
import { useSettings } from '@/stores/settings';
import { startPreview, startSafePreview } from '@/services/previewLauncher';
import { isTauri } from '@/lib/tauri';
import { ReviewPanels } from '@/pages/overview/ReviewPanels';
import { HelpPanels } from '@/pages/overview/HelpPanels';

/** A plate row for a list of section ids. */
export function Plates({ ids }: { ids: readonly number[] }) {
  return (
    <span className="plate-row">
      {ids.map((n) => (
        <Plate key={n} id={n} tier={TIER[n] ?? 'read'} />
      ))}
    </span>
  );
}

const tiersOf = (ids: readonly number[]): Tier[] => [...new Set(ids.map((n) => TIER[n] ?? 'read'))];

function DiskPanel() {
  const t = useT();
  const disk = useDisk();
  return (
    <Panel
      idx={t('overview.disk.idx')}
      title={t('overview.disk.title')}
      titleId="h-disk"
      className="span-8 wide"
      aside={disk.data ? t('overview.disk.aside', { size: formatGiB(disk.data.total_kb) }) : undefined}
      tour={t('overview.disk.tour')}
    >
      {!isTauri() ? (
        <NotInApp />
      ) : disk.data ? (
        <>
          <div className="gauge-top">
            <span className="gauge-free">
              {formatGiB(disk.data.free_kb)}
              <small>{t('overview.disk.freeNow')}</small>
            </span>
            {disk.data.snapshots > 0 ? <TagChip tone="note">{t('overview.disk.snapChip', { count: disk.data.snapshots })}</TagChip> : null}
          </div>
          <DiskGauge disk={disk.data} />
          {disk.data.snapshots > 0 ? (
            <div className="gauge-note">
              <Icon name="alert" />
              <p>
                <b>{t('overview.disk.noteTitle')}</b> {t('overview.disk.noteBody')}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="gauge-detail">{t('states.loading')}</p>
      )}
    </Panel>
  );
}

function OrderPanel() {
  const t = useT();
  const last = useReceipts((s) => s.receipts.find((r) => r.dryRun && r.name === t('sections.safeBatch')));
  return (
    <section className="panel inset span-4" aria-labelledby="h-order" data-tour={t('overview.order.tour')}>
      <div className="order">
        <div className="panel-head">
          <span className="idx">{t('overview.order.idx')}</span>
          <h2 id="h-order">{t('overview.order.title')}</h2>
          <span className="rule" />
        </div>
        <h3>{t('overview.order.heading')}</h3>
        <div className="meta">
          {tiersOf(SAFE_BATCH).map((tier) => (
            <Stamp key={tier} tier={tier} />
          ))}
        </div>
        <Plates ids={SAFE_BATCH} />
        <p className="lede">
          {t('overview.order.lede')} {last ? t('overview.order.lastPreviewed', { date: formatDate(last.at) }) : null}
        </p>
        <div className="stack">
          <PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>
            {t('overview.order.button')}
          </PreviewBtn>
          <span className="free-line">
            <TagChip>{t('overview.order.free')}</TagChip>
            {t('overview.order.freeLine')}
          </span>
        </div>
      </div>
    </section>
  );
}

function ProfilesPanel() {
  const t = useT();
  const id = usePlan((s) => s.overviewProfile) as ProfileId;
  const setId = usePlan((s) => s.setOverviewProfile);
  const p = PROFILES.find((x) => x.id === id) ?? PROFILES[0];
  if (!p) return null;
  const tiers = tiersOf(p.sections);
  return (
    <Panel idx={t('overview.profiles.idx')} title={t('overview.profiles.title')} titleId="h-profiles" className="span-12" aside={t('overview.profiles.aside')} tour={t('overview.profiles.tour')}>
      <RadioGroup aria-labelledby="h-profiles" value={id} onChange={(v) => setId(v as ProfileId)} orientation="horizontal">
        <div className="profiles">
          {PROFILES.map((x) => (
            <Radio key={x.id} value={x.id} className="profile">
              <span className="pname">{t('overview.profiles.flag', { id: x.id })}</span>
              <span className="pdesc">{t(`sections.profiles.${x.id}`)}</span>
              <Plates ids={x.sections} />
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <div className="profile-detail">
        <p className="lede">
          <b>{t('overview.profiles.count', { count: p.sections.length })}</b>{' '}
          {tiers.map((tier) => (
            <Stamp key={tier} tier={tier} />
          ))}{' '}
          {tiers.includes('permanent') ? t('overview.profiles.permanentNote') : null}
        </p>
        <PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview(p.sections, t('overview.profiles.runName', { id: p.id }), p.id)}>
          {t('overview.profiles.preview', { id: p.id })}
        </PreviewBtn>
      </div>
    </Panel>
  );
}

function ReceiptsPanel() {
  const t = useT();
  const receipts = useReceipts((s) => s.receipts);
  return (
    <Panel
      idx={t('overview.receipts.idx')}
      title={t('overview.receipts.title')}
      titleId="h-receipts"
      className="span-5"
      aside={<AppLink to="/history" className="link-arrow">{t('overview.receipts.all')}</AppLink>}
    >
      <div className="receipts">
        {receipts.length ? receipts.slice(0, 3).map((r) => <ReceiptSlip key={r.id} receipt={r} />) : <p className="lede">{t('overview.receipts.empty')}</p>}
      </div>
    </Panel>
  );
}

/** Overview: the disk gauge, the next preview, profiles, receipts and the review panels. */
export default function OverviewPage() {
  const t = useT();
  const sys = useSystemInfo();
  const previewKeys = useSettings((s) => s.bindings.preview);
  return (
    <div className="workbench">
      <PageHead
        id="h-overview"
        dateline={sys.data ? t('overview.dateline', { version: sys.data.os_version }) : t('overview.datelineNoMac')}
        title={t('overview.title')}
        lede={t('overview.lede')}
        actions={
          <>
            <PreviewBtn tag={t('common.dryRun')} kbd={previewKeys} onPress={() => void startSafePreview()}>
              {t('overview.previewSafe')}
            </PreviewBtn>
            <RouterLink to="/sections" className="btn btn-quiet">
              <Icon name="plates" />
              {t('overview.choose')}
            </RouterLink>
          </>
        }
      />
      <DiskPanel />
      <OrderPanel />
      <ProfilesPanel />
      <ReceiptsPanel />
      <ReviewPanels />
      <HelpPanels />
    </div>
  );
}
