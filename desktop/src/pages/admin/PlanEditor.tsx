import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from 'react-aria-components';
import { Btn } from '@/components/ui/primitives';
import { FormTextField } from '@/components/form/FormTextField';
import { FormCardRadio, FormCheckbox, FormNumberField, FormSwitch } from '@/components/form/FormFields';
import { useT } from '@/i18n';
import type { PlanRow } from '@/hooks/usePlans';
import { ReasonField, reasonSchema, useAdminWrite } from '@/pages/admin/shared';

export type Plan = PlanRow & { is_active: boolean };

const n = (max: number) => z.number().int().min(0).max(max).nullable();
const schema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/),
  name: z.string().trim().min(1).max(40),
  description: z.string().max(300),
  rank: n(1000), price_month_cents: n(1000000), price_year_cents: n(10000000), min_seats: n(1000),
  device_real_runs_per_month: n(100000), account_extra_real_runs_per_month: n(100000), max_synced_machines: n(1000),
  is_active: z.boolean(), per_seat: z.boolean(), real_runs_unlimited: z.boolean(), history_sync: z.boolean(),
  schedules: z.boolean(), exports: z.boolean(), fleet_reports: z.boolean(),
  ai_tier: z.enum(['economy', 'standard', 'enhanced']), ai_surge_after_paid_months: n(120), ai_questions_per_month: n(100000),
  receipt_backup: z.boolean(), receipt_backup_max: n(100000),
  reason: reasonSchema,
});
type Values = z.infer<typeof schema>;

const NUMS = [['rank', 'rank'], ['price_month_cents', 'month'], ['price_year_cents', 'year'], ['min_seats', 'minSeats'], ['device_real_runs_per_month', 'device'], ['account_extra_real_runs_per_month', 'account'], ['max_synced_machines', 'machines'], ['ai_questions_per_month', 'aiQuestions'], ['ai_surge_after_paid_months', 'aiSurgeAfter'], ['receipt_backup_max', 'backupMax']] as const;
const BOOLS = [['is_active', 'active'], ['per_seat', 'perSeat'], ['real_runs_unlimited', 'unlimited'], ['history_sync', 'history'], ['schedules', 'schedules'], ['exports', 'exports'], ['fleet_reports', 'fleet']] as const;

/** Edit or create one plan row; every limit and price is an admin field. Blank optional values are left out. */
export function PlanEditor({ plan, onDone }: { plan: Partial<Plan>; onDone: () => void }) {
  const t = useT();
  const save = useAdminWrite<{ plan: Partial<Plan>; reason: string }>('plans.upsert');
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      id: plan.id ?? '', name: plan.name ?? '', description: plan.description ?? '',
      rank: plan.rank ?? 0, price_month_cents: plan.price_month_cents ?? 0, price_year_cents: plan.price_year_cents ?? 0, min_seats: plan.min_seats ?? 1,
      device_real_runs_per_month: plan.device_real_runs_per_month ?? null, account_extra_real_runs_per_month: plan.account_extra_real_runs_per_month ?? null,
      max_synced_machines: plan.max_synced_machines ?? null,
      is_active: plan.is_active ?? true, per_seat: plan.per_seat ?? false, real_runs_unlimited: plan.real_runs_unlimited ?? false,
      history_sync: plan.history_sync ?? false, schedules: plan.schedules ?? false, exports: plan.exports ?? false, fleet_reports: plan.fleet_reports ?? false,
      ai_tier: plan.ai_tier ?? 'economy', ai_surge_after_paid_months: plan.ai_surge_after_paid_months ?? null, ai_questions_per_month: plan.ai_questions_per_month ?? null,
      receipt_backup: plan.receipt_backup ?? false, receipt_backup_max: plan.receipt_backup_max ?? null,
      reason: '',
    },
  });
  return (
    <Form className="stack-v" validationBehavior="aria" onSubmit={handleSubmit(({ reason, ...v }) => {
      const out = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== '')) as Partial<Plan>;
      // Clearing the Surge months on a plan that had a number is a deliberate "never" (null), not a blank field.
      if (v.ai_surge_after_paid_months === null && typeof plan.ai_surge_after_paid_months === 'number') out.ai_surge_after_paid_months = null;
      save.mutate({ plan: out, reason: reason.trim() }, { onSuccess: onDone });
    })}>
      <div className="form-grid">
        <FormTextField control={control} name="id" label={t('admin.plans.id')} mono isDisabled={Boolean(plan.id)} />
        <FormTextField control={control} name="name" label={t('admin.plans.name')} />
        <FormTextField control={control} name="description" label={t('admin.plans.description')} className="field full" />
        {NUMS.map(([k, l]) => <FormNumberField key={k} control={control} name={k} label={t(`admin.plans.${l}`)} />)}
      </div>
      <FormCardRadio control={control} name="ai_tier" label={t('admin.plans.aiTier')} help={t('admin.plans.aiTierHelp')} options={[
        { value: 'economy', label: t('admin.plans.aiSpark'), sub: t('admin.plans.aiSparkSub') },
        { value: 'standard', label: t('admin.plans.aiPulse'), sub: t('admin.plans.aiPulseSub') },
        { value: 'enhanced', label: t('admin.plans.aiSurge'), sub: t('admin.plans.aiSurgeSub') },
      ]} />
      <FormSwitch control={control} name="receipt_backup" label={t('admin.plans.backup')} />
      <div className="row-actions">
        {BOOLS.map(([k, l]) => <FormCheckbox key={k} control={control} name={k} label={t(`admin.plans.${l}`)} />)}
      </div>
      <ReasonField control={control} />
      <div className="row-actions">
        <Btn type="submit" variant="run" isDisabled={save.isPending}>{t('admin.plans.save')}</Btn>
        <Btn onPress={onDone}>{t('common.cancel')}</Btn>
      </div>
    </Form>
  );
}
