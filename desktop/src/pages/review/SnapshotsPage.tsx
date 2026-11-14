import { PageHead, Panel, PreviewBtn, Stamp } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { formatDateTime, formatKb } from '@/i18n/format';
import { useBackup, useDisk } from '@/hooks/useLocal';
import { useReceipts } from '@/stores/receipts';
import { NeedsPreview } from '@/pages/review/shared';
import { startPreview } from '@/services/previewLauncher';

/** Snapshots: local APFS snapshots and the space section 11 would release. */
export default function SnapshotsPage() {
  const t = useT();
  const disk = useDisk();
  const backup = useBackup();
  const f = useReceipts((s) => s.findings[11]);
  const count = disk.data?.snapshots ?? 0;
  const name = t('sectionsPage.sectionName', { id: 11 });
  return (
    <div className="workbench">
      <PageHead
        id="h-snap"
        dateline={t('review.snapshots.dateline', { count })}
        title={t('review.snapshots.title')}
        lede={t('review.snapshots.lede')}
        actions={<PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview([11], name)}>{t('review.snapshots.preview')}</PreviewBtn>}
      />
      <Panel idx="§ 01" title={t('review.snapshots.listTitle')} titleId="h-snap-list" className="span-7" tour={t('review.snapshots.listTour')}>
        {f ? (
          f.section.items.length ? (
            <table className="ledger">
              <thead><tr><th>{t('review.snapshots.colSnapshot')}</th><th className="num">{t('review.snapshots.colHolds')}</th><th>{t('review.snapshots.colBy')}</th><th>{t('review.snapshots.colTargeted')}</th></tr></thead>
              <tbody>
                {f.section.items.map((i) => {
                  const tm = i.path.includes('com.apple.TimeMachine');
                  return (
                    <tr key={i.path}>
                      <td><span className="path">{i.path}</span></td>
                      <td className="num">{i.kb ? formatKb(i.kb) : '—'}</td>
                      <td>{tm ? t('review.snapshots.byTm') : t('review.snapshots.byOther')}</td>
                      <td>{i.action === 'skip' ? <span className="badge ok">{t('review.snapshots.never')}</span> : <Stamp tier="permanent" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="lede">{t('review.snapshots.none')}</p>
          )
        ) : (
          <NeedsPreview ids={[11]} name={name} />
        )}
      </Panel>
      <aside className="span-5 stack-v" aria-label={t('review.snapshots.stateTitle')}>
        <Panel idx="§ 02" title={t('review.snapshots.stateTitle')} titleId="h-snap-state" inset>
          <dl className="kv">
            <dt>{t('review.snapshots.disk')}</dt>
            <dd>{backup.data ? (backup.data.configured ? t('review.snapshots.diskSet', { count: backup.data.destinations }) : t('review.snapshots.diskNone')) : t('overview.health.na')}</dd>
            <dt>{t('review.snapshots.last')}</dt>
            <dd>{backup.data?.last_backup_ms ? formatDateTime(backup.data.last_backup_ms) : t('overview.health.na')}</dd>
            <dt>{t('review.snapshots.count')}</dt>
            <dd>{backup.data ? String(backup.data.local_snapshots) : disk.data ? String(count) : '—'}</dd>
          </dl>
          {count || backup.data?.local_snapshots ? <p className="callout warn mt-4">{t('review.snapshots.callout')}</p> : null}
        </Panel>
        <Panel idx="§ 03" title={t('review.snapshots.beforeTitle')} titleId="h-snap-before">
          <ul className="checklist">
            <li><Icon name="check" /><span>{t('review.snapshots.before1')}</span></li>
            <li><Icon name="check" /><span>{t('review.snapshots.before2')}</span></li>
          </ul>
        </Panel>
      </aside>
    </div>
  );
}
