import { AppLink, Btn, PageHead, PreviewBtn, StateCard } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { formatDateTime, formatKb } from '@/i18n/format';
import { ALL_SAFE } from '@/data/sections';
import { useReceipts } from '@/stores/receipts';
import { startSafePreview } from '@/services/previewLauncher';
import { toast } from '@/lib/feedback';
import type { RunItem } from '@/lib/events';
import { commands, toAppError } from '@/lib/tauri';

/** Rows drawn per list; the counts above stay exact. */
const ROWS = 200;

/** Write the dry-run list (paths stay on this computer) to ~/Downloads through export_json. */
async function saveList(items: readonly RunItem[], measuredAt: number): Promise<void> {
  const content = JSON.stringify({ measured_ms: measuredAt, items }, null, 2);
  try {
    const { path } = await commands.exportJson(`linux-cleanup-dry-run-${new Date().toISOString().slice(0, 10)}.json`, content);
    toast(translate('flow.ledger.exported', { path }));
  } catch (e) {
    toast(translate('states.genericError', { message: toAppError(e).message || toAppError(e).kind }));
  }
}

function PathRows({ items, empty }: { items: readonly RunItem[]; empty: string }) {
  const t = useT();
  if (!items.length) return <p className="sub">{empty}</p>;
  return (
    <table className="ledger">
      <thead>
        <tr>
          <th>{t('flow.ledger.colPath')}</th>
          <th className="num">{t('flow.ledger.colSize')}</th>
          <th>{t('flow.ledger.colWhy')}</th>
        </tr>
      </thead>
      <tbody>
        {items.slice(0, ROWS).map((it) => (
          <tr key={it.path}>
            <td><span className="path">{it.path}</span></td>
            <td className="num">{it.kb ? formatKb(it.kb) : '—'}</td>
            <td className="sub">{it.reason || '—'}</td>
          </tr>
        ))}
        {items.length > ROWS ? <tr><td colSpan={3} className="sub">{t('flow.ledger.more', { count: items.length - ROWS })}</td></tr> : null}
      </tbody>
    </table>
  );
}

/** The dry-run ledger: what the all-safe cleanup would remove, and what it refused to touch. */
export default function PreviewPage() {
  const t = useT();
  const finding = useReceipts((s) => s.findings[ALL_SAFE] ?? null);

  if (!finding) {
    return (
      <div className="workbench">
        <div className="span-12">
          <StateCard
            icon="ledger"
            title={t('flow.ledger.noPlan')}
            actions={<PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('flow.ledger.start')}</PreviewBtn>}
          >
            {t('flow.ledger.noPlanBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const items = finding.section.items;
  const remove = items.filter((i) => i.action === 'delete' || i.action === 'trash');
  const kept = items.filter((i) => i.action === 'skip');
  const proposedKb = finding.section.plannedKb;

  return (
    <div className="workbench">
      <PageHead
        id="h-ledger"
        dateline={t('flow.ledger.dateline', { when: formatDateTime(finding.at) })}
        title={t('flow.ledger.title')}
        lede={t('flow.ledger.lede')}
        actions={
          <>
            <Btn onPress={() => void saveList(items, finding.at)}>{t('flow.ledger.export')}</Btn>
            <PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('flow.ledger.rerun')}</PreviewBtn>
          </>
        }
      />
      <section className="panel span-9" aria-labelledby="h-remove" data-tour={t('flow.ledger.rowsTour')}>
        <div className="panel-head">
          <span className="idx">§ 01</span>
          <h2 id="h-remove">{t('flow.ledger.removeTitle', { count: remove.length })}</h2>
          <span className="rule" />
          <span className="aside">{t('flow.ledger.measured', { when: formatDateTime(finding.at) })}</span>
        </div>
        <PathRows items={remove} empty={t('flow.ledger.noRemove')} />
        <div className="panel-head mt-6">
          <span className="idx">§ 02</span>
          <h2>{t('flow.ledger.keptTitle', { count: kept.length })}</h2>
          <span className="rule" />
        </div>
        <PathRows items={kept} empty={t('flow.ledger.noKept')} />
      </section>
      <aside className="span-3 stack-v" aria-label={t('flow.ledger.nextTitle')}>
        <div className="panel inset" data-tour={t('flow.ledger.decisionsTour')}>
          <div className="panel-head"><span className="idx">§ 03</span><h2>{t('flow.ledger.totalsTitle')}</h2><span className="rule" /></div>
          <div className="totals">
            <span><b>{remove.length}</b>{t('flow.ledger.totalsRemove')}</span>
            <span><b>{proposedKb ? formatKb(proposedKb) : '—'}</b>{t('flow.ledger.totalsSize')}</span>
            <span><b>{kept.length}</b>{t('flow.ledger.totalsKept')}</span>
          </div>
          <p className="help lede mt-3">{t('flow.ledger.sizeNote')}</p>
        </div>
        <div className="panel">
          <div className="panel-head"><span className="idx">§ 04</span><h2>{t('flow.ledger.nextTitle')}</h2><span className="rule" /></div>
          <div className="stack-v">
            <AppLink to="/confirm" className="btn btn-run"><span className="tag">{t('common.run')}</span>{t('flow.ledger.reviewRun')}</AppLink>
            <p className="lede">{t('flow.ledger.nextLede')}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
