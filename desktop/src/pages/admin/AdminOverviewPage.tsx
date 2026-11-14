import { useQuery } from '@tanstack/react-query';
import { AppLink, Panel } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { useSession } from '@/stores/session';
import { AdminFrame, admin } from '@/pages/admin/shared';

interface Stats {
  accounts: number; paying_accounts: number; devices: number; real_runs_this_month: number;
  active_grants: number; confirmed_referrals: number; month: string; runs_by_pool: Record<string, number> | null;
}

/** Admin overview: one aggregate call (`admin_stats`), never rows reduced in the browser. */
export default function AdminOverviewPage() {
  const t = useT();
  const role = useSession((s) => s.role);
  const q = useQuery({ queryKey: ['admin', 'stats'], enabled: role === 'admin', queryFn: () => admin<Stats>('stats') });
  const s = q.data;
  const tiles: [string, number | undefined][] = [
    [t('admin.overview.accounts'), s?.accounts], [t('admin.overview.paying'), s?.paying_accounts], [t('admin.overview.devices'), s?.devices],
    [t('admin.overview.runs'), s?.real_runs_this_month], [t('admin.overview.grants'), s?.active_grants], [t('admin.overview.referrals'), s?.confirmed_referrals],
  ];
  return (
    <AdminFrame id="h-admin" screen="shell.rail.adminOverview" title={t('admin.overview.title')} lede={t('admin.overview.lede')}>
      <section className="span-12" aria-label={t('shell.rail.adminOverview')}>
        <div className="tiles">
          {tiles.map(([k, v]) => <div className="tile" key={k}><span>{k}</span><b>{v === undefined ? '—' : formatNumber(v)}</b><small>{s?.month ?? ''}</small></div>)}
        </div>
      </section>
      {s?.runs_by_pool ? (
        <Panel idx="§ 01" title={t('admin.overview.pools')} titleId="h-pools" className="span-6">
          <dl className="kv">
            {Object.entries(s.runs_by_pool).map(([k, v]) => (
              <span key={k} className="contents"><dt>{(['device', 'account', 'plan'] as const).includes(k as 'device') ? t(`admin.overview.pool.${k as 'device'}`) : k}</dt><dd>{formatNumber(v)}</dd></span>
            ))}
          </dl>
        </Panel>
      ) : null}
      <Panel idx="§ 02" title={t('admin.overview.manage')} titleId="h-adm-manage" className="span-6" inset>
        <div className="row-actions">
          <AppLink to="/admin/users" className="btn btn-quiet">{t('admin.overview.linkUsers')}</AppLink>
          <AppLink to="/admin/plans" className="btn btn-quiet">{t('admin.overview.linkPlans')}</AppLink>
          <AppLink to="/admin/config" className="btn btn-quiet">{t('admin.overview.linkAllowance')}</AppLink>
          <AppLink to="/admin/releases" className="btn btn-quiet">{t('admin.overview.linkReleases')}</AppLink>
        </div>
      </Panel>
    </AdminFrame>
  );
}
