import { useState } from 'react';
import { Button, Checkbox, Form } from 'react-aria-components';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Btn, Panel } from '@/components/ui/primitives';
import { FormTextField } from '@/components/form/FormTextField';
import { DataTable, columnsFor } from '@/components/table/DataTable';
import { useT, translate } from '@/i18n';
import { formatDate } from '@/i18n/format';
import { useSession } from '@/stores/session';
import { AdminFrame, LoadMore, ReasonField, reasonSchema, useAdminList, useAdminWrite } from '@/pages/admin/shared';

interface Grant { id: string; user_id: string; user_email: string | null; plan_id: string; source: string; reason: string | null; starts_at: string; ends_at: string; revoked_at: string | null; granted_by: string | null }

const schema = z.object({
  userId: z.uuid(),
  plan: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  ends: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => translate('admin.grants.endsAt') }),
  reason: reasonSchema,
});
type Values = z.infer<typeof schema>;
const col = columnsFor<Grant>();

/** Admin plan grants with provenance (source + granted by); create and revoke, each audited with a reason. */
export default function AdminGrantsPage() {
  const t = useT();
  const role = useSession((s) => s.role);
  const [activeOnly, setActiveOnly] = useState(true);
  const list = useAdminList<Grant>('grants.list', { active_only: activeOnly }, role === 'admin');
  const create = useAdminWrite<{ user_id: string; plan_id: string; ends_at: string; reason: string }>('grants.create');
  const revoke = useAdminWrite<{ grant_id: string; reason: string }>('grants.revoke');
  const { control, handleSubmit, reset } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { userId: '', plan: 'pro', ends: '', reason: '' } });
  const reason = useWatch({ control, name: 'reason' });
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const columns = col.columns([
    col.accessor((g) => g.user_email ?? g.user_id, { id: 'user', header: t('admin.grants.colUser'), cell: (c) => <>{c.getValue()}<span className="sub">{c.row.original.reason ?? ''}</span></> }),
    col.accessor('plan_id', { header: t('admin.grants.colPlan') }),
    col.accessor('source', { header: t('admin.grants.colSource'), cell: (c) => <span className="badge">{c.getValue()}</span> }),
    col.accessor((g) => g.granted_by ?? '—', { id: 'by', header: t('admin.grants.colBy') }),
    col.accessor((g) => Date.parse(g.ends_at), { id: 'ends', header: t('admin.grants.colEnds'), cell: (c) => (c.row.original.revoked_at ? <span className="badge bad">{t('admin.grants.revoked')}</span> : formatDate(c.getValue())) }),
    col.display({ id: 'actions', header: '', enableSorting: false, meta: { num: true }, cell: (c) => (c.row.original.revoked_at ? null : (
      <Button className="link-arrow" isDisabled={!reason.trim()} onPress={() => revoke.mutate({ grant_id: c.row.original.id, reason: reason.trim() })}>{t('admin.grants.revoke')}</Button>
    )) }),
  ]);
  return (
    <AdminFrame id="h-adm-grants" screen="shell.rail.adminGrants" title={t('admin.grants.title')} lede={t('admin.grants.lede')}>
      <Panel idx="§ 01" title={t('shell.rail.adminGrants')} titleId="h-grants" className="span-8"
        aside={<Checkbox className="check" isSelected={activeOnly} onChange={setActiveOnly}><span className="punch" aria-hidden="true" />{t('admin.grants.activeOnly')}</Checkbox>}>
        {list.isPending ? <p className="lede">{t('states.loading')}</p> : <DataTable data={rows} columns={columns} empty={t('admin.empty')} rowKey={(g) => g.id} />}
        <LoadMore q={list} />
      </Panel>
      <Panel idx="§ 02" title={t('admin.grants.create')} titleId="h-grant-new" className="span-4" inset>
        <Form className="stack-v" validationBehavior="aria" onSubmit={handleSubmit((v) => create.mutate(
          { user_id: v.userId.trim(), plan_id: v.plan.trim(), ends_at: new Date(`${v.ends}T23:59:59Z`).toISOString(), reason: v.reason.trim() },
          { onSuccess: () => reset({ userId: '', plan: 'pro', ends: '', reason: '' }) },
        ))}>
          <FormTextField control={control} name="userId" label={t('admin.grants.userId')} mono />
          <FormTextField control={control} name="plan" label={t('admin.grants.colPlan')} mono />
          <FormTextField control={control} name="ends" label={t('admin.grants.endsAt')} mono />
          <ReasonField control={control} />
          <Btn type="submit" variant="run" isDisabled={create.isPending}>{t('admin.grants.createBtn')}</Btn>
        </Form>
      </Panel>
    </AdminFrame>
  );
}
