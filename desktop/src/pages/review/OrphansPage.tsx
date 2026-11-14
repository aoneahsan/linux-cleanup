import { useState } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { useNavigate } from '@tanstack/react-router';
import { Btn, PageHead, Panel, PreviewBtn, goTo } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { formatKb } from '@/i18n/format';
import { useReceipts } from '@/stores/receipts';
import { useMarks } from '@/stores/marks';
import { decisionKey, usePlan } from '@/stores/plan';
import { NeedsPreview } from '@/pages/review/shared';
import { toast } from '@/lib/feedback';

const PAGE = 25;

/** Orphans: section 12's support folders, each marked keep or review before the ledger decides. */
export default function OrphansPage() {
  const t = useT();
  const navigate = useNavigate();
  const f = useReceipts((s) => s.findings[12]);
  const marks = useMarks((s) => s.orphans);
  const mark = useMarks((s) => s.markOrphan);
  const setPlan = usePlan((s) => s.setPlan);
  const decideMany = usePlan((s) => s.decideMany);
  const [shown, setShown] = useState(PAGE);
  const items = f?.section.items ?? [];
  const page = items.slice(0, shown);

  return (
    <div className="workbench">
      <PageHead
        id="h-orph"
        dateline={t('review.orphans.dateline', { count: f?.section.itemCount ?? 0 })}
        title={t('review.orphans.title')}
        lede={t('review.orphans.lede')}
        actions={
          <Btn isDisabled={!page.length} onPress={() => { page.forEach((o) => mark(o.path, 'keep')); toast(translate('review.orphans.keptAll')); }}>
            {t('review.orphans.keepAll')}
          </Btn>
        }
      />
      <Panel
        idx="§ 01"
        title={t('review.orphans.listTitle')}
        titleId="h-orph-list"
        className="span-8"
        aside={f ? t('review.orphans.shown', { shown: page.length, count: f.section.itemCount }) : undefined}
        tour={t('review.orphans.listTour')}
      >
        {f ? (
          <>
            <ul className="orphans">
              {page.map((o) => (
                <li key={o.path}>
                  <span className="path">{`${o.path} · ${formatKb(o.kb)}`}</span>
                  <ToggleButtonGroup
                    className="toggle-pair"
                    aria-label={t('overview.orphans.decisionFor', { path: o.path })}
                    selectedKeys={marks[o.path] ? [marks[o.path] as string] : []}
                    onSelectionChange={(keys) => mark(o.path, ([...keys][0] as 'keep' | 'review' | undefined) ?? null)}
                  >
                    <ToggleButton id="keep">{t('overview.orphans.keep')}</ToggleButton>
                    <ToggleButton id="review">{t('overview.orphans.review')}</ToggleButton>
                  </ToggleButtonGroup>
                </li>
              ))}
            </ul>
            {items.length > shown ? <div className="row-actions mt-3"><Btn onPress={() => setShown((n) => n + PAGE)}>{t('review.orphans.more')}</Btn></div> : null}
          </>
        ) : (
          <NeedsPreview ids={[12]} name={t('review.orphans.ledgerName')} />
        )}
      </Panel>
      <aside className="panel inset span-4" aria-labelledby="h-orph-why">
        <div className="panel-head"><span className="idx">§ 02</span><h2 id="h-orph-why">{t('review.orphans.whyTitle')}</h2><span className="rule" /></div>
        <ol className="timeline">
          {(['named', 'unclaimed', 'aged'] as const).map((k) => (
            <li key={k}><span className="when">{t(`review.orphans.${k}`)}</span><br />{t(`review.orphans.${k}Body`)}</li>
          ))}
        </ol>
        <div className="row-actions mt-4">
          <PreviewBtn
            tag={t('common.dryRun')}
            isDisabled={!f}
            onPress={() => {
              // Kept rows stay kept in the ledger; review rows wait for the user's choice there.
              decideMany(items.filter((o) => marks[o.path] === 'keep').map((o) => decisionKey(12, o.path)), 'keep');
              setPlan({ sections: [12], name: t('review.orphans.ledgerName'), profile: null });
              goTo(navigate, '/preview');
            }}
          >
            {t('review.orphans.toLedger')}
          </PreviewBtn>
        </div>
      </aside>
    </div>
  );
}
