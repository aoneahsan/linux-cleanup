import { Button } from 'react-aria-components';
import { useRouterState } from '@tanstack/react-router';
import { Icon } from '@/components/ui/Icon';
import { AppLink, RouterLink } from '@/components/ui/primitives';
import { ThemeControl } from '@/components/shell/ThemeControl';
import { useT } from '@/i18n';
import { navFor } from '@/router/nav';
import { useSession } from '@/stores/session';
import { useOverlays } from '@/stores/overlays';
import { useSettings } from '@/stores/settings';

/** Overlay title bar: 78 px inset for the traffic lights, drag region, crumb, ⌘K, tour, theme, account. */
export function Titlebar() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = navFor(pathname);
  const { signedIn, displayName, plan } = useSession();
  const openPalette = useOverlays((s) => s.openPalette);
  const searchKeys = useSettings((s) => s.bindings.search);
  const startTour = useOverlays((s) => s.startTour);
  const tourAvailable = useOverlays((s) => s.tourSteps > 0);
  const tourHint = useOverlays((s) => s.tourHint);
  const initials = displayName ? displayName.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() : '—';

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="traffic" aria-hidden="true" data-tauri-drag-region>
        <span />
        <span />
        <span />
      </div>
      <RouterLink to="/" className="mark">
        <img src="/logo.svg" alt="" />
        {t('shell.brand')}
      </RouterLink>
      {nav ? (
        <span className="crumb" data-tauri-drag-region>
          {t('shell.crumbSeparator', { group: t(`shell.rail.groups.${nav.group}`) })}
          <b>{t(nav.item.label)}</b>
        </span>
      ) : null}
      <Button className="search-key" aria-haspopup="dialog" onPress={openPalette}>
        <Icon name="search" />
        <span>{t('shell.search')}</span>
        <kbd className="kbd">{searchKeys}</kbd>
      </Button>
      <div className="title-actions">
        {tourAvailable ? (
          <Button className={`dial-button${tourHint ? ' hint' : ''}`} aria-label={t('shell.tourStart')} onPress={startTour}>
            <Icon name="compass" />
          </Button>
        ) : null}
        <ThemeControl />
        <AppLink to="/account" className="account-chip">
          <span className="avatar">{signedIn ? initials : '—'}</span>
          <span className="who">
            {signedIn ? t('shell.accountChip', { name: displayName ?? '', plan: t(`shell.plan.${plan}`) }) : t('shell.notSignedIn')}
          </span>
        </AppLink>
      </div>
    </header>
  );
}
