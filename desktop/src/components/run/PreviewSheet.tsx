import { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';
import { useNavigate } from '@tanstack/react-router';
import { Btn, Plate, TagChip, goTo } from '@/components/ui/primitives';
import { NotInApp } from '@/components/states/NotInApp';
import { useT } from '@/i18n';
import { formatKb } from '@/i18n/format';
import { tierFor } from '@/data/sections';
import { useAllowanceSummary } from '@/stores/allowance';
import { isActive, useRun } from '@/stores/run';
import { usePlan } from '@/stores/plan';
import type { SectionRun } from '@/lib/events';

/** The preview sheet: a streamed dry-run ledger, then an explicit choice to run. Previews never use the allowance. */
export function PreviewSheet() {
  const t = useT();
  const navigate = useNavigate();
  const open = useRun((s) => s.sheetOpen);
  const setOpen = useRun((s) => s.setSheetOpen);
  const request = useRun((s) => s.request);
  const state = useRun((s) => s.state);
  const startError = useRun((s) => s.startError);
  const active = useRun((s) => isActive(s));
  const cancel = useRun((s) => s.cancel);
  const setPlan = usePlan((s) => s.setPlan);
  const runs = useAllowanceSummary();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open || !request) return null;
  const sections = state.order.map((id) => state.sections[id]).filter((s): s is SectionRun => Boolean(s));
  const done = sections.filter((s) => s.state !== 'pending' && s.state !== 'running').length;
  const pct = sections.length ? (done / sections.length) * 100 : 0;
  const found = sections.reduce((n, s) => n + s.plannedKb, 0);
  const finished = !active && (state.phase === 'finished' || state.phase === 'interrupted');

  const toConfirm = () => {
    setPlan({ sections: request.sections, name: request.name, profile: request.profile });
    setOpen(false);
    goTo(navigate, '/confirm');
  };

  return (
    <aside className="sheet" role="dialog" aria-labelledby="sheet-title">
      <div className="sheet-head">
        <h2 id="sheet-title">{t('run.sheet.title', { name: request.name })}</h2>
        <TagChip>{request.dryRun ? t('run.sheet.tag') : t('run.sheet.realTag')}</TagChip>
        <Button ref={closeRef} className="icon-close" aria-label={t('shell.close')} onPress={() => setOpen(false)}>
          <svg width="14" height="14" aria-hidden="true">
            <use href="#i-close" />
          </svg>
        </Button>
      </div>
      <div className="sheet-body">
        {startError?.kind === 'not_in_app' ? (
          <NotInApp />
        ) : (
          <>
            <div className="progress" aria-hidden="true">
              <i className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <ol className="stream" aria-live="polite">
              {sections.filter((s) => s.state !== 'pending').map((s) => (
                <li key={s.id}>
                  <Plate id={s.id} tier={tierFor(s.id, s.stamp)} />
                  <span>
                    {t(`sections.s${s.id}.title` as never)}
                    <span className="sub">{s.reason ?? (s.itemCount ? t(`sections.s${s.id}.what` as never) : t('run.sheet.noFindings'))}</span>
                  </span>
                  <b>{s.plannedKb ? formatKb(s.plannedKb) : '—'}</b>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      <div className="sheet-foot">
        {startError && startError.kind !== 'not_in_app' ? (
          <p className="callout warn">{t('run.sheet.startFailed', { message: startError.message || startError.kind })}</p>
        ) : null}
        {state.phase === 'refused' ? <p className="callout warn">{t('run.sheet.refused', { v: state.refusedVersion ?? '' })}</p> : null}
        {active ? (
          <>
            <p className="lede">{t('run.sheet.previewing')}</p>
            <div className="row-actions">
              <Btn variant="stop" icon="stop" onPress={() => void cancel()}>{t('run.sheet.cancel')}</Btn>
            </div>
          </>
        ) : null}
        {finished && request.dryRun ? (
          <>
            <div className="callout">
              <b>{state.phase === 'interrupted' ? t('run.sheet.interrupted') : t('run.sheet.finishedTitle')}</b>{' '}
              {found ? t('run.sheet.finishedBody', { size: formatKb(found) }) : t('run.sheet.finishedNothing')}
            </div>
            <div className="row-actions">
              <Btn variant="run" tag={t('common.run')} onPress={toConfirm}>
                {t('run.sheet.runThese', { count: request.sections.length })}
              </Btn>
              <Btn
                onPress={() => {
                  setPlan({ sections: request.sections, name: request.name, profile: request.profile });
                  setOpen(false);
                  goTo(navigate, '/preview');
                }}
              >
                {t('run.sheet.openLedger')}
              </Btn>
              <Btn onPress={() => setOpen(false)}>{t('run.sheet.keepPreview')}</Btn>
            </div>
            <p className="lede">
              {runs === null ? t('run.sheet.allowanceUnknown') : runs.unlimited ? t('run.sheet.noLimit') : t('run.sheet.usesOne', { left: runs.left })}
            </p>
          </>
        ) : null}
      </div>
    </aside>
  );
}
