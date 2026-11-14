import { useQuery } from '@tanstack/react-query';
import { AppLink, Panel, StateCard } from '@/components/ui/primitives';
import { DataTable, columnsFor } from '@/components/table/DataTable';
import { useT } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { env } from '@/config/env';
import { listReleases, type AdminRelease } from '@/services/releases';
import { useSession } from '@/stores/session';
import { AdminFrame } from '@/pages/admin/shared';
import { ReleaseForm } from '@/pages/admin/ReleaseForm';

const col = columnsFor<AdminRelease>();

/** Admin › Releases: the last 20 release records and the publish form (update flow layer 2). */
export default function AdminReleasesPage() {
  const t = useT();
  const role = useSession((s) => s.role);
  const q = useQuery({ queryKey: ['admin', 'releases.list'], enabled: role === 'admin', queryFn: () => listReleases({ limit: 20 }) });
  const items = q.data?.items ?? [];
  const columns = col.columns([
    col.accessor((r) => Date.parse(r.published_at), { id: 'published', header: t('releases.admin.colPublished'), cell: (c) => <span className="mono">{formatDateTime(c.getValue())}</span> }),
    col.accessor('platform', { header: t('releases.admin.colPlatform'), cell: (c) => t(`releases.platform.${c.getValue()}`) }),
    col.accessor('channel', { header: t('releases.admin.colChannel'), cell: (c) => <span className={`badge${c.getValue() === 'production' ? ' accent' : ''}`}>{t(`releases.channel.${c.getValue()}`)}</span> }),
    col.accessor('version', { header: t('releases.admin.colVersion'), cell: (c) => (
      <span className="mono">{c.getValue()}{c.row.original.min_native_version ? <span className="sub">{t('releases.admin.minSub', { v: c.row.original.min_native_version })}</span> : null}</span>
    ) }),
    col.accessor('severity', { header: t('releases.admin.colSeverity'), cell: (c) => <span className={`badge ${c.getValue() === 'urgent' ? 'bad' : 'ok'}`}>{t(`releases.severity.${c.getValue()}`)}</span> }),
    col.accessor('reason', { header: t('releases.admin.colReason'), enableSorting: false }),
    col.accessor('published_by', { header: t('releases.admin.colBy'), enableSorting: false }),
  ]);

  return (
    <AdminFrame id="h-rel" screen="shell.rail.adminReleases" title={t('releases.admin.title')} lede={t('releases.admin.lede')}>
      <Panel idx="§ 01" title={t('releases.admin.newTitle')} titleId="h-rel-new" className="span-7" tour={t('releases.admin.newTour')}>
        <ReleaseForm list={items} />
      </Panel>
      <Panel idx="§ 02" title={t('releases.admin.whatTitle')} titleId="h-rel-what" className="span-5" inset>
        <div className="readouts">
          <div className="readout"><span>{t('releases.admin.shipped')}</span><b>{env.appVersion}</b></div>
          <div className="readout"><span>{t('releases.admin.normal')}</span><b>{t('releases.admin.normalWhat')}</b></div>
          <div className="readout"><span>{t('releases.admin.urgent')}</span><b>{t('releases.admin.urgentWhat')}</b></div>
          <div className="readout"><span>{t('releases.admin.unreadable')}</span><b>{t('releases.admin.unreadableWhat')}</b></div>
        </div>
        <p className="lede mt-4">{t('releases.admin.auditNote')}</p>
        <div className="row-actions mt-4"><AppLink to="/admin/audit" className="link-arrow">{t('releases.admin.auditLink')}</AppLink></div>
      </Panel>
      <Panel idx="§ 03" title={t('releases.admin.listTitle')} titleId="h-rel-list" className="span-12" tour={t('releases.admin.listTour')}>
        {q.isError ? (
          <StateCard tone="offline" icon="wifioff" title={t('states.server.title')}>{t('releases.admin.loadFailed', { message: q.error instanceof Error ? q.error.message : String(q.error) })}</StateCard>
        ) : q.isPending ? <p className="lede">{t('states.loading')}</p> : (
          <DataTable data={items} columns={columns} empty={t('admin.empty')} rowKey={(r) => r.id} stack />
        )}
      </Panel>
    </AdminFrame>
  );
}
