import { useState } from 'react';
import { Button, Form } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Btn, Panel } from '@/components/ui/primitives';
import { FormTextField } from '@/components/form/FormTextField';
import { DataTable, columnsFor } from '@/components/table/DataTable';
import { useT } from '@/i18n';
import { useSession } from '@/stores/session';
import { AdminFrame, ReasonField, admin, reasonSchema, useAdminWrite } from '@/pages/admin/shared';

interface Row { key: string; value: unknown; is_public: boolean; min_value: number | null; max_value: number | null; description: string | null }
const col = columnsFor<Row>();

/** Edit one app_config value; a numeric field must parse and stay inside its admin range. */
function EditValue({ row, onDone }: { row: Row; onDone: () => void }) {
  const t = useT();
  const save = useAdminWrite<{ key: string; value: number | boolean | string; reason: string }>('config.set');
  const numeric = typeof row.value === 'number';
  const schema = z.object({
    value: z.string().trim().min(1).refine((v) => !numeric || (Number.isFinite(Number(v))
      && (row.min_value === null || Number(v) >= row.min_value) && (row.max_value === null || Number(v) <= row.max_value))),
    reason: reasonSchema,
  });
  const { control, handleSubmit } = useForm<{ value: string; reason: string }>({ resolver: zodResolver(schema), defaultValues: { value: String(row.value), reason: '' } });
  const parse = (raw: string): number | boolean | string => (numeric ? Number(raw) : typeof row.value === 'boolean' ? raw === 'true' : raw);
  return (
    <Form className="stack-v" validationBehavior="aria" onSubmit={handleSubmit((v) => save.mutate({ key: row.key, value: parse(v.value.trim()), reason: v.reason.trim() }, { onSuccess: onDone }))}>
      <FormTextField control={control} name="value" label={t('admin.config.value')} mono />
      <ReasonField control={control} />
      <Btn type="submit" variant="run" isDisabled={save.isPending}>{t('admin.config.save')}</Btn>
    </Form>
  );
}

/** Admin allowance & referral numbers: each an `app_config` field the server reads at decision time. */
export default function AdminConfigPage() {
  const t = useT();
  const role = useSession((s) => s.role);
  const q = useQuery({ queryKey: ['admin', 'config.get'], enabled: role === 'admin', queryFn: () => admin<{ items: Row[] }>('config.get') });
  const [edit, setEdit] = useState<Row | null>(null);
  const columns = col.columns([
    col.accessor('key', { header: t('admin.config.colKey'), cell: (c) => <><span className="path">{c.getValue()}</span><span className="sub">{c.row.original.description ?? ''}</span></> }),
    col.accessor((r) => String(r.value), { id: 'value', header: t('admin.config.colValue'), meta: { num: true } }),
    col.display({ id: 'range', header: t('admin.config.colRange'), cell: (c) => (c.row.original.min_value !== null || c.row.original.max_value !== null ? `${c.row.original.min_value ?? '—'} – ${c.row.original.max_value ?? '—'}` : '—') }),
    col.accessor((r) => (r.is_public ? t('admin.config.yes') : t('admin.config.no')), { id: 'public', header: t('admin.config.colPublic') }),
    col.display({ id: 'actions', header: '', enableSorting: false, meta: { num: true }, cell: (c) => <Button className="link-arrow" onPress={() => setEdit(c.row.original)}>{t('admin.config.edit')}</Button> }),
  ]);
  return (
    <AdminFrame id="h-adm-config" screen="shell.rail.adminConfig" title={t('admin.config.title')} lede={t('admin.config.lede')}>
      <Panel idx="§ 01" title={t('shell.rail.adminConfig')} titleId="h-config" className="span-8">
        {q.isPending ? <p className="lede">{t('states.loading')}</p> : <DataTable data={q.data?.items ?? []} columns={columns} empty={t('admin.empty')} rowKey={(r) => r.key} />}
      </Panel>
      {edit ? (
        <Panel idx="§ 02" title={edit.key} titleId="h-config-edit" className="span-4" inset>
          <EditValue key={edit.key} row={edit} onDone={() => setEdit(null)} />
        </Panel>
      ) : null}
    </AdminFrame>
  );
}
