import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ExternalLink, PageHead, PreviewBtn, goTo } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { env } from '@/config/env';
import { startSafePreview } from '@/services/previewLauncher';

const STEPS = [1, 2, 3, 4, 5, 6] as const;
const BLOCKS: Record<number, string[]> = { 1: ['tall', 'accent', 'dark'], 2: ['accent', 'tall', 'tall'], 3: ['tall', 'tall', 'accent'], 4: ['dark', 'accent', 'tall'], 5: ['tall', 'dark', 'dark'], 6: ['dark', 'tall', 'accent'] };

/** A real screenshot from public/walkthrough/0N.webp; the drawn frame stands in until one is captured. */
function Shot({ n, title }: { n: number; title: string }) {
  const t = useT();
  const [missing, setMissing] = useState(false);
  if (!missing) return <img className="frame shot" src={`/walkthrough/0${n}.webp`} alt={t('walkthrough.shot', { title })} onError={() => setMissing(true)} />;
  return (
    <div className="frame" aria-hidden="true">
      <div className="frame-bar"><i /><i /><i /></div>
      <div className="frame-body"><div className="fr-rail" /><div className="fr-canvas"><div className="fr-block" />{BLOCKS[n]?.map((b, i) => <div key={i} className={`fr-block ${b}`} />)}</div></div>
    </div>
  );
}

/** Walkthrough: six steps of a cleanup, each a real screen, then the calls to action. */
export default function WalkthroughPage() {
  const t = useT();
  const navigate = useNavigate();
  const { step } = useSearch({ from: '/walkthrough' });
  const refs = useRef<(HTMLElement | null)[]>([]);

  // ?step=N scrolls to and focuses step N; ← / → move between steps.
  useEffect(() => {
    if (!step) return;
    const el = refs.current[step - 1];
    el?.scrollIntoView({ block: 'center' });
    el?.focus();
  }, [step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest('input, textarea, [role="textbox"]')) return;
      const cur = step ?? 0;
      const go = (n: number) => void navigate({ to: '/walkthrough', search: { step: n }, replace: true });
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(Math.min(STEPS.length, cur + 1)); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(Math.max(1, cur - 1)); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, navigate]);

  return (
    <div className="workbench">
      <PageHead id="h-walk" dateline={t('walkthrough.dateline')} title={t('walkthrough.title')} lede={t('walkthrough.lede')}
        actions={<PreviewBtn tag={t('common.dryRun')} onPress={() => goTo(navigate, '/sections')}>{t('walkthrough.try')}</PreviewBtn>} />
      <div className="span-12">
        {STEPS.map((n) => {
          const h = t(`walkthrough.s${n}.h` as never);
          return (
            <article className="walk-row" key={n} id={`step-${n}`} tabIndex={-1} aria-current={step === n ? 'step' : undefined}
              ref={(el) => { refs.current[n - 1] = el; }} aria-label={t('walkthrough.stepLabel', { n, title: h })}>
              <Shot n={n} title={h} />
              <div>
                <span className="plate" data-tier="read">{`0${n}`}</span>
                <h2>{h}</h2>
                <p className="lede">{t(`walkthrough.s${n}.p` as never)}</p>
                <ul><li>{t(`walkthrough.s${n}.b1` as never)}</li><li>{t(`walkthrough.s${n}.b2` as never)}</li></ul>
              </div>
            </article>
          );
        })}
      </div>
      <section className="panel inset span-12" aria-labelledby="h-walk-end">
        <div className="panel-head"><span className="idx">{t('walkthrough.readyIdx')}</span><h2 id="h-walk-end">{t('walkthrough.ready')}</h2><span className="rule" /></div>
        <div className="row-actions">
          <PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('walkthrough.previewSafe')}</PreviewBtn>
          <ExternalLink href={env.docsUrl} className="btn btn-quiet">{t('walkthrough.manual')}</ExternalLink>
        </div>
      </section>
    </div>
  );
}
