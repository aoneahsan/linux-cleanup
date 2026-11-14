import { useEffect, useRef, useState } from 'react';
import { Switch } from 'react-aria-components';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { AppLink, Btn, PageHead, StateCard } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { AccountsOff } from '@/components/states/NotInApp';
import { LoadMore } from '@/pages/admin/shared';
import { useT, translate } from '@/i18n';
import { formatDateTime, formatKb } from '@/i18n/format';
import { env, missingSupabaseVars } from '@/config/env';
import { usePlans } from '@/hooks/usePlans';
import { deleteBackup, getBackup, listBackups, type BackupRow } from '@/services/backups';
import { getDeviceId } from '@/services/account';
import { backupsKey } from '@/services/autoBackup';
import { queryClient } from '@/services/queryClient';
import { receiptFromSummary } from '@/lib/backupRestore';
import { toast } from '@/lib/feedback';
import { useReceipts } from '@/stores/receipts';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';

const PAGE = 20;
const UNDO_MS = 8000;

/** Free (or not included): what Pro adds, worded positively, with the upgrade link. */
function FreeCard() {
  const t = useT();
  const pro = usePlans().data?.find((p) => p.id === 'pro');
  return (
    <section className="span-12" aria-label={t('backups.freeLabel')}>
      <div className="state-card" data-tour={t('backups.freeTour')}>
        <Icon name="cloudup" />
        <h3>{t('backups.freeTitle')}</h3>
        <p>{pro?.receipt_backup_max ? t('backups.freeBody', { n: pro.receipt_backup_max }) : t('backups.freeBodyPlain')}</p>
        <ul className="checklist">
          {(['freeOne', 'freeTwo', 'freeThree'] as const).map((k) => <li key={k}><Icon name="check" />{t(`backups.${k}`)}</li>)}
        </ul>
        <p className="privacy-note">{t('backups.privacy')}</p>
        <AppLink to="/plans" className="btn btn-run"><span className="tag">{t('backups.proTag')}</span>{t('backups.seePro')}</AppLink>
      </div>
    </section>
  );
}

