import { AppLink, PreviewBtn, PageHead, Panel, TagChip } from '@/components/ui/primitives';
import { DiskGauge } from '@/components/disk/DiskGauge';
import { ReceiptSlip } from '@/components/receipt/ReceiptSlip';
import { NotInApp } from '@/components/states/NotInApp';
import { useT } from '@/i18n';
import { formatDate, formatGiB } from '@/i18n/format';
import { ALL_SAFE } from '@/data/sections';
import { useDisk, useSystemInfo } from '@/hooks/useLocal';
import { useReceipts } from '@/stores/receipts';
import { useSettings } from '@/stores/settings';
import { startSafePreview } from '@/services/previewLauncher';
import { isTauri } from '@/lib/tauri';

/**
 * Folders the CLI refuses to remove, from its own guard (`lib/common.sh` PROTECTED_PATHS).
 * Shown as facts; the guard, not this list, does the protecting.
 */
const PROTECTED = ['~/Documents', '~/Pictures', '~/Music', '~/Videos', '~/Desktop', '~/.ssh', '~/.gnupg', '~/.config'] as const;

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
          </div>
          <DiskGauge disk={disk.data} />
          <p className="help lede mt-3">{t('overview.disk.home')}</p>
        </>
      ) : (
        <p className="gauge-detail">{t('states.loading')}</p>
      )}
    </Panel>
  );
}

function AllSafePanel() {
  const t = useT();
  const finding = useReceipts((s) => s.findings[ALL_SAFE] ?? null);
  return (
    <section className="panel inset span-4" aria-labelledby="h-order" data-tour={t('overview.order.tour')}>
      <div className="order">
        <div className="panel-head">
          <span className="idx">{t('overview.order.idx')}</span>
          <h2 id="h-order">{t('overview.order.title')}</h2>
          <span className="rule" />
        </div>
        <h3>{t('overview.order.heading')}</h3>
        <p className="lede">
          {t('overview.order.lede')} {finding ? t('overview.order.lastPreviewed', { date: formatDate(finding.at) }) : null}
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

function StaysPanel() {
  const t = useT();
  return (
    <Panel idx={t('overview.stays.idx')} title={t('overview.stays.title')} titleId="h-stays" className="span-7" tour={t('overview.stays.tour')}>
      <p className="lede">{t('overview.stays.lede')}</p>
      <ul className="path-list mt-3">
        {PROTECTED.map((p) => (
          <li key={p}><span className="path">{p}</span></li>
        ))}
      </ul>
      <p className="help lede mt-3">{t('overview.stays.note')}</p>
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

/** Overview: free space, the all-safe dry run, what always stays, and the latest receipts. */
export default function OverviewPage() {
  const t = useT();
  const sys = useSystemInfo();
  const previewKeys = useSettings((s) => s.bindings.preview);
  return (
    <div className="workbench">
      <PageHead
        id="h-overview"
        dateline={sys.data ? t('overview.dateline', { version: sys.data.os_version }) : t('overview.datelineNoMachine')}
        title={t('overview.title')}
        lede={t('overview.lede')}
        actions={
          <PreviewBtn tag={t('common.dryRun')} kbd={previewKeys} onPress={() => void startSafePreview()}>
            {t('overview.previewSafe')}
          </PreviewBtn>
        }
      />
      <DiskPanel />
      <AllSafePanel />
      <StaysPanel />
      <ReceiptsPanel />
    </div>
  );
}
