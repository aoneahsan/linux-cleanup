import { useState } from 'react';
import { Button } from 'react-aria-components';
import { PlanEditor, type Plan } from '@/pages/admin/PlanEditor';
import { DataTable, columnsFor } from '@/components/table/DataTable';
import { useQuery } from '@tanstack/react-query';
import { Btn, Panel } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { formatMoney, formatNumber } from '@/i18n/format';
import { levelOfTier } from '@/hooks/usePlans';
import { useSession } from '@/stores/session';
import { AdminFrame, admin } from '@/pages/admin/shared';

const col = columnsFor<Plan>();

/** Admin plans & limits: every limit and price is a plan-row field the server reads. */
export default function AdminPlansPage() {
  const t = useT();
  const role = useSession((s) => s.role);
  const q = useQuery({ queryKey: ['admin', 'plans.list'], enabled: role === 'admin', queryFn: () => admin<{ items: Plan[] }>('plans.list') });
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const columns = col.columns([
    col.accessor('name', { header: t('admin.plans.name'), cell: (c) => <><b>{c.getValue()}</b><span className="sub">{c.row.original.id}</span></> }),
    col.accessor('price_month_cents', { header: t('admin.plans.month'), meta: { num: true }, cell: (c) => formatMoney(c.getValue()) }),
    col.accessor('price_year_cents', { header: t('admin.plans.year'), meta: { num: true }, cell: (c) => formatMoney(c.getValue()) }),
    col.accessor('ai_questions_per_month', { header: t('admin.plans.colAssistant'), meta: { num: true }, cell: (c) => t('admin.plans.assistantCell', { level: t(`common.levels.${levelOfTier(c.row.original.ai_tier)}`), n: formatNumber(c.getValue() ?? 0) }) }),
    col.accessor((p) => (p.receipt_backup ? p.receipt_backup_max : -1), { id: 'backups', header: t('admin.plans.colBackups'), meta: { num: true }, cell: (c) => (c.getValue() >= 0 ? formatNumber(c.getValue()) : t('admin.plans.backupsOff')) }),
    col.accessor('is_active', { header: t('admin.plans.active'), cell: (c) => <span className={`badge ${c.getValue() ? 'ok' : ''}`}>{c.getValue() ? t('admin.config.yes') : t('admin.config.no')}</span> }),
    col.display({ id: 'actions', header: '', enableSorting: false, meta: { num: true }, cell: (c) => <Button className="link-arrow" onPress={() => setEdit(c.row.original)}>{t('admin.plans.edit')}</Button> }),
  ]);
  return (
    <AdminFrame id="h-adm-plans" screen="shell.rail.adminPlans" title={t('admin.plans.title')} lede={t('admin.plans.lede')}
      actions={<Btn icon="plus" onPress={() => setEdit({ is_active: true, min_seats: 1, rank: 0, price_month_cents: 0, price_year_cents: 0 })}>{t('admin.plans.newPlan')}</Btn>}>
      <Panel idx="§ 01" title={t('shell.rail.adminPlans')} titleId="h-plans-list" className={edit ? 'span-5' : 'span-12'}>
        <DataTable data={q.data?.items ?? []} columns={columns} empty={t('admin.empty')} rowKey={(p) => p.id} />
      </Panel>
      {edit ? <Panel idx="§ 02" title={edit.name ?? t('admin.plans.newPlan')} titleId="h-plan-edit" className="span-7" inset><PlanEditor key={edit.id ?? 'new'} plan={edit} onDone={() => setEdit(null)} /></Panel> : null}
    </AdminFrame>
  );
}