/** Receipt backups (Pro): list with cursor pages, restore to this Mac, delete with undo, storage meter, automatic backup. */
export default function BackupsPage() {
  const t = useT();
  const signedIn = useSession((s) => s.signedIn);
  const autoBackup = useSettings((s) => s.settings.autoBackup);
  const update = useSettings((s) => s.update);
  const addRestored = useReceipts((s) => s.addRestored);
  const device = useQuery({ queryKey: ['device-id'], queryFn: () => getDeviceId(), staleTime: Infinity });
  const list = useInfiniteQuery({
    queryKey: backupsKey,
    enabled: env.accountsConfigured && signedIn,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listBackups({ limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const [hidden, setHidden] = useState<BackupRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef<{ row: BackupRow; timer: number } | null>(null);

  const commit = async (row: BackupRow) => {
    try {
      await deleteBackup(row.id);
    } catch (e) {
      toast(translate('backups.deleteFailed', { message: e instanceof Error ? e.message : String(e) }));
    }
    setHidden((h) => (h?.id === row.id ? null : h));
    void queryClient.invalidateQueries({ queryKey: backupsKey });
  };
  // Leaving the screen with a delete waiting for Undo carries it out.
  useEffect(() => () => {
    const p = pending.current;
    if (p) { window.clearTimeout(p.timer); void deleteBackup(p.row.id).catch(() => undefined).then(() => queryClient.invalidateQueries({ queryKey: backupsKey })); }
  }, []);

  const remove = (row: BackupRow) => {
    if (pending.current) { window.clearTimeout(pending.current.timer); void commit(pending.current.row); }
    setHidden(row);
    pending.current = { row, timer: window.setTimeout(() => { pending.current = null; void commit(row); }, UNDO_MS) };
    window.requestAnimationFrame(() => document.getElementById('bk-undo-btn')?.focus());
  };
  const undo = () => {
    if (!pending.current) return;
    window.clearTimeout(pending.current.timer);
    pending.current = null;
    setHidden(null);
    toast(translate('backups.undone'));
  };
  const restore = async (row: BackupRow) => {
    setBusy(row.id);
    try {
      const { summary } = await getBackup(row.id);
      toast(translate(addRestored(receiptFromSummary(summary, translate('backups.restoredName'))) ? 'backups.restored' : 'backups.alreadyHere'));
    } catch (e) {
      toast(translate('backups.restoreFailed', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  };

  const pages = list.data?.pages ?? [];
  const head = pages[0];
  const rows = pages.flatMap((p) => p.items).filter((r) => r.id !== hidden?.id);
  const included = head?.included ?? false;
  const used = Math.max(0, (head?.used ?? 0) - (hidden ? 1 : 0));
  const max = head?.max ?? 0;
  const when = (iso: string) => formatDateTime(Date.parse(iso));

  const body = !env.accountsConfigured ? <div className="span-12"><AccountsOff vars={missingSupabaseVars} /></div>
    : !signedIn ? (
      <div className="span-12" data-tour={t('backups.signInTour')}>
        <StateCard icon="person" title={t('backups.signInTitle')} actions={<AppLink to="/account" className="btn btn-quiet">{t('backups.signIn')}</AppLink>}>{t('backups.signInBody')}</StateCard>
      </div>
    ) : list.isError ? (
      <div className="span-12">
        <StateCard tone="offline" icon="wifioff" title={t('states.server.title')} actions={<Btn onPress={() => void list.refetch()}>{t('common.retry')}</Btn>}>
          {t('backups.loadFailed', { message: list.error instanceof Error ? list.error.message : String(list.error) })}
        </StateCard>
      </div>
    ) : list.isPending ? <p className="lede span-12">{t('states.loading')}</p> : (
      <>
        {!included ? <FreeCard /> : null}
        {included || rows.length || hidden ? (
          <section className="panel span-8 wide" aria-labelledby="h-bk-list" data-tour={t('backups.listTour')}>
            <div className="panel-head"><span className="idx">§ 01</span><h2 id="h-bk-list">{t('backups.listTitle')}</h2><span className="rule" /></div>
            {hidden ? (
              <div className="banner" role="status">
                <Icon name="trash" /><span>{t('backups.deleted', { when: when(hidden.receipt_at) })}</span>
                <Btn id="bk-undo-btn" onPress={undo}>{t('backups.undo')}</Btn>
              </div>
            ) : null}
            <table className="ledger stack-sm">
              <thead><tr><th>{t('backups.colBacked')}</th><th>{t('backups.colReceipt')}</th><th className="num">{t('backups.colFreed')}</th><th>{t('backups.colMac')}</th><th><span className="sr-only">{t('backups.colActions')}</span></th></tr></thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" data-label={t('backups.colBacked')}>{when(r.created_at)}</td>
                    <td data-label={t('backups.colReceipt')}><b>{t('backups.receiptLine', { when: when(r.receipt_at) })}</b><span className="sub">{t('backups.sectionsLine', { count: r.sections_count })}</span></td>
                    <td className="num" data-label={t('backups.colFreed')}>{formatKb(r.freed_kb)}</td>
                    <td data-label={t('backups.colMac')}>{device.data && r.device_id === device.data ? t('backups.thisMac') : t('backups.otherMac')}</td>
                    <td className="actions" data-label={t('backups.colActions')}>
                      <span className="row-actions">
                        <Btn icon="download" isDisabled={busy === r.id} onPress={() => void restore(r)}>{t('backups.restore')}</Btn>
                        <Btn icon="trash" aria-label={t('backups.deleteLabel', { when: when(r.receipt_at) })} onPress={() => remove(r)}>{t('backups.delete')}</Btn>
                      </span>
                    </td>
                  </tr>
                )) : <tr><td colSpan={5}>{t('backups.empty')}</td></tr>}
              </tbody>
            </table>
            <LoadMore q={list} />
          </section>
        ) : null}
        {included ? (
          <aside className="panel inset span-4" aria-labelledby="h-bk-store" data-tour={t('backups.storeTour')}>
            <div className="panel-head"><span className="idx">§ 02</span><h2 id="h-bk-store">{t('backups.storeTitle')}</h2><span className="rule" /></div>
            <div className="allowance"><b>{t('backups.count', { used, max })}</b><div className="progress" aria-hidden="true"><i style={{ width: `${max ? Math.min(100, (used / max) * 100) : 0}%` }} /></div></div>
            <div className="setting-row">
              <div><b>{t('backups.autoTitle')}</b><p>{t('backups.autoBody')}</p></div>
              <Switch className="switch" isSelected={autoBackup} aria-label={t('backups.autoTitle')}
                onChange={(on) => { update({ autoBackup: on }); toast(translate(on ? 'backups.autoOn' : 'backups.autoOff')); }}>
                <span className="track" aria-hidden="true" />
                <span className="sr-only">{t(autoBackup ? 'settings.on' : 'settings.off')}</span>
              </Switch>
            </div>
            <div className="callout privacy-line"><Icon name="lock" /><span>{t('backups.privacy')}</span></div>
            <p className="lede mt-4">{t('backups.planLead')}<AppLink to="/plans" className="link-arrow">{t('backups.planLink')}</AppLink>{t('backups.planEnd')}</p>
          </aside>
        ) : null}
      </>
    );

  return (
    <div className="workbench">
      <PageHead id="h-bk" dateline={t('backups.dateline')} title={t('backups.title')} lede={t('backups.lede')}
        actions={<AppLink to="/history" className="btn btn-quiet"><Icon name="receipt" />{t('backups.historyLink')}</AppLink>} />
      {body}
    </div>
  );
}
