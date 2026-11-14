import { useState } from 'react';
import { Button, Dialog, Form, Heading, Input, Label, Modal, ModalOverlay, SearchField } from 'react-aria-components';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Btn, Panel } from '@/components/ui/primitives';
import { FormTextField } from '@/components/form/FormTextField';
import { DataTable, columnsFor } from '@/components/table/DataTable';
import { useT, translate } from '@/i18n';
import { formatDate, formatNumber } from '@/i18n/format';
import { useSession } from '@/stores/session';
import { AdminFrame, LoadMore, ReasonField, admin, reasonSchema, useAdminList, useAdminWrite } from '@/pages/admin/shared';
import { UserOverride, type LimitsOverride } from '@/pages/admin/UserOverride';

interface UserRow { id: string; email: string; plan_id: string; role: string | null; machines: number; real_runs_this_month: number; joined_at: string; verified: boolean }
interface UserView extends UserRow { limits_override: LimitsOverride | null; grants: unknown[]; subscriptions: unknown[]; confirmed_referrals: number; devices: unknown[] }

const planSchema = z.object({
  plan: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  ends: z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), { error: () => translate('admin.users.endsAt') }),
  reason: reasonSchema,
});
type PlanValues = z.infer<typeof planSchema>;

function ViewAs({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const q = useQuery({ queryKey: ['admin', 'users.view', id], queryFn: () => admin<UserView>('users.view', { user_id: id }) });
  const setPlan = useAdminWrite<{ user_id: string; plan_id: string; ends_at?: string; reason: string }>('users.set_plan');
  const { control, handleSubmit } = useForm<PlanValues>({ resolver: zodResolver(planSchema), defaultValues: { plan: '', ends: '', reason: '' } });
  const reason = useWatch({ control, name: 'reason' });
  const u = q.data;
  return (
    <ModalOverlay className="scrim" isDismissable isOpen onOpenChange={(o) => !o && onClose()}>
      <Modal className="palette dialog-card">
        <Dialog className="stack-v dialog-body">
          <Heading slot="title" className="detail-title">{t('admin.users.viewTitle', { email: u?.email ?? '' })}</Heading>
          {u ? (
            <>
              <dl className="kv">
                <dt>{t('admin.users.colPlan')}</dt><dd>{u.plan_id}</dd>
                <dt>{t('admin.users.colRuns')}</dt><dd>{formatNumber(u.real_runs_this_month)}</dd>
                <dt>{t('admin.users.colMacs')}</dt><dd>{u.devices.length}</dd>
                <dt>{t('admin.users.grants')}</dt><dd>{u.grants.length}</dd>
                <dt>{t('admin.users.subs')}</dt><dd>{u.subscriptions.length}</dd>
                <dt>{t('admin.overview.referrals')}</dt><dd>{u.confirmed_referrals}</dd>
              </dl>
              <hr className="perf" />
              <Form className="stack-v" validationBehavior="aria" onSubmit={handleSubmit((v) => setPlan.mutate({
                user_id: id, plan_id: v.plan, reason: v.reason.trim(),
                ...(v.ends ? { ends_at: new Date(`${v.ends}T23:59:59Z`).toISOString() } : {}),
              }))}>
                <ReasonField control={control} />
                <div className="form-grid">
                  <FormTextField control={control} name="plan" label={t('admin.users.plan')} mono />
                  <FormTextField control={control} name="ends" label={t('admin.users.endsAt')} mono />
                </div>
                <div className="row-actions"><Btn type="submit" variant="run" isDisabled={setPlan.isPending}>{t('admin.users.setPlan')}</Btn></div>
              </Form>
              <hr className="perf" />
              <UserOverride key={JSON.stringify(u.limits_override)} userId={id} current={u.limits_override} reason={reason} />
            </>
          ) : <p className="lede">{t('states.loading')}</p>}
          <div className="row-actions"><Btn onPress={onClose}>{t('admin.users.close')}</Btn></div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

const col = columnsFor<UserRow>();

/** Admin users: search (URL), sortable page, view-as (read-only), set plan, override limits. */
export default function AdminUsersPage() {
  const t = useT();
  const role = useSession((s) => s.role);
  const { q: query = '' } = useSearch({ from: '/admin/users' });
  const navigate = useNavigate({ from: '/admin/users' });
  const [open, setOpen] = useState<string | null>(null);
  const list = useAdminList<UserRow>('users.list', query ? { query } : {}, role === 'admin');
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  const columns = col.columns([
    col.accessor('email', { header: t('admin.users.colEmail'), cell: (c) => <>{c.getValue()} <span className={`badge ${c.row.original.verified ? 'ok' : 'warn'}`}>{c.row.original.verified ? t('admin.users.verified') : t('admin.users.unverified')}</span></> }),
    col.accessor('plan_id', { header: t('admin.users.colPlan') }),
    col.accessor((r) => r.role ?? '—', { id: 'role', header: t('admin.users.colRole') }),
    col.accessor('machines', { header: t('admin.users.colMacs'), meta: { num: true } }),
    col.accessor('real_runs_this_month', { header: t('admin.users.colRuns'), meta: { num: true }, cell: (c) => formatNumber(c.getValue()) }),
    col.accessor((r) => Date.parse(r.joined_at), { id: 'joined', header: t('admin.users.colJoined'), cell: (c) => formatDate(c.getValue()) }),
    col.display({ id: 'actions', header: '', enableSorting: false, meta: { num: true }, cell: (c) => <Button className="link-arrow" onPress={() => setOpen(c.row.original.id)}>{t('admin.users.viewAs')}</Button> }),
  ]);
  return (
    <AdminFrame id="h-adm-users" screen="shell.rail.adminUsers" title={t('admin.users.title')} lede={t('admin.users.lede')}>
      <Panel idx="§ 01" title={t('shell.rail.adminUsers')} titleId="h-users" className="span-12">
        <SearchField className="field mb-3" value={query} onChange={(v) => void navigate({ search: { q: v || undefined }, replace: true })}>
          <Label>{t('admin.users.search')}</Label><Input className="input" />
        </SearchField>
        {list.isPending ? <p className="lede">{t('states.loading')}</p> : <DataTable data={rows} columns={columns} empty={t('admin.empty')} rowKey={(r) => r.id} />}
        <LoadMore q={list} />
      </Panel>
      {open ? <ViewAs id={open} onClose={() => setOpen(null)} /> : null}
    </AdminFrame>
  );
}
