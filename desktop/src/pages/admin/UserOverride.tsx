import { Form, Switch } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Btn } from '@/components/ui/primitives';
import { FormCardRadio, FormNumberField } from '@/components/form/FormFields';
import { useT } from '@/i18n';
import { useAdminWrite } from '@/pages/admin/shared';

/** The keys `users.override_limits` accepts. The server replaces the whole object on every write. */
export interface LimitsOverride {
  real_runs_unlimited?: boolean;
  device_real_runs_per_month?: number;
  account_extra_real_runs_per_month?: number;
  ai_tier?: 'economy' | 'standard' | 'enhanced';
  ai_questions_per_month?: number;
}

const schema = z.object({
  ai_tier: z.enum(['plan', 'economy', 'standard', 'enhanced']),
  ai_questions_per_month: z.number().int().min(0).max(100000).nullable(),
});
type Values = z.infer<typeof schema>;

/**
 * Merge a change into the current override. A key set to undefined is removed (back
 * to the plan default); an empty result clears the override (null).
 */
function merged(current: LimitsOverride | null, patch: Partial<Record<keyof LimitsOverride, unknown>>): LimitsOverride | null {
  const next: Record<string, unknown> = { ...(current ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete next[k];
    else next[k] = v;
  }
  return Object.keys(next).length ? (next as LimitsOverride) : null;
}

/** The run-limit switch and the assistant override for one user; every write needs the reason above. */
export function UserOverride({ userId, current, reason }: { userId: string; current: LimitsOverride | null; reason: string }) {
  const t = useT();
  const write = useAdminWrite<{ user_id: string; overrides: LimitsOverride | null; reason: string }>('users.override_limits');
  const { control, handleSubmit } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { ai_tier: current?.ai_tier ?? 'plan', ai_questions_per_month: current?.ai_questions_per_month ?? null },
  });
  const save = (patch: Partial<Record<keyof LimitsOverride, unknown>>) =>
    write.mutate({ user_id: userId, overrides: merged(current, patch), reason: reason.trim() });
  const noReason = !reason.trim();

  return (
    <div className="stack-v">
      <Switch className="switch" isSelected={Boolean(current?.real_runs_unlimited)} isDisabled={noReason || write.isPending}
        onChange={(on) => save({ real_runs_unlimited: on ? true : undefined })}>
        <span className="track" aria-hidden="true" />{t('admin.users.unlimited')}
      </Switch>
      <Form className="stack-v" validationBehavior="aria" onSubmit={handleSubmit((v) => save({
        ai_tier: v.ai_tier === 'plan' ? undefined : v.ai_tier,
        ai_questions_per_month: v.ai_questions_per_month ?? undefined,
      }))}>
        <b>{t('admin.users.overrideTitle')}</b>
        <p className="help">{t('admin.users.overrideHelp')}</p>
        <FormCardRadio control={control} name="ai_tier" label={t('admin.plans.aiTier')} options={[
          { value: 'plan', label: t('admin.users.planDefault'), sub: t('admin.users.planDefaultSub') },
          { value: 'economy', label: t('admin.plans.aiSpark'), sub: t('admin.plans.aiSparkSub') },
          { value: 'standard', label: t('admin.plans.aiPulse'), sub: t('admin.plans.aiPulseSub') },
          { value: 'enhanced', label: t('admin.plans.aiSurge'), sub: t('admin.plans.aiSurgeSub') },
        ]} />
        <FormNumberField control={control} name="ai_questions_per_month" label={t('admin.users.aiQuestions')} max={100000} />
        <div className="row-actions">
          <Btn type="submit" variant="run" isDisabled={noReason || write.isPending}>{t('admin.users.saveOverride')}</Btn>
          {current ? <Btn isDisabled={noReason || write.isPending} onPress={() => write.mutate({ user_id: userId, overrides: null, reason: reason.trim() })}>{t('admin.users.clearOverride')}</Btn> : null}
        </div>
      </Form>
    </div>
  );
}
