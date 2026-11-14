import { useSearch } from '@tanstack/react-router';
import { AppLink, Btn, PageHead, Plate, PreviewBtn, StateCard } from '@/components/ui/primitives';
import { StaticBar } from '@/components/disk/DiskGauge';
import { useT, translate } from '@/i18n';
import { formatDateTime, formatGiB, formatKb, plate } from '@/i18n/format';
import { TIER } from '@/data/sections';
import { useCliInfo } from '@/hooks/useLocal';
import { useReceipts, type ReceiptSection } from '@/stores/receipts';
import { commands, toAppError } from '@/lib/tauri';
import { toast } from '@/lib/feedback';
import { startSafePreview } from '@/services/previewLauncher';

const BADGE: Record<ReceiptSection['state'], string> = { completed: 'ok', skipped: 'warn', failed: 'bad', pending: '', running: '' };

async function openLocal(path: string | null | undefined) {
  if (!path) return;
  try {
    await commands.openPath(path);
  } catch (e) {
    toast(translate('states.genericError', { message: toAppError(e).message || toAppError(e).kind }));
  }
}

/** Receipt: the slip, before/after on one gauge, and section-by-section results. */
export default function ReceiptPage() {
  const t = useT();
  const { id } = useSearch({ from: '/receipt' });
  const receipts = useReceipts((s) => s.receipts);
  const cli = useCliInfo();
  const r = receipts.find((x) => x.id === id) ?? receipts[0];

  if (!r) {
    return (
      <div className="workbench">
        <div className="span-12">
          <StateCard icon="receipt" title={t('flow.receiptPage.none')} actions={<PreviewBtn tag={t('common.dryRun')} onPress={() => void startSafePreview()}>{t('flow.live.pick')}</PreviewBtn>}>
            {t('flow.receiptPage.noneBody')}
          </StateCard>
        </div>
      </div>
    );
  }

  const before = r.freeBeforeKb;
  const after = r.freeAfterKb;
  const total = r.totalKb;

  return (
    <div className="workbench">
      <PageHead
        id="h-rec"
        dateline={t('flow.receiptPage.dateline', { when: formatDateTime(r.at) })}
        title={t('flow.receiptPage.title')}
        lede={t('flow.receiptPage.lede')}
        actions={
          <>
            <Btn icon="book" isDisabled={!r.reports[0]} onPress={() => void openLocal(r.reports[0])}>{t('flow.receiptPage.openReport')}</Btn>
            <Btn icon="terminal" isDisabled={!r.log} onPress={() => void openLocal(r.log)}>{t('flow.receiptPage.openLog')}</Btn>
            <AppLink to="/history" className="btn btn-quiet">{t('flow.receiptPage.all')}</AppLink>
          </>
        }
      />
      <section className="span-5" aria-label={t('flow.receiptPage.slipLabel')} data-tour={t('flow.receiptPage.slipTour')}>
        <article className="slip slip-big">
          <div className="slip-head">
            <b>{r.name.toUpperCase()}</b>
            <span className={`kind ${r.dryRun ? 'preview' : 'real'}`}>{r.dryRun ? t('receipt.preview') : t('receipt.real')}</span>
          </div>
          <div className="muted">{t('flow.receiptPage.slipMeta', { when: formatDateTime(r.at), version: cli.data?.version ?? '—' })}</div>
          <hr className="perf" />
          {r.sections.map((s) => (
            <div className="slip-line" key={s.id}>
              <span>{`${plate(s.id)} ${t(`sections.s${s.id}.title` as never)}`}</span>
              <span>{t(`common.tiers.${TIER[s.id] ?? 'read'}`)}</span>
            </div>
          ))}
          <div className="slip-tally">
            <div><b>{r.tally.attempted}</b>{t('receipt.attempted')}</div>
            <div><b>{r.tally.completed}</b>{t('receipt.completed')}</div>
            <div><b>{r.tally.skipped}</b>{t('receipt.skipped')}</div>
            <div><b>{r.tally.failed}</b>{t('receipt.failed')}</div>
          </div>
          <hr className="perf" />
          <div className="slip-line">
            <span>{t('flow.receiptPage.freeSpace')}</span>
            <b>{r.dryRun ? t('receipt.nothingDeleted') : before !== null && after !== null ? t('receipt.freeChange', { before: formatGiB(before), after: formatGiB(after) }) : '—'}</b>
          </div>
          {r.interrupted ? <p className="muted">{r.cancelled ? t('receipt.cancelled') : t('receipt.interrupted')}</p> : null}
          {r.errors.slice(0, 3).map((e) => <p className="muted" key={e}>{e}</p>)}
        </article>
      </section>
      <section className="span-7 stack-v" aria-label={t('flow.receiptPage.detail')}>
        <div className="panel" data-tour={t('flow.receiptPage.baTour')}>
          <div className="panel-head"><span className="idx">§ 01</span><h2>{t('flow.receiptPage.baTitle')}</h2><span className="rule" /></div>
          {total && before !== null && after !== null ? (
            <div className="ba">
              <div className="ba-row"><span className="badge">{t('flow.receiptPage.before')}</span><StaticBar totalKb={total} freeKb={before} /><b>{formatGiB(before)}</b></div>
              <div className="ba-row"><span className="badge accent">{t('flow.receiptPage.after')}</span><StaticBar totalKb={total} freeKb={after} /><b>{formatGiB(after)}</b></div>
            </div>
          ) : null}
          <p className="lede">
            {r.dryRun ? t('flow.receiptPage.baPreview') : after !== null && before !== null && after > before ? t('flow.receiptPage.baGain', { size: formatKb(after - before) }) : null}{' '}
            {null}
          </p>
        </div>
        <div className="panel">
          <div className="panel-head"><span className="idx">§ 02</span><h2>{t('flow.receiptPage.linesTitle')}</h2><span className="rule" /></div>
          <table className="ledger">
            <thead><tr><th>{t('flow.receiptPage.colSection')}</th><th>{t('flow.receiptPage.colResult')}</th><th>{t('flow.receiptPage.colNote')}</th></tr></thead>
            <tbody>
              {r.sections.map((s) => (
                <tr key={s.id}>
                  <td><Plate id={s.id} tier={TIER[s.id] ?? 'read'} /> {t(`sections.s${s.id}.title` as never)}</td>
                  <td><span className={`badge ${BADGE[s.state]}`}>{t(`flow.live.states.${s.state}`)}</span></td>
                  <td>{s.reason ?? (r.dryRun ? (s.plannedKb ? t('flow.receiptPage.noteFound', { size: formatKb(s.plannedKb) }) : t('flow.receiptPage.noteDone')) : s.freedKb ? t('flow.receiptPage.noteFreed', { size: formatKb(s.freedKb) }) : t('flow.receiptPage.noteDone'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
