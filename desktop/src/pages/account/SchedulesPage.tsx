import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FieldError, Form, Input, Label, NumberField, Radio, RadioGroup, Select, SelectValue, Button, Popover, ListBox, ListBoxItem, Switch, TextField, TimeField, DateInput, DateSegment } from 'react-aria-components';
import { Time } from '@internationalized/date';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLink, Btn, PageHead, Panel, StateCard } from '@/components/ui/primitives';
import { NotInApp } from '@/components/states/NotInApp';
import { useT, translate } from '@/i18n';
import { env } from '@/config/env';
import { useSession } from '@/stores/session';
import { commands, isTauri, toAppError, type ScheduleSpec } from '@/lib/tauri';
import { qk } from '@/services/queryClient';
import { save } from '@/lib/storage';
import { toast } from '@/lib/feedback';
import { loadSavedSchedules, type SavedSchedule } from '@/services/schedulesLocal';

const schema = z.object({
  name: z.string().trim().min(1, { error: () => translate('schedules.nameError') }).max(40),
  kind: z.enum(['preview', 'cleanup']),
  cadence: z.enum(['weekly', 'monthly', 'daily']),
  dayOfMonth: z.number().int().min(1).max(28),
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});
type Values = z.infer<typeof schema>;

/** A new schedule id (systemd unit name suffix). */
function newScheduleId(): string {
  return `s${Date.now().toString(36)}`;
}
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Schedules (Pro): systemd user timers that dry-run or run the all-safe cleanup. */
export default function SchedulesPage() {
  const t = useT();
  const qc = useQueryClient();
  const plan = useSession((s) => s.plan);
  const entitled = !env.accountsConfigured || plan === 'pro' || plan === 'team';
  const list = useQuery({ queryKey: qk.schedules, queryFn: commands.scheduleList, enabled: isTauri() && entitled });
  const saved = loadSavedSchedules();

  const { control, handleSubmit, reset, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', kind: 'preview', cadence: 'weekly', weekday: 1, dayOfMonth: 1, hour: 9, minute: 0 },
  });
  const cadence = useWatch({ control, name: 'cadence' });
  const minute = useWatch({ control, name: 'minute' });

  const install = useMutation({
    mutationFn: async ({ spec }: { spec: ScheduleSpec; name: string }) => commands.scheduleInstall(spec),
    onSuccess: (_d, { spec, name }) => {
      save('schedules', { ...loadSavedSchedules(), [spec.id]: { spec, name, on: true } });
      void qc.invalidateQueries({ queryKey: qk.schedules });
    },
    onError: (e) => toast(translate('schedules.failed', { message: toAppError(e).message || toAppError(e).kind })),
  });
  const removeM = useMutation({
    mutationFn: (id: string) => commands.scheduleRemove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.schedules }),
    onError: (e) => toast(translate('schedules.failed', { message: toAppError(e).message || toAppError(e).kind })),
  });

  const describe = (s: ScheduleSpec) => {
    const time = hhmm(s.hour, s.minute);
    const when = s.dayOfMonth ? t('schedules.everyMonth', { day: s.dayOfMonth, time })
      : s.weekday === null ? t('schedules.everyDay', { time }) : t('schedules.everyWeek', { day: t(`schedules.days.d${s.weekday}` as never), time });
    const does = s.kind === 'cleanup' ? t('schedules.runSafe') : t('schedules.previewSafe');
    return { when, does };
  };

  if (!entitled) {
    return (
      <div className="workbench">
        <PageHead id="h-sch" dateline={t('schedules.dateline')} title={t('schedules.title')} lede={t('schedules.lede')} />
        <div className="span-12">
          <StateCard icon="calendar" title={t('schedules.lockedTitle')} actions={<AppLink to="/plans" className="btn btn-quiet">{t('schedules.seePlans')}</AppLink>}>
            {t('schedules.lockedBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const installed = new Map((list.data ?? []).map((s) => [s.id, s]));
  const rows: SavedSchedule[] = [
    ...(list.data ?? []).map((spec) => ({ spec, name: saved[spec.id]?.name ?? spec.id, on: true })),
    ...Object.values(saved).filter((x) => !installed.has(x.spec.id)).map((x) => ({ ...x, on: false })),
  ];

  return (
    <div className="workbench">
      <PageHead id="h-sch" dateline={t('schedules.dateline')} title={t('schedules.title')} lede={t('schedules.lede')} />
      <Panel idx="§ 01" title={t('schedules.listTitle')} titleId="h-sch-list" className="span-8" tour={t('schedules.listTour')}>
        {!isTauri() ? <NotInApp /> : rows.length ? (
          <table className="ledger">
            <thead><tr><th>{t('schedules.colName')}</th><th>{t('schedules.colDoes')}</th><th>{t('schedules.colWhen')}</th><th className="num">{t('schedules.colOn')}</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const d = describe(r.spec);
                return (
                  <tr key={r.spec.id}>
                    <td><b>{r.name}</b></td>
                    <td>{d.does}</td>
                    <td>{d.when}</td>
                    <td className="actions">
                      <Switch className="switch" isSelected={r.on} aria-label={t('schedules.toggle', { name: r.name })}
                        onChange={(on) => {
                          if (on) install.mutate({ spec: r.spec, name: r.name }, { onSuccess: () => toast(translate('schedules.resumed', { name: r.name })) });
                          else removeM.mutate(r.spec.id, { onSuccess: () => { save('schedules', { ...loadSavedSchedules(), [r.spec.id]: { ...r, on: false } }); toast(translate('schedules.paused', { name: r.name })); } });
                        }}>
                        <span className="track" aria-hidden="true" />
                      </Switch>{' '}
                      <Btn onPress={() => {
                        const all = loadSavedSchedules();
                        delete all[r.spec.id];
                        save('schedules', all);
                        if (r.on) removeM.mutate(r.spec.id);
                        else void qc.invalidateQueries({ queryKey: qk.schedules });
                        toast(translate('schedules.removed', { name: r.name }));
                      }}>{t('schedules.remove')}</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="lede">{t('schedules.empty')}</p>}
      </Panel>
      <Panel idx="§ 02" title={t('schedules.formTitle')} titleId="h-sch-form" className="span-4" inset tour={t('schedules.formTour')}>
        <Form
          className="stack-v"
          validationBehavior="aria"
          onSubmit={handleSubmit((v) => {
            const spec: ScheduleSpec = {
              id: newScheduleId(), kind: v.kind, weekday: v.cadence === 'weekly' ? v.weekday : null,
              dayOfMonth: v.cadence === 'monthly' ? v.dayOfMonth : null, hour: v.hour, minute: v.minute,
            };
            install.mutate({ spec, name: v.name }, {
              onSuccess: () => {
                toast(translate('schedules.installed', { name: v.name }));
                reset();
              },
            });
          })}
        >
          <Controller control={control} name="name" render={({ field, fieldState }) => (
            <TextField className="field" value={field.value} onChange={field.onChange} onBlur={field.onBlur} isInvalid={fieldState.invalid} validationBehavior="aria">
              <Label>{t('schedules.name')}</Label>
              <Input className="input" ref={field.ref} placeholder={t('schedules.namePlaceholder')} />
              <FieldError className="error">{fieldState.error?.message}</FieldError>
            </TextField>
          )} />
          <Controller control={control} name="kind" render={({ field }) => (
            <RadioGroup className="field" value={field.value} onChange={field.onChange}>
              <Label className="label">{t('schedules.does')}</Label>
              <div className="cards">
                <Radio value="preview" className="card-opt">{t('schedules.preview')}<small>{t('schedules.previewSub')}</small></Radio>
                <Radio value="cleanup" className="card-opt">{t('schedules.run')}<small>{t('schedules.runSub')}</small></Radio>
              </div>
            </RadioGroup>
          )} />
          <Controller control={control} name="cadence" render={({ field }) => (
            <RadioGroup className="field" value={field.value} onChange={field.onChange}>
              <Label className="label">{t('schedules.when')}</Label>
              <div className="cards">
                <Radio value="weekly" className="card-opt">{t('schedules.weekly')}</Radio>
                <Radio value="monthly" className="card-opt">{t('schedules.monthly')}</Radio>
                <Radio value="daily" className="card-opt">{t('schedules.daily')}</Radio>
              </div>
            </RadioGroup>
          )} />
          {cadence === 'weekly' ? (
            <Controller control={control} name="weekday" render={({ field }) => (
              <Select className="field" selectedKey={String(field.value)} onSelectionChange={(k) => field.onChange(Number(k))}>
                <Label>{t('schedules.weekday')}</Label>
                <Button className="input select-btn"><SelectValue /></Button>
                <Popover className="popover select-pop">
                  <ListBox className="palette-list">
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => <ListBoxItem key={d} id={String(d)} className="palette-item">{t(`schedules.days.d${d}` as never)}</ListBoxItem>)}
                  </ListBox>
                </Popover>
              </Select>
            )} />
          ) : null}
          {cadence === 'monthly' ? (
            <Controller control={control} name="dayOfMonth" render={({ field }) => (
              <NumberField className="field" value={field.value} minValue={1} maxValue={28} onChange={(n) => Number.isFinite(n) && field.onChange(n)}>
                <Label>{t('schedules.dayOfMonth')}</Label>
                <Input className="input mono" />
              </NumberField>
            )} />
          ) : null}
          <Controller control={control} name="hour" render={({ field }) => (
            <TimeField className="field" value={new Time(field.value, minute)} hourCycle={24}
              onChange={(v) => { if (v) { field.onChange(v.hour); setValue('minute', v.minute); } }}>
              <Label>{t('schedules.time')}</Label>
              <DateInput className="input mono time-input">{(seg) => <DateSegment segment={seg} />}</DateInput>
            </TimeField>
          )} />
          <Btn type="submit" variant="run" tag={t('schedules.installTag')} isDisabled={!isTauri() || install.isPending}>{t('schedules.install')}</Btn>
        </Form>
      </Panel>
    </div>
  );
}
