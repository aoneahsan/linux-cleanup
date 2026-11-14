import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Btn, PageHead, Panel } from '@/components/ui/primitives';
import { AccountsOff } from '@/components/states/NotInApp';
import { useT, translate } from '@/i18n';
import { formatDateTime, formatGiB, formatKb, plate } from '@/i18n/format';
import { useLocalHistory } from '@/hooks/useLocal';
import { useReceipts, type Receipt } from '@/stores/receipts';
import { useSession } from '@/stores/session';
import { env, missingSupabaseVars } from '@/config/env';
import { toast } from '@/lib/feedback';
import { DataTable, columnsFor } from '@/components/table/DataTable';
import { supabase } from '@/services/supabase';
import { getDeviceId } from '@/services/account';

type Kind = 'all' | 'real' | 'preview' | 'synced';
const PAGE = 20;

/** Numbers-only CSV of receipts: no path ever leaves the Mac. */
function toCsv(rows: Receipt[]): string {
  const head = 'when,name,kind,sections,attempted,completed,skipped,failed,freed_kb,free_before_kb,free_after_kb';
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [head, ...rows.map((r) => [
    new Date(r.at).toISOString(), esc(r.name), r.dryRun ? 'preview' : 'real', esc(r.sections.map((s) => plate(s.id)).join(' ')),
    r.tally.attempted, r.tally.completed, r.tally.skipped, r.tally.failed, r.freedKb, r.freeBeforeKb ?? '', r.freeAfterKb ?? '',
  ].join(','))].join('\n');
}

const col = columnsFor<Receipt>();

function Rows({ rows }: { rows: Receipt[] }) {
  const t = useT();
  const [shown, setShown] = useState(PAGE);
  const columns = col.columns([
    col.accessor('at', { header: t('flow.history.colWhen'), cell: (c) => formatDateTime(c.getValue()) }),
    col.accessor('name', { header: t('flow.history.colName') }),
    col.accessor((r) => (r.dryRun ? 0 : 1), { id: 'kind', header: t('flow.history.colKind'), cell: (c) => (
      <>
        <span className={`badge${c.row.original.dryRun ? '' : ' accent'}`}>{c.row.original.dryRun ? t('flow.history.kindPreview') : t('flow.history.kindReal')}</span>
        {c.row.original.schedule ? <> <span className="tagchip pro">{t('schedules.scheduledTag')}</span></> : null}
        {c.row.original.restored ? <> <span className="tagchip note">{t('flow.history.restoredTag')}</span></> : null}
      </>
    ) }),
    col.accessor((r) => r.sections.length, { id: 'sections', header: t('flow.history.colSections'), meta: { num: true } }),
    col.accessor((r) => r.tally.completed / Math.max(1, r.tally.attempted), { id: 'result', header: t('flow.history.colResult'), cell: (c) => {
      const r = c.row.original;
      return <span className={`badge ${r.tally.failed ? 'bad' : r.tally.skipped ? 'warn' : 'ok'}`}>{t('flow.history.result', { completed: r.tally.completed, attempted: r.tally.attempted })}</span>;
    } }),
    col.accessor((r) => r.freeAfterKb ?? 0, { id: 'free', header: t('flow.history.colFree'), meta: { num: true }, cell: (c) => {
      const r = c.row.original;
      return r.dryRun ? t('receipt.nothingDeleted') : r.freeAfterKb !== null ? formatGiB(r.freeAfterKb) : '—';
    } }),
    col.display({ id: 'open', header: '', enableSorting: false, meta: { num: true }, cell: (c) => <AppLinkReceipt id={c.row.original.id} /> }),
  ]);
  return (
    <>
      <DataTable data={rows.slice(0, shown)} columns={columns} empty={t('flow.history.empty')} rowKey={(r) => r.id} />
      {rows.length > shown ? (
        <div className="row-actions mt-3">
          <span className="lede">{t('flow.history.page', { shown, total: rows.length })}</span>
          <Btn onPress={() => setShown((n) => n + PAGE)}>{t('flow.history.more')}</Btn>
        </div>
      ) : null}
    </>
  );
}

function AppLinkReceipt({ id }: { id: string }) {
  const t = useT();
  const navigate = useNavigate();
  return <Button className="link-arrow" onPress={() => void navigate({ to: '/receipt', search: { id } })}>{t('flow.history.open')}</Button>;
}

