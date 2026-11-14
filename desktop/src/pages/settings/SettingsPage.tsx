import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormTextField } from '@/components/form/FormTextField';
import {
  Button, Form, Input, Label, Radio, RadioGroup, Slider,
  SliderOutput, SliderThumb, SliderTrack, Switch, Tab, TabList, TabPanel, Tabs, Tag, TagGroup, TagList, Text, TextField,
} from 'react-aria-components';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AppLink, Btn, ExternalLink, PageHead, TagChip } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { env } from '@/config/env';
import { CLI_DEFAULTS, useSettings, type Settings } from '@/stores/settings';
import { Icon } from '@/components/ui/Icon';
import { commands } from '@/lib/tauri';
import { ShortcutsPanel } from '@/pages/settings/ShortcutsPanel';
import { toast } from '@/lib/feedback';
import { analyticsOn } from '@/services/analytics';

type TabId = 'clean' | 'folders' | 'notify' | 'privacy' | 'keys';
const TABS: TabId[] = ['clean', 'folders', 'notify', 'privacy', 'keys'];

function Ruler({ label, value, min, max, step, ticks, help, format, onCommit }: {
  label: string; value: number; min: number; max: number; step: number; ticks: string[]; help: string;
  format: (n: number) => string; onCommit: (n: number) => void;
}) {
  const [v, setV] = useState(value);
  return (
    <Slider className="ruler field" value={v} minValue={min} maxValue={max} step={step} onChange={setV} onChangeEnd={onCommit}>
      <Label>{label}</Label>
      <SliderOutput>{() => format(v)}</SliderOutput>
      <SliderTrack className="ruler-track">
        <SliderThumb className="ruler-thumb" />
      </SliderTrack>
      <div className="ticks">{ticks.map((x) => <span key={x}>{x}</span>)}</div>
      <span className="help">{help}</span>
    </Slider>
  );
}

function PathList({ field, label, addLabel, placeholder, help }: { field: 'scanRoots' | 'excludes'; label: string; addLabel: string; placeholder: string; help: string }) {
  const t = useT();
  const list = useSettings((s) => s.settings[field]);
  const update = useSettings((s) => s.update);
  const schema = z.object({ path: z.string().trim().refine((v) => (v.startsWith('~/') || v.startsWith('/')) && !v.includes(':'), { error: () => translate('settings.pathInvalid') }) });
  const { control, handleSubmit, reset } = useForm<{ path: string }>({ resolver: zodResolver(schema), defaultValues: { path: '' } });
  return (
    <div className="field">
      <span className="label">{label}</span>
      {list.length ? (
        <TagGroup aria-label={label} onRemove={(keys) => update({ [field]: list.filter((p) => !keys.has(p)) } as Partial<Settings>)}>
          <TagList className="paths">
            {list.map((p) => (
              <Tag key={p} id={p} textValue={p} className="path-chip">
                {p}
                <Button slot="remove" aria-label={t('settings.remove', { path: p })}><svg aria-hidden="true"><use href="#i-close" /></svg></Button>
              </Tag>
            ))}
          </TagList>
        </TagGroup>
      ) : (
        <p className="help">{t('settings.noPaths')}</p>
      )}
      <Form
        className="row-actions"
        validationBehavior="aria"
        onSubmit={handleSubmit((v) => {
          const p = v.path.trim();
          if (!list.includes(p)) update({ [field]: [...list, p] } as Partial<Settings>);
          reset({ path: '' });
          toast(translate('settings.pathAdded', { path: p }));
        })}
      >
        <FormTextField control={control} name="path" ariaLabel={addLabel} placeholder={placeholder} mono />
        <Btn type="submit">{t('settings.add')}</Btn>
      </Form>
      <span className="help">{help}</span>
    </div>
  );
}

function SettingSwitch({ k, title, body }: { k: 'notify' | 'closeToMenuBar' | 'updatesAuto' | 'syncHistory' | 'emailOnSchedule'; title: string; body: string }) {
  const t = useT();
  const value = useSettings((s) => s.settings[k]);
  const update = useSettings((s) => s.update);
  return (
    <div className="setting-row">
      <div><b>{title}</b><p>{body}</p></div>
      <Switch className="switch" isSelected={value} aria-label={title} onChange={(on) => {
        update({ [k]: on } as Partial<Settings>);
        if (k === 'closeToMenuBar') void commands.setTrayMode(on).catch(() => undefined);
        toast(translate(on ? 'settings.on' : 'settings.off'));
      }}>
        <span className="track" aria-hidden="true" />
        <span className="sr-only">{t(value ? 'settings.on' : 'settings.off')}</span>
      </Switch>
    </div>
  );
}

