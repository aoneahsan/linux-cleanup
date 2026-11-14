import { Btn, ExternalLink, PageHead, Panel, StateCard, useRunLive } from '@/components/ui/primitives';
import type { IconName } from '@/components/ui/Icon';
import type { ReactNode } from 'react';
import { useT } from '@/i18n';
import { formatDateTime } from '@/i18n/format';
import { env } from '@/config/env';
import { useCliInfo } from '@/hooks/useLocal';
import { useUpdateState } from '@/stores/update';
import { checkForUpdate, installUpdate, lastCheck, relaunch } from '@/services/updater';
import { ReleaseNotices } from '@/pages/help/ReleaseNotices';

/** Updates: one card per updater state; a failed check never blocks a run. */
export default function UpdatesPage() {
  const t = useT();
  const { status, version, notes, progress } = useUpdateState();
  const cli = useCliInfo();
  const live = useRunLive();
  const last = lastCheck();

  const card = (() => {
    const s = (icon: IconName, title: string, body: string, actions?: ReactNode, tone?: 'offline' | 'error') => (
      <StateCard icon={icon} title={title} tone={tone} actions={actions}>{body}</StateCard>
    );
    switch (status) {
      case 'checking': return s('refresh', t('help.updates.checking'), t('help.updates.checkingBody'));
      case 'available': return s('download', t('help.updates.available', { version: version ?? '' }), t('help.updates.availableBody'),
        <Btn variant="run" tag={t('help.updates.installTag')} onPress={() => void installUpdate()}>{t('help.updates.install')}</Btn>);
      case 'downloading': return (
        <StateCard icon="download" title={t('help.updates.downloading', { version: version ?? '' })}>
          {t('help.updates.downloadingBody')}
        </StateCard>
      );
      case 'ready': return s('check', t('help.updates.ready'), live ? t('help.updates.relaunchBusy') : t('help.updates.readyBody'),
        <Btn variant="run" tag={t('help.updates.relaunchTag')} isDisabled={live} onPress={() => void relaunch()}>{t('help.updates.relaunch')}</Btn>);
      case 'current': return s('check', t('help.updates.current', { version: env.appVersion }), t('help.updates.currentBody'));
      case 'offline': return s('wifioff', t('help.updates.offline'), t('help.updates.offlineBody'),
        <Btn onPress={() => void checkForUpdate()}>{t('common.retry')}</Btn>, 'offline');
      case 'endpoint': return s('alert', t('help.updates.endpoint'), t('help.updates.endpointBody'),
        <Btn onPress={() => void checkForUpdate()}>{t('common.retry')}</Btn>, 'error');
      case 'signature': return s('shield', t('help.updates.signature'), t('help.updates.signatureBody'),
        <Btn onPress={() => void checkForUpdate()}>{t('common.retry')}</Btn>, 'error');
      case 'error': return s('alert', t('help.updates.error'), t('help.updates.errorBody'),
        <Btn onPress={() => void checkForUpdate()}>{t('common.retry')}</Btn>, 'error');
      default: return s('refresh', t('help.updates.idle'), t('help.updates.idleBody'));
    }
  })();

  return (
    <div className="workbench">
      <PageHead
        id="h-up"
        dateline={t('help.updates.dateline')}
        title={t('help.updates.title')}
        lede={t('help.updates.lede')}
        actions={<Btn icon="refresh" isDisabled={status === 'checking' || status === 'downloading'} onPress={() => void checkForUpdate()}>{t('help.updates.check')}</Btn>}
      />
      <Panel idx="§ 01" title={t('help.updates.statusTitle')} titleId="h-up-state" className="span-7" tour={t('help.updates.statusTour')}>
        {card}
        {status === 'downloading' ? <div className="progress mt-3" aria-hidden="true"><i className="progress-fill" style={{ width: `${progress}%` }} /></div> : null}
      </Panel>
      <Panel idx="§ 02" title={t('help.updates.versionsTitle')} titleId="h-up-ver" className="span-5" inset>
        <dl className="kv">
          <dt>{t('help.updates.app')}</dt><dd>{env.appVersion}</dd>
          <dt>{t('help.updates.script')}</dt>
          <dd>{cli.data ? t('help.updates.scriptLine', { version: cli.data.version, state: t(cli.data.ok ? 'help.updates.verified' : 'help.updates.failed') }) : '—'}</dd>
          <dt>{t('help.updates.channel')}</dt><dd>{t('help.updates.stable')}</dd>
          <dt>{t('help.updates.lastCheck')}</dt><dd>{last ? formatDateTime(last) : t('help.updates.never')}</dd>
        </dl>
      </Panel>
      {status === 'available' && version ? (
        <section className="release span-12" aria-labelledby="h-up-notes">
          <div className="ver"><small>{t('help.updates.notesSmall')}</small>{version}</div>
          <div><h2 id="h-up-notes">{t('help.updates.notesTitle')}</h2>{notes ? <p>{notes}</p> : null}</div>
          <ExternalLink href={`${env.docsUrl}/changelog`} className="link-arrow">{t('help.updates.changelog')}</ExternalLink>
        </section>
      ) : null}
      <ReleaseNotices />
    </div>
  );
}
