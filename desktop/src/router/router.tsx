/**
 * Code-based TanStack Router. Every screen is lazy-loaded; URL search params hold
 * filters, tabs and focus so a reload restores the exact view.
 */
import { createRootRoute, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router';
import { usePrefs } from '@/stores/prefs';
import { track } from '@/services/analytics';
import { z } from 'zod';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorView, NotFoundView } from '@/components/shell/ErrorView';
import { registerPaths } from '@/router/registry';

const rootRoute = createRootRoute({
  component: AppShell,
  errorComponent: ({ error }) => <ErrorView error={error} />,
  notFoundComponent: NotFoundView,
});

const page = (path: string, load: Parameters<typeof lazyRouteComponent>[0]) =>
  createRoute({ getParentRoute: () => rootRoute, path, component: lazyRouteComponent(load) });

const overview = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    // First launch opens the five-step onboarding once.
    if (!usePrefs.getState().onboarded) throw redirect({ to: '/onboarding' });
  },
  component: lazyRouteComponent(() => import('@/pages/overview/OverviewPage')),
});

const preview = page('/preview', () => import('@/pages/flow/PreviewPage'));
const confirm = page('/confirm', () => import('@/pages/flow/ConfirmPage'));
const run = page('/run', () => import('@/pages/flow/RunPage'));
const receipt = createRoute({
  getParentRoute: () => rootRoute,
  path: '/receipt',
  validateSearch: z.object({ id: z.string().max(40).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/flow/ReceiptPage')),
});
const history = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  validateSearch: z.object({ kind: z.enum(['all', 'real', 'preview', 'synced']).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/flow/HistoryPage')),
});

const settings = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  validateSearch: z.object({ tab: z.enum(['general', 'notify', 'privacy', 'keys']).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/settings/SettingsPage')),
});

const onboarding = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  validateSearch: z.object({ step: z.coerce.number().int().min(1).max(3).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/help/OnboardingPage')),
});
const updates = page('/updates', () => import('@/pages/help/UpdatesPage'));
const errors = page('/errors', () => import('@/pages/help/ErrorsPage'));

const schedules = page('/schedules', () => import('@/pages/account/SchedulesPage'));

const account = page('/account', () => import('@/pages/account/AccountPage'));
const plans = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans',
  validateSearch: z.object({ interval: z.enum(['month', 'year']).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/account/PlansPage')),
});
const team = page('/team', () => import('@/pages/account/TeamPage'));

const adminOverview = page('/admin', () => import('@/pages/admin/AdminOverviewPage'));
const adminUsers = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/users',
  validateSearch: z.object({ q: z.string().max(254).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/admin/AdminUsersPage')),
});
const adminPlans = page('/admin/plans', () => import('@/pages/admin/AdminPlansPage'));
const adminGrants = page('/admin/grants', () => import('@/pages/admin/AdminGrantsPage'));
const adminConfig = page('/admin/config', () => import('@/pages/admin/AdminConfigPage'));
const adminAudit = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/audit',
  validateSearch: z.object({ action: z.string().max(64).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/admin/AdminAuditPage')),
});

const adminReleases = page('/admin/releases', () => import('@/pages/admin/AdminReleasesPage'));

const walkthrough = createRoute({
  getParentRoute: () => rootRoute,
  path: '/walkthrough',
  validateSearch: z.object({ step: z.coerce.number().int().min(1).max(6).optional().catch(undefined) }),
  component: lazyRouteComponent(() => import('@/pages/help/WalkthroughPage')),
});

const routeTree = rootRoute.addChildren([walkthrough, adminOverview, adminUsers, adminPlans, adminGrants, adminConfig, adminAudit, adminReleases, account, plans, team, schedules, settings, onboarding, updates, errors, overview, preview, confirm, run, receipt, history]);

registerPaths(['/walkthrough', '/', '/preview', '/confirm', '/run', '/receipt', '/history', '/settings', '/schedules', '/account', '/plans', '/team', '/admin', '/admin/users', '/admin/plans', '/admin/grants', '/admin/config', '/admin/audit', '/admin/releases', '/onboarding', '/updates', '/errors']);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultErrorComponent: ({ error }) => <ErrorView error={error} />,
});

// One screen_view per resolved route: the path only (no search params, no ids).
router.subscribe('onResolved', ({ toLocation }) => track('screen_view', { screen: toLocation.pathname }));

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
