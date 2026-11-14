import { Disclosure, DisclosurePanel, Button, Heading } from 'react-aria-components';
import { useT } from '@/i18n';
import { formatDateTime, formatGiB, plate } from '@/i18n/format';
import type { Receipt } from '@/stores/receipts';

/** Torn-edge paper slip summarising one receipt. */
export function ReceiptSlip({ receipt }: { receipt: Receipt }) {
  const t = useT();
  const free = receipt.dryRun
    ? t('receipt.nothingDeleted')
    : receipt.freeBeforeKb !== null && receipt.freeAfterKb !== null
      ? t('receipt.freeChange', { before: formatGiB(receipt.freeBeforeKb), after: formatGiB(receipt.freeAfterKb) })
      : '—';
  return (
    <article className="slip">
      <div className="slip-head">
        <b>{receipt.name.toUpperCase()}</b>
        <span className={`kind ${receipt.dryRun ? 'preview' : 'real'}`}>{receipt.dryRun ? t('receipt.preview') : t('receipt.real')}</span>
      </div>
      <div className="muted">{formatDateTime(receipt.at)}</div>
      <div className="slip-tally">
        <div><b>{receipt.tally.attempted}</b>{t('receipt.attempted')}</div>
        <div><b>{receipt.tally.completed}</b>{t('receipt.completed')}</div>
        <div><b>{receipt.tally.skipped}</b>{t('receipt.skipped')}</div>
        <div><b>{receipt.tally.failed}</b>{t('receipt.failed')}</div>
      </div>
      <Disclosure className="slip-more">
        <Heading level={3} className="slip-summary-h">
          <Button slot="trigger" className="slip-summary">{t('receipt.freeSpace', { value: free })}</Button>
        </Heading>
        <DisclosurePanel>
          <p className="muted">{t('receipt.sectionsLine', { ids: receipt.sections.map((s) => plate(s.id)).join(' ') })}</p>
          {receipt.interrupted ? <p>{receipt.cancelled ? t('receipt.cancelled') : t('receipt.interrupted')}</p> : null}
          {receipt.sections.filter((s) => s.reason).slice(0, 4).map((s) => (
            <p key={s.id}>{`${plate(s.id)} · ${s.reason ?? ''}`}</p>
          ))}
        </DisclosurePanel>
      </Disclosure>
    </article>
  );
}
