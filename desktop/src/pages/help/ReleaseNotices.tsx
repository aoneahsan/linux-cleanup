import { Button } from 'react-aria-components';
import { Btn, Panel } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { env } from '@/config/env';
import { dismissNotice, runUpdate } from '@/services/releaseCheck';
import { useReleaseGate } from '@/stores/releaseGate';

/** Updates § 03: the release-record notice, drawn in place with the shell's words and buttons. */
export function ReleaseNotices() {
  const t = useT();
  const decision = useReleaseGate((s) => s.decision);
  const record = useReleaseGate((s) => s.record);
  const readOk = useReleaseGate((s) => s.readOk);
  const checked = useReleaseGate((s) => s.lastChecked);
  const dismissed = useReleaseGate((s) => s.dismissed);
  const set = useReleaseGate((s) => s.set);
  const phase = useReleaseGate((s) => s.phase);
  const owed = decision && decision.action !== 'none' ? decision.version : null;
  const busy = phase === 'downloading' || phase === 'waitingRun' || phase === 'relaunching';

  const newest = checked === null ? t('releases.notices.unread')
    : record ? t('releases.notices.newestLine', { version: record.version, severity: t(`releases.severity.${record.severity}`), channel: t(`releases.channel.${env.releaseChannel}`) })
      : readOk ? t('releases.notices.none') : t('releases.admin.unreadableWhat');

  return (
    <Panel idx="§ 03" title={t('releases.notices.title')} titleId="h-up-rn" className="span-12" tour={t('releases.notices.tour')}>
      <div className="split">
        <div className="stack-v">
          <p className="lede">{t('releases.notices.lede')}</p>
          {owed && dismissed === owed ? (
            <div>
              <p className="lede">{t('releases.notices.dismissedLine', { version: owed })}</p>
              <Button className="link-arrow" onPress={() => set({ dismissed: null })}>{t('releases.notices.showAgain')}</Button>
            </div>
          ) : owed ? (
            <div className="release-notice inline" role="group" aria-label={t('releases.notice.label')}>
              <Icon name="download" />
              <div className="notice-body"><p><b>{t('releases.notice.out', { version: owed })}</b>{t('releases.notice.next')}</p></div>
              <div className="row-actions">
                <Btn variant="run" tag={t('releases.gate.updateTag')} isDisabled={busy} onPress={() => void runUpdate()}>{t('releases.gate.update')}</Btn>
                {decision?.action === 'notice' ? <Btn isDisabled={busy} onPress={dismissNotice}>{t('releases.notice.later')}</Btn> : null}
              </div>
            </div>
          ) : null}
        </div>
        <dl className="kv">
          <dt>{t('releases.notices.newest')}</dt><dd>{newest}</dd>
          <dt>{t('releases.notices.thisMac')}</dt><dd>{env.appVersion}</dd>
          <dt>{t('releases.notices.shown')}</dt><dd>{owed ? t('releases.notices.shownLive') : t('releases.notices.shownNone')}</dd>
        </dl>
      </div>
    </Panel>
  );
}
