import { Input, Label, TextField } from 'react-aria-components';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Panel } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { useSession } from '@/stores/session';
import { AdminFrame, LoadMore, useAdminList } from '@/pages/admin/shared';
import { DataTable, columnsFor } from '@/components/table/DataTable';

const col = columnsFor<Entry>();

interface Entry { id: string; at: string; action: string; actor: string; target: string | null; target_type: string | null; target_id: string | null; detail: unknown }

/** Admin audit log: append-only, newest first, cursor-paginated. */
export default function AdminAuditPage() {
  const t = useT();
  const role = useSession((s) => s.role);
  const { action = '' } = useSearch({ from: '/admin/audit' });
  const navigate = useNavigate({ from: '/admin/audit' });
  const valid = /^[a-z_]+\.[a-z_]+$/.test(action);
  const list = useAdminList<Entry>('audit.list', valid ? { filter_action: action } : {}, role === 'admin');
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const columns = col.columns([
    col.accessor((e) => Date.parse(e.at), { id: 'at', header: t('admin.audit.colAt'), cell: (c) => formatDateTime(c.getValue()) }),
    col.accessor('actor', { header: t('admin.audit.colActor') }),
    col.accessor('action', { header: t('admin.audit.colAction'), cell: (c) => <span className="path">{c.getValue()}</span> }),
    col.accessor((e) => e.target ?? e.target_id ?? '—', { id: 'target', header: t('admin.audit.colTarget') }),
    col.display({ id: 'detail', header: t('admin.audit.colDetail'), cell: (c) => <span className="path">{c.row.original.detail ? JSON.stringify(c.row.original.detail) : '—'}</span> }),
  ]);
  return (
    <AdminFrame id="h-adm-audit" screen="shell.rail.adminAudit" title={t('admin.audit.title')} lede={t('admin.audit.lede')}>
      <Panel idx="§ 01" title={t('shell.rail.adminAudit')} titleId="h-audit" className="span-12">
        <TextField className="field mb-3" value={action} onChange={(v) => void navigate({ search: { action: v || undefined }, replace: true })}>
          <Label>{t('admin.audit.filter')}</Label><Input className="input mono" />
        </TextField>
        {list.isPending ? <p className="lede">{t('states.loading')}</p> : <DataTable data={rows} columns={columns} empty={t('admin.empty')} rowKey={(e) => e.id} />}
        <LoadMore q={list} />
      </Panel>
    </AdminFrame>
  );
}