/** History: every local receipt, filterable by kind; synced receipts from other Macs when signed in. */
export default function HistoryPage() {
  const t = useT();
  const search = useSearch({ from: '/history' });
  const navigate = useNavigate({ from: '/history' });
  const receipts = useReceipts((s) => s.receipts);
  const signedIn = useSession((s) => s.signedIn);
  const files = useLocalHistory(500);
  const kind: Kind = search.kind ?? 'all';
  const filtered = (k: Kind) => receipts.filter((r) => k === 'all' || (k === 'real' ? !r.dryRun : r.dryRun));
  const summary = (fileKind: 'log' | 'report') => {
    const list = (files.data ?? []).filter((f) => f.kind === fileKind);
    return { count: list.length, size: list.reduce((n, f) => n + f.size_bytes, 0) };
  };
  const logs = summary('log');
  const reports = summary('report');

  return (
    <div className="workbench">
      <PageHead
        id="h-hist"
        dateline={t('flow.history.dateline')}
        title={t('flow.history.title')}
        lede={t('flow.history.lede')}
        actions={
          <Btn
            icon="download"
            isDisabled={!receipts.length}
            onPress={() => {
              void navigator.clipboard.writeText(toCsv(filtered(kind === 'synced' ? 'all' : kind))).then(() =>
                toast(translate('flow.history.exported', { count: filtered(kind === 'synced' ? 'all' : kind).length })),
              );
            }}
          >
            {t('flow.history.exportCsv')}
          </Btn>
        }
      />
      <section className="panel span-12" aria-labelledby="h-hist-list" data-tour={t('flow.history.listTour')}>
        <h2 id="h-hist-list" className="sr-only">{t('flow.history.title')}</h2>
        <Tabs selectedKey={kind} onSelectionChange={(k) => void navigate({ search: { kind: k === 'all' ? undefined : (k as Kind) }, replace: true })}>
          <TabList className="tabs" aria-label={t('flow.history.filter')}>
            <Tab id="all">{t('flow.history.all')}</Tab>
            <Tab id="real">{t('flow.history.real')}</Tab>
            <Tab id="preview">{t('flow.history.previews')}</Tab>
            <Tab id="synced">{t('flow.history.synced')}</Tab>
          </TabList>
          {(['all', 'real', 'preview'] as const).map((k) => (
            <TabPanel key={k} id={k}><Rows rows={filtered(k)} /></TabPanel>
          ))}
          <TabPanel id="synced">
            {!env.accountsConfigured ? <AccountsOff vars={missingSupabaseVars} /> : signedIn ? <SyncedRows /> : <p className="lede">{t('flow.history.syncedOff')}</p>}
          </TabPanel>
        </Tabs>
      </section>
      <Panel idx="§ 02" title={t('flow.history.filesTitle')} titleId="h-files" className="span-6" inset>
        <dl className="kv">
          <dt>{t('flow.history.logs')}</dt>
          <dd>{t('flow.history.filesLine', { dir: '~/.macleanup/logs', count: logs.count, size: formatKb(logs.size / 1024) })}</dd>
          <dt>{t('flow.history.reports')}</dt>
          <dd>{t('flow.history.filesLine', { dir: '~/.macleanup/reports', count: reports.count, size: formatKb(reports.size / 1024) })}</dd>
          <dt>{t('flow.history.keptFor')}</dt>
          <dd>{t('flow.history.keptForValue')}</dd>
        </dl>
      </Panel>
      <Panel idx="§ 03" title={t('flow.history.syncTitle')} titleId="h-sync" className="span-6">
        <table className="ledger">
          <thead><tr><th>{t('flow.history.field')}</th><th>{t('flow.history.leaves')}</th></tr></thead>
          <tbody>
            {(['syncSections', 'syncBytes', 'syncMac'] as const).map((k) => (
              <tr key={k}><td>{t(`flow.history.${k}`)}</td><td><span className="badge ok">{t('flow.history.yesSignedIn')}</span></td></tr>
            ))}
            <tr><td>{t('flow.history.syncPaths')}</td><td><span className="badge bad">{t('flow.history.never')}</span></td></tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

interface SyncedSummary {
  id: string;
  created_at: string;
  dry_run: boolean;
  device_id: string;
  os_version: string;
  disk_free_after_kb: number | null;
  sections: { section_id: number; status: string; freed_kb: number }[];
}

type RawSummary = Omit<SyncedSummary, 'sections'> & { run_summary_sections: SyncedSummary['sections'] | null };

/** Receipts synced from the account's other Macs (numbers only), read under RLS, newest 20. */
function SyncedRows() {
  const t = useT();
  const q = useQuery({
    queryKey: ['run-summaries', 'others'],
    queryFn: async () => {
      const sb = supabase();
      if (!sb) return [];
      const device = await getDeviceId();
      const { data, error } = await sb
        .from('run_summaries')
        .select('id, created_at, dry_run, device_id, os_version, disk_free_after_kb, run_summary_sections(section_id, status, freed_kb)')
        .neq('device_id', device)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (error) throw error;
      return ((data ?? []) as RawSummary[]).map((r) => ({ ...r, sections: r.run_summary_sections ?? [] }));
    },
  });
  if (q.isPending) return <p className="lede">{t('states.loading')}</p>;
  if (q.error) return <p className="callout warn">{t('states.server.body')}</p>;
  if (!q.data.length) return <p className="lede">{t('flow.history.empty')}</p>;
  return (
    <table className="ledger">
      <thead>
        <tr>
          <th>{t('flow.history.colWhen')}</th><th>{t('flow.history.colMac')}</th><th>{t('flow.history.colKind')}</th>
          <th className="num">{t('flow.history.colSections')}</th><th>{t('flow.history.colResult')}</th><th className="num">{t('flow.history.colFree')}</th>
        </tr>
      </thead>
      <tbody>
        {q.data.map((r) => {
          const completed = r.sections.filter((x) => x.status === 'completed').length;
          return (
            <tr key={r.id}>
              <td>{formatDateTime(Date.parse(r.created_at))}</td>
              <td>{t('flow.history.macLine', { version: r.os_version })}</td>
              <td><span className={`badge${r.dry_run ? '' : ' accent'}`}>{r.dry_run ? t('flow.history.kindPreview') : t('flow.history.kindReal')}</span></td>
              <td className="num">{r.sections.length}</td>
              <td><span className="badge ok">{t('flow.history.result', { completed, attempted: r.sections.length })}</span></td>
              <td className="num">{r.disk_free_after_kb !== null ? formatGiB(r.disk_free_after_kb) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
