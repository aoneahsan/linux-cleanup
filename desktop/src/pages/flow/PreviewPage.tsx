import { useMemo } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { AppLink, Btn, PreviewBtn, PageHead, Plate, RouterLink, StateCard, Stamp } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT, translate } from '@/i18n';
import { formatDateTime, formatKb } from '@/i18n/format';
import { DEEP_CONFIRM, TIER, tierFor, type Tier } from '@/data/sections';
import { decisionKey, usePlan, type Decision, type RunPlan } from '@/stores/plan';
import { useReceipts, type Finding } from '@/stores/receipts';
import { startPreview } from '@/services/previewLauncher';
import { toast } from '@/lib/feedback';
import type { RunItem } from '@/lib/events';
import { commands, toAppError } from '@/lib/tauri';

const ROWS_PER_SECTION = 50;
const TOAST: Record<Decision, 'flow.ledger.toastKeep' | 'flow.ledger.toastArchive' | 'flow.ledger.toastDelete'> = {
  keep: 'flow.ledger.toastKeep',
  archive: 'flow.ledger.toastArchive',
  delete: 'flow.ledger.toastDelete',
};

/** Write the ledger (paths stay on this Mac) to ~/Downloads through export_json. */
async function saveLedger(plan: { name: string; sections: number[] }, findings: Record<number, Finding>, decisions: Record<string, Decision>): Promise<void> {
  const content = JSON.stringify({
    name: plan.name,
    sections: plan.sections.map((id) => ({
      id,
      measured_ms: findings[id]?.at ?? null,
      items: (findings[id]?.section.items ?? []).map((i) => ({ ...i, decision: i.unique ? decisions[decisionKey(id, i.path)] ?? 'keep' : null })),
    })),
  }, null, 2);
  try {
    const { path } = await commands.exportJson(`macleanup-ledger-${new Date().toISOString().slice(0, 10)}.json`, content);
    toast(translate('flow.ledger.exported', { path }));
  } catch (e) {
    toast(translate('states.genericError', { message: toAppError(e).message || toAppError(e).kind }));
  }
}

/** Unique rows of the plan's latest findings, as decision keys. */
export function uniqueKeys(sections: readonly number[], findings: Record<number, Finding>): { key: string; section: number; path: string }[] {
  return sections.flatMap((id) =>
    (findings[id]?.section.items ?? []).filter((i) => i.unique).map((i) => ({ key: decisionKey(id, i.path), section: id, path: i.path })),
  );
}

export function Trio({ itemKey, path }: { itemKey: string; path: string }) {
  const t = useT();
  const value = usePlan((s) => s.decisions[itemKey]);
  const decide = usePlan((s) => s.decide);
  return (
    <ToggleButtonGroup
      className="trio"
      aria-label={t('flow.ledger.decisionFor', { path })}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={value ? [value] : []}
      onSelectionChange={(keys) => {
        const d = [...keys][0] as Decision | undefined;
        if (!d) return;
        decide(itemKey, d);
        toast(translate(TOAST[d]));
      }}
    >
      <ToggleButton id="keep" data-v="keep"><Icon name="check" />{t('flow.ledger.keep')}</ToggleButton>
      <ToggleButton id="archive" data-v="archive"><Icon name="archive" />{t('flow.ledger.archive')}</ToggleButton>
      <ToggleButton id="delete" data-v="delete"><Icon name="trash" />{t('flow.ledger.delete')}</ToggleButton>
    </ToggleButtonGroup>
  );
}

export function Disposition({ item, tier }: { item: RunItem; tier: Tier }) {
  const t = useT();
  const gone = tier === 'permanent' && item.action === 'delete';
  const kind = gone ? 'gone' : item.action;
  return <span className={`badge${gone ? ' bad' : kind === 'skip' ? ' ok' : ''}`}>{t(`flow.ledger.disposition.${kind}`)}</span>;
}

