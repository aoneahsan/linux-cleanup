import { useEffect, useRef, useState } from 'react';
import { useT } from '@/i18n';
import { env } from '@/config/env';
import { Btn, ExternalLink } from '@/components/ui/primitives';
import { usePrefs } from '@/stores/prefs';
import { pushLegalSeen } from '@/services/settingsSync';
import { analyticsOn } from '@/services/analytics';

const SHOW_MS = 10_000;

/** The legal notice: one quiet bar, once per device, marked seen when shown, gone after 10 s. */
export function LegalBar({ taskPage }: { taskPage: boolean }) {
  const t = useT();
  const markSeen = usePrefs((s) => s.markLegalSeen);
  const [phase, setPhase] = useState<'pending' | 'visible' | 'gone'>(() => (usePrefs.getState().legalSeen ? 'gone' : 'pending'));
  const timer = useRef<number | null>(null);
  // A task page never shows it, and does not use up the one showing.
  if (phase === 'pending' && !taskPage) setPhase('visible');
  const visible = phase === 'visible';

  const hold = () => {
    if (timer.current) window.clearTimeout(timer.current);
  };
  const arm = () => {
    hold();
    timer.current = window.setTimeout(() => setPhase('gone'), SHOW_MS);
  };

  useEffect(() => {
    if (!visible) return;
    markSeen();
    pushLegalSeen();
    timer.current = window.setTimeout(() => setPhase('gone'), SHOW_MS);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPhase('gone');
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [visible, markSeen]);

  if (!visible) return null;
  return (
    <div className="legal-bar" role="status" onPointerEnter={hold} onPointerLeave={arm} onFocus={hold} onBlur={arm}>
      <p>
        {t('shell.legal.lead')}
        <ExternalLink href={`${env.websiteUrl}/privacy`}>{t('shell.legal.privacy')}</ExternalLink>
        {t('shell.legal.and')}
        <ExternalLink href={`${env.websiteUrl}/terms`}>{t('shell.legal.terms')}</ExternalLink>
        {t('shell.legal.end')}
        {analyticsOn() ? <> {t('shell.legal.analytics')}</> : null}
      </p>
      <Btn onPress={() => setPhase('gone')}>{t('shell.legal.okay')}</Btn>
    </div>
  );
}
