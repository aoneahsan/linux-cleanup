import { useRouterState } from '@tanstack/react-router';
import { Icon } from '@/components/ui/Icon';
import { AppLink, TagChip } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { NAV } from '@/router/nav';
import { isRegistered } from '@/router/registry';
import { useSession } from '@/stores/session';

/** Source list — every destination carries its plate number or key. Admin shows only for the server's admin role. */
export function Rail() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = useSession((s) => s.role);
  return (
    <nav className="rail" aria-label={t('shell.rail.label')}>
      {NAV.filter((g) => g.group !== 'admin' || role === 'admin').map((g) => {
        const items = g.items.filter((i) => isRegistered(i.to));
        if (!items.length) return null;
        return (
          <div className="rail-group" key={g.group}>
            <span className="rail-label">{t(`shell.rail.groups.${g.group}`)}</span>
            {items.map((item) => (
              <AppLink
                key={item.to}
                to={item.to}
                className="rail-link"
                aria-current={pathname === item.to ? 'page' : undefined}
                aria-label={t(item.label)}
              >
                <Icon name={item.icon} />
                <span className="label">{t(item.label)}</span>
                {item.tail?.kind === 'count' ? <span className="count">{item.tail.value}</span> : null}
                {item.tail?.kind === 'pro' ? <TagChip tone="pro">{t('shell.rail.pro')}</TagChip> : null}
                {item.tail?.kind === 'team' ? <TagChip tone="pro">{t('shell.rail.teamTag')}</TagChip> : null}
              </AppLink>
            ))}
          </div>
        );
      })}
      <div className="rail-foot">
        <b>{t('shell.rail.footTitle')}</b>
        {t('shell.rail.footBody')}
      </div>
    </nav>
  );
}