/** Preview ledger: every path the plan would touch, with keep / archive / delete for unique rows. */
export default function PreviewPage() {
  const t = useT();
  const chosen = usePlan((s) => s.plan);
  const lastPreview = useReceipts((s) => s.receipts.find((r) => r.dryRun) ?? null);
  // No plan picked yet (a preview started from the Overview): show the latest preview.
  const plan = useMemo<RunPlan | null>(
    () => chosen ?? (lastPreview ? { name: lastPreview.name, profile: lastPreview.profile, sections: lastPreview.sections.map((x) => x.id) } : null),
    [chosen, lastPreview],
  );
  const decisions = usePlan((s) => s.decisions);
  const decideMany = usePlan((s) => s.decideMany);
  const findings = useReceipts((s) => s.findings);

  if (!plan) {
    return (
      <div className="workbench">
        <div className="span-12">
          <StateCard icon="ledger" title={t('flow.ledger.noPlan')} actions={<RouterLink to="/sections" className="btn btn-preview"><span className="tag">{t('common.dryRun')}</span>{t('flow.ledger.pick')}</RouterLink>}>
            {t('flow.ledger.noPlanBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const measured = plan.sections.map((id) => findings[id]?.at ?? 0);
  const missing = plan.sections.some((id) => !findings[id]);
  const when = Math.min(...measured);
  const unique = uniqueKeys(plan.sections, findings);
  const open = unique.filter((u) => !decisions[u.key]).length;
  const rows = plan.sections.reduce((n, id) => n + (findings[id]?.section.itemCount ?? 0), 0);
  const permanent = plan.sections.filter((id) => DEEP_CONFIRM.includes(id)).length;
  const tiers = [...new Set(plan.sections.map((id) => TIER[id] ?? 'read'))];

  return (
    <div className="workbench">
      <PageHead
        id="h-ledger"
        dateline={t('flow.ledger.dateline', { name: plan.name })}
        title={t('flow.ledger.title')}
        lede={t('flow.ledger.lede')}
        actions={
          <>
            <RouterLink to="/sections" className="btn btn-quiet">{t('flow.ledger.change')}</RouterLink>
            <Btn isDisabled={missing} onPress={() => void saveLedger(plan, findings, decisions)}>{t('flow.ledger.export')}</Btn>
            <PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview(plan.sections, plan.name, plan.profile)}>
              {t('flow.ledger.rerun')}
            </PreviewBtn>
          </>
        }
      />
      <section className="panel span-9" aria-labelledby="h-rows" data-tour={t('flow.ledger.rowsTour')}>
        <div className="panel-head">
          <span className="idx">§ 01</span>
          <h2 id="h-rows">{t('flow.ledger.rowsTitle')}</h2>
          <span className="rule" />
          {!missing ? <span className="aside">{t('flow.ledger.measured', { when: formatDateTime(when) })}</span> : null}
        </div>
        {missing ? <p className="callout warn mb-4">{t('flow.ledger.stale')}</p> : null}
        <table className="ledger">
          <thead>
            <tr>
              <th>{t('flow.ledger.colPath')}</th>
              <th className="num">{t('flow.ledger.colSize')}</th>
              <th className="num">{t('flow.ledger.colAge')}</th>
              <th>{t('flow.ledger.colWhat')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.sections.map((id) => {
              const sec = findings[id]?.section;
              const tier = tierFor(id, sec?.stamp);
              const items = sec?.items.slice(0, ROWS_PER_SECTION) ?? [];
              const more = (sec?.itemCount ?? 0) - items.length;
              return [
                <tr className="group" key={`g${id}`}>
                  <td colSpan={4}>
                    <Plate id={id} tier={tier} /> {t(`sections.s${id}.title` as never)} <Stamp tier={tier} />
                    {sec?.reason ? <span className="sub">{sec.reason}</span> : null}
                  </td>
                </tr>,
                ...items.map((it) => (
                  <tr key={`${id}:${it.path}`}>
                    <td><span className="path">{it.path}</span></td>
                    <td className="num">{it.kb ? formatKb(it.kb) : '—'}</td>
                    <td className="num">{typeof it.ageDays === 'number' ? t('flow.ledger.ageDays', { count: it.ageDays }) : '—'}</td>
                    <td className="actions">
                      {it.unique ? <Trio itemKey={decisionKey(id, it.path)} path={it.path} /> : <Disposition item={it} tier={tier} />}
                    </td>
                  </tr>
                )),
                ...(sec && !items.length ? [<tr key={`e${id}`}><td colSpan={4} className="sub">{t('flow.ledger.noRows')}</td></tr>] : []),
                ...(more > 0 ? [<tr key={`m${id}`}><td colSpan={4} className="sub">{t('flow.ledger.more', { count: more })}</td></tr>] : []),
              ];
            })}
          </tbody>
        </table>
        <div className="totals">
          <span><b>{plan.sections.length}</b>{t('flow.ledger.totalsSections')}</span>
          <span><b>{rows}</b>{t('flow.ledger.totalsRows')}</span>
          <span><b>{unique.length}</b>{t('flow.ledger.totalsDecide')}</span>
          <span><b>{permanent}</b>{t('flow.ledger.totalsPermanent')}</span>
        </div>
      </section>
      <aside className="span-3 stack-v" aria-label={t('flow.ledger.nextTitle')}>
        <div className="panel inset" data-tour={t('flow.ledger.decisionsTour')}>
          <div className="panel-head"><span className="idx">§ 02</span><h2>{t('flow.ledger.decisionsTitle')}</h2><span className="rule" /></div>
          <p className="lede">{unique.length ? t('flow.ledger.decisionNote', { count: unique.length, open }) : t('flow.ledger.noUnique')}</p>
          {unique.length ? (
            <div className="row-actions mt-3">
              <Btn onPress={() => { decideMany(unique.map((u) => u.key), 'keep'); toast(translate('flow.ledger.keptAll')); }}>{t('flow.ledger.keepAll')}</Btn>
            </div>
          ) : null}
        </div>
        <div className="panel">
          <div className="panel-head"><span className="idx">§ 03</span><h2>{t('flow.ledger.nextTitle')}</h2><span className="rule" /></div>
          <div className="stack-v">
            <div className="row-actions">{tiers.map((tier) => <Stamp key={tier} tier={tier} />)}</div>
            <AppLink to="/confirm" className="btn btn-run"><span className="tag">{t('common.run')}</span>{t('flow.ledger.reviewRun')}</AppLink>
            <p className="lede">{t('flow.ledger.nextLede')}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
