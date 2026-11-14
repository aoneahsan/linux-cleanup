import { useMemo } from 'react';
import { PageHead, Panel, PreviewBtn } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { tierFor } from '@/data/sections';
import { useReceipts } from '@/stores/receipts';
import { decisionKey } from '@/stores/plan';
import { Disposition, Trio } from '@/pages/flow/PreviewPage';
import { NeedsPreview, isSystemPath } from '@/pages/review/shared';
import { startPreview } from '@/services/previewLauncher';
import { ToolRoles, toolItems } from '@/components/review/Toolchains';
import type { RunItem } from '@/lib/events';

/** Services & launch items: section 25's audit, split into the account and system domains. */
export default function ServicesPage() {
  const t = useT();
  const f = useReceipts((s) => s.findings[25]);
  const toolSection = useReceipts((s) => s.findings[0]);
  const tools = useMemo(() => toolItems(toolSection?.section.items ?? []), [toolSection]);
  const items = f?.section.items ?? [];
  const tier = tierFor(25, f?.section.stamp);
  const name = t('sectionsPage.sectionName', { id: 25 });

  const table = (list: RunItem[]) =>
    list.length ? (
      <table className="ledger">
        <thead><tr><th>{t('review.services.colLabel')}</th><th>{t('review.colState')}</th><th className="num">{t('review.colDecision')}</th></tr></thead>
        <tbody>
          {list.map((i) => (
            <tr key={i.path}>
              <td><span className="path">{i.path}</span></td>
              <td>{i.unique ? <span className="badge warn">{t('flow.ledger.disposition.unique')}</span> : <Disposition item={i} tier={tier} />}</td>
              <td className="actions">{i.unique ? <Trio itemKey={decisionKey(25, i.path)} path={i.path} /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p className="lede">{t('review.services.none')}</p>
    );

  return (
    <div className="workbench">
      <PageHead
        id="h-svc"
        dateline={t('review.services.dateline', { count: f?.section.itemCount ?? 0 })}
        title={t('review.services.title')}
        lede={t('review.services.lede')}
        actions={<PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview([25], name)}>{t('review.services.preview')}</PreviewBtn>}
      />
      {f ? (
        <>
          <Panel idx="§ 01" title={t('review.services.userTitle')} titleId="h-user" className="span-6" aside={t('review.services.userAside')} tour={t('review.services.userTour')}>
            {table(items.filter((i) => !isSystemPath(i.path)))}
          </Panel>
          <Panel idx="§ 02" title={t('review.services.sysTitle')} titleId="h-sys" className="span-6" aside={t('review.services.sysAside')} tour={t('review.services.sysTour')}>
            {table(items.filter((i) => isSystemPath(i.path)))}
          </Panel>
        </>
      ) : (
        <div className="span-12"><NeedsPreview ids={[25]} name={name} /></div>
      )}
      <Panel idx="§ 03" title={t('review.tools.title')} titleId="h-tools" className="span-12" inset tour={t('review.tools.tour')}>
        {tools.length ? <ToolRoles items={tools} /> : <NeedsPreview ids={[0]} name={t('sectionsPage.sectionName', { id: 0 })} />}
      </Panel>
    </div>
  );
}
