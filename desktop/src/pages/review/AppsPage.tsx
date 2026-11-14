import { useState } from 'react';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHead, Panel, PreviewBtn, Stamp, goTo } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { formatDateTime, formatKb, plate } from '@/i18n/format';
import { tierFor } from '@/data/sections';
import { useReceipts } from '@/stores/receipts';
import { decisionKey, usePlan } from '@/stores/plan';
import { findingItems } from '@/pages/overview/ReviewPanels';
import { Disposition, Trio } from '@/pages/flow/PreviewPage';
import { NeedsPreview } from '@/pages/review/shared';
import { ToolTable, toolItems } from '@/components/review/Toolchains';
import { startPreview } from '@/services/previewLauncher';

type Tab = 'all' | 'removed' | 'unused' | 'tool';
const IDS: Record<Exclude<Tab, 'tool'>, number[]> = { all: [12, 21], removed: [12], unused: [21] };
const ROWS = 100;

/** Apps & app data: leftover support folders (12) and unused apps (21) from the latest preview. */
export default function AppsPage() {
  const t = useT();
  const navigate = useNavigate({ from: '/apps' });
  const { tab = 'all' } = useSearch({ from: '/apps' });
  const findings = useReceipts((s) => s.findings);
  const setPlan = usePlan((s) => s.setPlan);
  const [selected, setSelected] = useState<string | null>(null);
  const seen = Boolean(findings[12] || findings[21]);
  const all = findingItems(findings, IDS.all);
  const total = all.reduce((n, i) => n + i.kb, 0);
  const at = Math.max(findings[12]?.at ?? 0, findings[21]?.at ?? 0);
  const sel = all.find((i) => `${i.section}:${i.path}` === selected) ?? null;
  const name = t('review.apps.title');

  const tools = toolItems(findings[0]?.section.items ?? []);
  const rows = (k: Exclude<Tab, 'tool'>) => {
    const items = findingItems(findings, IDS[k]).slice(0, ROWS);
    return (
      <table className="ledger">
        <thead><tr><th>{t('review.colItem')}</th><th className="num">{t('review.colSize')}</th><th>{t('review.colStamp')}</th><th className="num">{t('review.colDecision')}</th></tr></thead>
        <tbody>
          {items.map((i) => {
            const key = `${i.section}:${i.path}`;
            const tier = tierFor(i.section, findings[i.section]?.section.stamp);
            return (
              <tr key={key} className={selected === key ? 'is-focus' : undefined}>
                <td><Button className="link-plain" onPress={() => setSelected(key)}><span className="path">{i.path}</span></Button></td>
                <td className="num">{formatKb(i.kb)}</td>
                <td><Stamp tier={tier} /></td>
                <td className="actions">{i.unique ? <Trio itemKey={decisionKey(i.section, i.path)} path={i.path} /> : <Disposition item={i} tier={tier} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div className="workbench">
      <PageHead
        id="h-apps"
        dateline={t('review.apps.dateline', { count: all.length, size: formatKb(total) })}
        title={t('review.apps.title')}
        lede={t('review.apps.lede')}
        actions={
          <PreviewBtn
            tag={t('common.dryRun')}
            isDisabled={!seen}
            onPress={() => {
              setPlan({ sections: IDS.all, name, profile: null });
              goTo(navigate, '/preview');
            }}
          >
            {t('review.apps.preview')}
          </PreviewBtn>
        }
      />
      <section className="panel span-8" aria-labelledby="h-app-list" data-tour={t('review.apps.listTour')}>
        <h2 id="h-app-list" className="sr-only">{t('review.apps.title')}</h2>
        {seen ? (
          <Tabs selectedKey={tab} onSelectionChange={(k) => void navigate({ search: { tab: k === 'all' ? undefined : (k as Tab) }, replace: true })}>
            <TabList className="tabs" aria-label={t('review.apps.tabs')}>
              {(['all', 'removed', 'unused'] as const).map((k) => (
                <Tab key={k} id={k}>{t(`review.apps.${k}`)}<span className="count">{findingItems(findings, IDS[k]).length}</span></Tab>
              ))}
              <Tab id="tool">{t('review.apps.tool')}<span className="count">{tools.length}</span></Tab>
            </TabList>
            {(['all', 'removed', 'unused'] as const).map((k) => <TabPanel key={k} id={k}>{rows(k)}</TabPanel>)}
            <TabPanel id="tool">{tools.length ? <ToolTable items={tools} /> : <NeedsPreview ids={[0]} name={t('sectionsPage.sectionName', { id: 0 })} />}</TabPanel>
            <p className="lede mt-3">{t('review.measured', { when: formatDateTime(at) })}</p>
          </Tabs>
        ) : (
          <NeedsPreview ids={IDS.all} name={name} />
        )}
      </section>
      <aside className="span-4 stack-v" aria-label={t('review.apps.detailTitle')}>
        <Panel idx="§ 01" title={t('review.apps.detailTitle')} titleId="app-detail-h" inset tour={t('review.apps.detailTour')}>
          {sel ? (
            <dl className="kv">
              <dt>{t('review.apps.detailPath')}</dt><dd>{sel.path}</dd>
              <dt>{t('review.colSize')}</dt><dd>{formatKb(sel.kb)}</dd>
              <dt>{t('review.apps.detailSection')}</dt><dd>{`${plate(sel.section)} ${t(`sections.s${sel.section}.title` as never)}`}</dd>
              <dt>{t('review.apps.detailAction')}</dt><dd>{t(`flow.ledger.disposition.${sel.unique ? 'unique' : sel.action}`)}</dd>
            </dl>
          ) : (
            <p className="lede">{t('review.apps.detailNone')}</p>
          )}
          {sel ? (
            <div className="row-actions mt-3">
              <PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview([sel.section], t('sectionsPage.sectionName', { id: sel.section }))}>
                {t('sectionsPage.previewOne', { id: plate(sel.section) })}
              </PreviewBtn>
            </div>
          ) : null}
        </Panel>
        <Panel idx="§ 02" title={t('review.apps.whyTitle')} titleId="h-app-why">
          <p className="lede">{t('review.apps.whyBody')}</p>
        </Panel>
      </aside>
    </div>
  );
}
