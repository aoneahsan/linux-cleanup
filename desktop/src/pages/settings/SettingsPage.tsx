import { Input, Label, Radio, RadioGroup, Switch, Tab, TabList, TabPanel, Tabs, Text, TextField } from 'react-aria-components';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ExternalLink, PageHead } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { env } from '@/config/env';
import { useSettings, type Settings } from '@/stores/settings';
import { commands } from '@/lib/tauri';
import { ShortcutsPanel } from '@/pages/settings/ShortcutsPanel';
import { toast } from '@/lib/feedback';
import { analyticsOn } from '@/services/analytics';

type TabId = 'general' | 'notify' | 'privacy' | 'keys';
const TABS: TabId[] = ['general', 'notify', 'privacy', 'keys'];

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

/** Settings: units, notifications and tray, privacy and rebindable shortcuts; saved as they change. */
export default function SettingsPage() {
  const t = useT();
  const { tab = 'general' } = useSearch({ from: '/settings' });
  const navigate = useNavigate({ from: '/settings' });
  const s = useSettings((x) => x.settings);
  const update = useSettings((x) => x.update);

  return (
    <div className="workbench">
      <PageHead id="h-set" dateline={t('settings.dateline')} title={t('settings.title')} lede={t('settings.lede')} />
      <section className="panel span-12" aria-label={t('settings.groups')}>
        <Tabs selectedKey={tab} onSelectionChange={(k) => void navigate({ search: { tab: k === 'general' ? undefined : (k as TabId) }, replace: true })}>
          <TabList className="tabs" aria-label={t('settings.groups')}>
            {TABS.map((k) => <Tab key={k} id={k}>{t(`settings.tabs.${k}`)}</Tab>)}
          </TabList>
          <TabPanel id="general" className="split" data-tour={t('settings.cleanTour')}>
            <RadioGroup className="field" value={s.units} onChange={(v) => { update({ units: v as Settings['units'] }); toast(translate('settings.saved', { value: v })); }}>
              <Label className="label">{t('settings.units')}</Label>
              <div className="cards">
                <Radio value="GiB" className="card-opt">{t('common.unitGiB')}<small>{t('settings.unitsGiB')}</small></Radio>
                <Radio value="GB" className="card-opt">{t('common.unitGB')}<small>{t('settings.unitsGB')}</small></Radio>
              </div>
            </RadioGroup>
            <TextField className="field full" value="~/.linux-cleanup" isReadOnly>
              <Label>{t('settings.dir')}</Label>
              <Input className="input mono" />
              <Text slot="description" className="help">{t('settings.dirHelp')}</Text>
            </TextField>
            <p className="help field full">{t('settings.thresholdsNote')}</p>
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
    </div>
  );
}
