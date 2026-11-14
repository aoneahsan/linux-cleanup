import { useEffect } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { Btn, ExternalLink } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { env } from '@/config/env';
import { RELEASES_URL } from '@/services/updater';
import { dismissNotice, runUpdate } from '@/services/releaseCheck';
import { useReleaseGate, type GatePhase } from '@/stores/releaseGate';

/** The Update button's words for each phase of the press. */
function useUpdateLabel(phase: GatePhase, version: string): string {
  const t = useT();
  if (phase === 'downloading') return t('releases.gate.downloading', { version });
  if (phase === 'waitingRun') return t('releases.gate.waitingRun');
  if (phase === 'relaunching') return t('releases.gate.relaunching');
  if (phase === 'failed') return t('releases.gate.tryAgain');
  return t('releases.gate.update');
}

/**
 * The full-window block (urgent now, or a normal release since an earlier start).
 * role=alertdialog, focus on Update, no close, Escape inert, Tab stays inside, and
 * the window behind is inert.
 */
function Block({ version, reason, sinceLastStart }: { version: string; reason: string; sinceLastStart: boolean }) {
  const t = useT();
  const phase = useReleaseGate((s) => s.phase);
  const progress = useReleaseGate((s) => s.progress);
  const label = useUpdateLabel(phase, version);
  const busy = phase === 'downloading' || phase === 'waitingRun' || phase === 'relaunching';
  useEffect(() => {
    const win = document.querySelector<HTMLElement>('.window');
    if (win) win.inert = true;
    return () => { if (win) win.inert = false; };
  }, []);
  return (
    <ModalOverlay className="gate" isOpen isDismissable={false} isKeyboardDismissDisabled>
      <Modal className="gate-modal">
        <Dialog role="alertdialog" className="slip gate-slip" aria-labelledby="gate-title" aria-describedby="gate-reason">
          <div className="slip-head"><b>{t('releases.gate.head')}</b><span className="kind real">{version}</span></div>
          <Heading slot="title" id="gate-title">{t('releases.gate.title')}</Heading>
          {sinceLastStart ? <p className="gate-since">{t('releases.gate.since')}</p> : null}
          <p className="gate-reason" id="gate-reason">{reason}</p>
          <hr className="perf" />
          <p className="gate-line">{t('releases.gate.line', { running: env.appVersion, version })}</p>
          {busy ? <div className="progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div> : null}
          {phase === 'failed' ? (
            <p className="gate-error" role="alert">
              <span>{t('releases.gate.failed', { version })}</span>{' '}
              <ExternalLink href={RELEASES_URL}>{t('releases.gate.releasesLink')}</ExternalLink>
            </p>
          ) : null}
          <Btn variant="run" tag={t('releases.gate.updateTag')} autoFocus isDisabled={busy} onPress={() => void runUpdate()}>{label}</Btn>
          <p className="gate-fine">{t('releases.gate.fine')}</p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The normal-release notice: bottom left, stays until Later or an update. */
function Notice({ version }: { version: string }) {
  const t = useT();
  const phase = useReleaseGate((s) => s.phase);
  const progress = useReleaseGate((s) => s.progress);
  const label = useUpdateLabel(phase, version);
  const busy = phase === 'downloading' || phase === 'waitingRun' || phase === 'relaunching';
  return (
    <div className="release-notice" role="status" aria-live="polite" aria-label={t('releases.notice.label')}>
      <Icon name="download" />
      <div className="notice-body">
        <p><b>{t('releases.notice.out', { version })}</b>{t('releases.notice.next')}</p>
        {busy ? <div className="progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div> : null}
        {phase === 'failed' ? <p><ExternalLink href={RELEASES_URL} className="link-arrow">{t('releases.gate.releasesLink')}</ExternalLink></p> : null}
      </div>
      <div className="row-actions">
        <Btn variant="run" tag={t('releases.gate.updateTag')} isDisabled={busy} onPress={() => void runUpdate()}>{label}</Btn>
        <Btn isDisabled={busy} onPress={dismissNotice}>{t('releases.notice.later')}</Btn>
      </div>
    </div>
  );
}

/** Update flow layer 2 surfaces, mounted once by the shell. */
export function ReleaseGate() {
  const decision = useReleaseGate((s) => s.decision);
  const dismissed = useReleaseGate((s) => s.dismissed);
  if (!decision || decision.action === 'none') return null;
  if (decision.action === 'block') {
    return <Block version={decision.version} reason={decision.reason} sinceLastStart={decision.severity === 'normal'} />;
  }
  if (dismissed === decision.version) return null;
  return <Notice version={decision.version} />;
}
