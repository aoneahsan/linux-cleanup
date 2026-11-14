import { startSafePreview } from '@/services/previewLauncher';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AppLink, Btn, PageHead, Plate, PreviewBtn, StateCard, goTo } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { formatGiB, formatShortDateTime } from '@/i18n/format';
import { tierFor } from '@/data/sections';
import { useDisk } from '@/hooks/useLocal';
import { isActive, useRun } from '@/stores/run';
import { toast } from '@/lib/feedback';
import { useSettings } from '@/stores/settings';
import type { SectionRun } from '@/lib/events';

/** Live run: one lamp per section, the stream beside it, cancel after the current item. */
export default function RunPage() {
  const t = useT();
  const navigate = useNavigate();
  const request = useRun((s) => s.request);
  const state = useRun((s) => s.state);
  const stderr = useRun((s) => s.stderr);
  const active = useRun((s) => isActive(s));
  const cancelled = useRun((s) => s.cancelled);
  const startedAt = useRun((s) => s.startedAt);
  const receipt = useRun((s) => s.receipt);
  const cancel = useRun((s) => s.cancel);
  const disk = useDisk();
  const cancelKeys = useSettings((s) => s.bindings.cancel);
  const consoleRef = useRef<HTMLDivElement>(null);
  const [cancelAsked, setCancelAsked] = useState(false);
  const announced = useRef<string | null>(null);

  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [stderr.length, state.order.length]);

  useEffect(() => {
    if (!receipt || announced.current === receipt.id || request?.dryRun) return;
    announced.current = receipt.id;
    toast(cancelled
      ? translate('flow.live.toastCancelled')
      : translate('flow.live.toastDone', { completed: receipt.tally.completed, attempted: receipt.tally.attempted }));
  }, [receipt, cancelled, request?.dryRun]);

  if (!request || request.dryRun) {
    return (
      <div className="workbench">
        <PageHead id="h-run" dateline={t('flow.live.none')} title={t('flow.live.title')} lede={t('flow.live.lede')} />
        <div className="span-12">
          <StateCard
            icon="play"
            title={t('flow.live.none')}
            actions={
              <>
                <PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('flow.live.pick')}</PreviewBtn>
                <AppLink to="/history" className="btn btn-quiet">{t('flow.live.past')}</AppLink>
              </>
            }
          >
            {t('flow.live.noneBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const sections = state.order.map((id) => state.sections[id]).filter((s): s is SectionRun => Boolean(s));
  const done = sections.filter((s) => s.state !== 'pending' && s.state !== 'running').length;
  const free = state.diskAfter?.freeKb ?? disk.data?.free_kb ?? state.diskBefore?.freeKb ?? null;

  return (
    <div className="workbench">
      <PageHead
        id="h-run"
        dateline={active
          ? t('flow.live.dateline', { name: request.name, when: startedAt ? formatShortDateTime(startedAt) : '' })
          : t('flow.live.datelineDone', { name: request.name })}
        title={active ? t('flow.live.title') : t('flow.live.titleDone')}
        lede={t('flow.live.lede')}
        actions={active ? (
          <Btn variant="stop" icon="stop" kbd={cancelKeys} isDisabled={cancelAsked} onPress={() => { setCancelAsked(true); void cancel(); }}>
            {t('flow.live.cancel')}
          </Btn>
        ) : receipt ? (
          <Btn variant="run" tag={t('common.done')} autoFocus onPress={() => goTo(navigate, '/receipt')}>{t('flow.live.receipt')}</Btn>
        ) : null}
      />
      <section className="panel span-5" aria-labelledby="h-lamps" data-tour={t('flow.live.lampsTour')}>
        <div className="panel-head">
          <span className="idx">§ 01</span><h2 id="h-lamps">{t('flow.live.lampsTitle')}</h2><span className="rule" />
          <span className="aside">{t('flow.live.count', { done, total: sections.length || request.sections.length })}</span>
        </div>
        <div className="progress" aria-hidden="true">
          <i className="progress-fill" style={{ width: `${sections.length ? (done / sections.length) * 100 : 0}%` }} />
        </div>
        <div className="lamps" aria-live="polite">
          {sections.map((s) => (
            <div className="lamp-row" key={s.id} data-state={s.state === 'completed' ? 'done' : s.state === 'failed' ? 'cancelled' : s.state}>
              <Plate id={s.id} tier={tierFor(s.id, s.stamp)} />
              <span>{t(`sections.s${s.id}.title` as never)}{s.reason ? <span className="sub">{s.reason}</span> : null}</span>
              <span className="state">{t(`flow.live.states.${s.state}`)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="span-7 stack-v" aria-label={t('flow.live.outputTitle')}>
        <div className="panel" data-tour={t('flow.live.outputTour')}>
          <div className="panel-head">
            <span className="idx">§ 02</span><h2>{t('flow.live.outputTitle')}</h2><span className="rule" /><span className="aside">{t('flow.live.outputAside')}</span>
          </div>
          <div className="console" ref={consoleRef} role="log" aria-label={t('flow.live.outputLabel')}>
            {stderr.map((line, i) => (
              <div key={i} className="dim">{line}</div>
            ))}
            {cancelAsked && active ? <div>{t('flow.live.cancelling')}</div> : null}
          </div>
        </div>
        <div className="panel inset">
          <div className="panel-head"><span className="idx">§ 03</span><h2>{t('flow.live.freeTitle')}</h2><span className="rule" /></div>
          <span className="big-figure">{free !== null ? formatGiB(free) : '—'}<small>{t('flow.live.free')}</small></span>
          <p className="lede mt-2">{t('flow.live.freeLede')}</p>
        </div>
      </section>
    </div>
  );
}