/** Settings: thresholds, folders, notifications, privacy and rebindable shortcuts; saved as they change. */
export default function SettingsPage() {
  const t = useT();
  const { tab = 'clean' } = useSearch({ from: '/settings' });
  const navigate = useNavigate({ from: '/settings' });
  const s = useSettings((x) => x.settings);
  const update = useSettings((x) => x.update);
  const gb = (n: number) => t('settings.gbValue', { n });

  return (
    <div className="workbench">
      <PageHead
        id="h-set"
        dateline={t('settings.dateline')}
        title={t('settings.title')}
        lede={t('settings.lede')}
      />
      <p className="banner span-12"><Icon name="terminal" />{t('settings.flagsNote')}</p>
      <section className="panel span-12" aria-label={t('settings.groups')}>
        <Tabs selectedKey={tab} onSelectionChange={(k) => void navigate({ search: { tab: k === 'clean' ? undefined : (k as TabId) }, replace: true })}>
          <TabList className="tabs" aria-label={t('settings.groups')}>
            {TABS.map((k) => <Tab key={k} id={k}>{t(`settings.tabs.${k}`)}</Tab>)}
          </TabList>
          <TabPanel id="clean" className="split" data-tour={t('settings.cleanTour')}>
            <Ruler label={t('settings.age')} value={s.ageDays ?? CLI_DEFAULTS.ageDays} min={30} max={365} step={5} help={t('settings.ageHelp')}
              ticks={[t('settings.ageTicks.a'), t('settings.ageTicks.b'), t('settings.ageTicks.c'), t('settings.ageTicks.d')]}
              format={(n) => t('settings.ageValue', { n })}
              onCommit={(n) => { update({ ageDays: n }); toast(translate('settings.saved', { value: translate('settings.ageValue', { n }) })); }} />
            <Ruler label={t('settings.large')} value={s.largeFileGb ?? CLI_DEFAULTS.largeFileGb} min={1} max={20} step={1} help={t('settings.largeHelp')}
              ticks={[t('settings.largeTicks.a'), t('settings.largeTicks.b'), t('settings.largeTicks.c'), t('settings.largeTicks.d')]}
              format={gb}
              onCommit={(n) => { update({ largeFileGb: n }); toast(translate('settings.saved', { value: gb(n) })); }} />
            {s.ageDays !== null || s.largeFileGb !== null ? (
              <div className="row-actions">
                <Btn onPress={() => { update({ ageDays: null, largeFileGb: null }); toast(translate('settings.defaultsBack')); }}>{t('settings.useDefaults')}</Btn>
              </div>
            ) : <p className="help">{t('settings.usingDefaults')}</p>}
            <RadioGroup className="field" value={s.units} onChange={(v) => update({ units: v as Settings['units'] })}>
              <Label className="label">{t('settings.units')}</Label>
              <div className="cards">
                <Radio value="GiB" className="card-opt">{t('common.unitGiB')}<small>{t('settings.unitsGiB')}</small></Radio>
                <Radio value="GB" className="card-opt">{t('common.unitGB')}<small>{t('settings.unitsGB')}</small></Radio>
              </div>
            </RadioGroup>
          </TabPanel>
          <TabPanel id="folders" className="split">
            <PathList field="scanRoots" label={t('settings.roots')} addLabel={t('settings.addRoot')} placeholder={t('settings.rootPlaceholder')} help={t('settings.rootsHelp')} />
            <PathList field="excludes" label={t('settings.excl')} addLabel={t('settings.addExcl')} placeholder={t('settings.exclPlaceholder')} help={t('settings.exclHelp')} />
            <TextField className="field full" value="~/.macleanup" isReadOnly>
              <Label>{t('settings.dir')}</Label>
              <Input className="input mono" />
              <Text slot="description" className="help">{t('settings.dirHelp')}</Text>
            </TextField>
          </TabPanel>
          <TabPanel id="notify">
            <SettingSwitch k="notify" title={t('settings.notify')} body={t('settings.notifyBody')} />
            <SettingSwitch k="emailOnSchedule" title={t('settings.emailSchedule')} body={t('settings.emailScheduleBody')} />
            <SettingSwitch k="closeToMenuBar" title={t('settings.menuBar')} body={t('settings.menuBarBody')} />
            <SettingSwitch k="updatesAuto" title={t('settings.updates')} body={t('settings.updatesBody')} />
          </TabPanel>
          <TabPanel id="privacy">
            <SettingSwitch k="syncHistory" title={t('settings.sync')} body={t('settings.syncBody')} />
            <div className="setting-row">
              <div><b>{t(analyticsOn() ? 'settings.analyticsOnTitle' : 'settings.analytics')}</b><p>{t(analyticsOn() ? 'settings.analyticsOnBody' : 'settings.analyticsBody')}</p></div>
              <span className="badge ok">{t(analyticsOn() ? 'settings.analyticsOnBadge' : 'settings.noneCollected')}</span>
            </div>
            <div className="row-actions mt-4">
              <ExternalLink href={`${env.websiteUrl}/privacy`} className="link-arrow">{t('settings.privacy')}</ExternalLink>
              <ExternalLink href={`${env.websiteUrl}/terms`} className="link-arrow">{t('settings.terms')}</ExternalLink>
            </div>
          </TabPanel>
          <TabPanel id="keys" data-tour={t('settings.keysTour')}>
            <ShortcutsPanel />
          </TabPanel>
        </Tabs>
      </section>
      <section className="span-12 tips" aria-label={t('settings.related')}>
        <AppLink to="/backups" className="tip">
          <Icon name="cloudup" />
          <span><b>{t('backups.tipTitle')} <TagChip tone="pro">{t('backups.proTag')}</TagChip></b>{t('backups.tipBody')}</span>
        </AppLink>
      </section>
    </div>
  );
}
