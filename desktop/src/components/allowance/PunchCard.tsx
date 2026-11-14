import { useT } from '@/i18n';
import { useAllowance, runsLeft } from '@/stores/allowance';
import { useSession } from '@/stores/session';
import { DeviceOwned } from '@/components/allowance/DeviceOwned';

function Holes({ used, limit, label }: { used: number; limit: number; label: string }) {
  return (
    <div className="holes" role="img" aria-label={label}>
      {Array.from({ length: limit }, (_, i) => (
        <span key={i} className={`hole${i < used ? ' punched' : ''}`} />
      ))}
    </div>
  );
}

/** The allowance punch card. Previews never punch a hole. Figures come only from the `allowance` function. */
export function PunchCard() {
  const t = useT();
  const a = useAllowance((s) => s.allowance);
  const signedIn = useSession((s) => s.signedIn);
  const owned = useAllowance((s) => s.deviceOwned);
  if (owned) return <DeviceOwned />;
  if (!a) return <p className="lede">{t('overview.allowance.waiting')}</p>;
  const deviceLeft = Math.max(0, a.device.limit - a.device.used);
  const acc = a.account;
  return (
    <>
      <p className="aside">{a.plan.unlimited ? t('overview.allowance.noLimit') : t('overview.allowance.total', { count: runsLeft(a) })}</p>
      <div className="punch-grid">
        <div className="pool">
          <div className="pool-name"><b>{t('overview.allowance.thisMac')}</b>{t('overview.allowance.signedOut')}</div>
          <Holes used={a.device.used} limit={a.device.limit} label={t('overview.allowance.ofLeft', { left: deviceLeft, limit: a.device.limit })} />
          <span className="pool-left">{t('overview.allowance.left', { count: deviceLeft })}</span>
        </div>
        <div className={`pool${acc && signedIn ? '' : ' locked'}`}>
          <div className="pool-name">
            <b>{t('overview.allowance.account')}</b>
            {acc && signedIn ? t('overview.allowance.signedIn') : t('overview.allowance.signInToAdd')}
          </div>
          {acc && signedIn ? (
            <Holes used={acc.used} limit={acc.limit} label={t('overview.allowance.ofLeft', { left: acc.limit - acc.used, limit: acc.limit })} />
          ) : (
            <Holes used={0} limit={a.device.limit} label={t('overview.allowance.locked')} />
          )}
          <span className="pool-left">
            {acc && signedIn ? t('overview.allowance.left', { count: Math.max(0, acc.limit - acc.used) }) : null}
          </span>
        </div>
      </div>
    </>
  );
}
