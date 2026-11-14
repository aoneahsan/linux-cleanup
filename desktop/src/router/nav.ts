/**
 * The source list: every destination, its group, icon and tail. The router and
 * the ⌘K palette both read this table, so a screen is added in one place.
 */
import type { IconName } from '@/components/ui/Icon';
import type { TKey } from '@/i18n';

export type NavGroup = 'workbench' | 'review' | 'account' | 'admin' | 'help';
export type NavTail = { kind: 'count'; value: string } | { kind: 'pro' } | { kind: 'team' };

/** Every screen path the app plans; a path without a registered route is hidden at runtime. */
export type AppPath =
  | '/' | '/sections' | '/profiles' | '/preview' | '/confirm' | '/run' | '/receipt' | '/history'
  | '/apps' | '/services' | '/orphans' | '/snapshots' | '/assistant' | '/schedules' | '/account' | '/plans' | '/team' | '/settings' | '/backups'
  | '/admin' | '/admin/users' | '/admin/plans' | '/admin/grants' | '/admin/config' | '/admin/audit' | '/admin/releases'
  | '/walkthrough' | '/onboarding' | '/updates' | '/errors';

export interface NavItem {
  to: AppPath;
  label: TKey;
  icon: IconName;
  tail?: NavTail;
}

export const NAV: readonly { group: NavGroup; items: readonly NavItem[] }[] = [
  { group: 'workbench', items: [
    { to: '/', label: 'shell.rail.overview', icon: 'gauge' },
    { to: '/sections', label: 'shell.rail.sections', icon: 'plates', tail: { kind: 'count', value: '28' } },
    { to: '/profiles', label: 'shell.rail.profiles', icon: 'stack', tail: { kind: 'count', value: '5' } },
    { to: '/preview', label: 'shell.rail.preview', icon: 'ledger' },
    { to: '/history', label: 'shell.rail.history', icon: 'receipt' },
  ] },
  { group: 'review', items: [
    { to: '/apps', label: 'shell.rail.apps', icon: 'app' },
    { to: '/services', label: 'shell.rail.services', icon: 'launch' },
    { to: '/orphans', label: 'shell.rail.orphans', icon: 'orphan' },
    { to: '/snapshots', label: 'shell.rail.snapshots', icon: 'snap' },
    { to: '/assistant', label: 'shell.rail.assistant', icon: 'spark' },
  ] },
  { group: 'account', items: [
    { to: '/schedules', label: 'shell.rail.schedules', icon: 'calendar', tail: { kind: 'pro' } },
    { to: '/account', label: 'shell.rail.account', icon: 'person' },
    { to: '/plans', label: 'shell.rail.plans', icon: 'layers' },
    { to: '/team', label: 'shell.rail.team', icon: 'team', tail: { kind: 'team' } },
    { to: '/settings', label: 'shell.rail.settings', icon: 'sliders' },
  ] },
  { group: 'admin', items: [
    { to: '/admin', label: 'shell.rail.adminOverview', icon: 'shield' },
    { to: '/admin/users', label: 'shell.rail.adminUsers', icon: 'person' },
    { to: '/admin/plans', label: 'shell.rail.adminPlans', icon: 'layers' },
    { to: '/admin/grants', label: 'shell.rail.adminGrants', icon: 'gift' },
    { to: '/admin/config', label: 'shell.rail.adminConfig', icon: 'sliders' },
    { to: '/admin/audit', label: 'shell.rail.adminAudit', icon: 'ledger' },
    { to: '/admin/releases', label: 'shell.rail.adminReleases', icon: 'download' },
  ] },
  { group: 'help', items: [
    { to: '/walkthrough', label: 'shell.rail.walkthrough', icon: 'compass' },
    { to: '/onboarding', label: 'shell.rail.onboarding', icon: 'flag' },
    { to: '/updates', label: 'shell.rail.updates', icon: 'download' },
    { to: '/errors', label: 'shell.rail.errors', icon: 'wifioff' },
  ] },
];

/** Screens of the run flow: titled in the title bar, never listed in the source list. */
const FLOW: readonly NavItem[] = [
  { to: '/confirm', label: 'shell.rail.confirm', icon: 'ledger' },
  { to: '/run', label: 'shell.rail.run', icon: 'ledger' },
  { to: '/receipt', label: 'shell.rail.receipt', icon: 'ledger' },
];

/** Screens reached from a link, not the source list (titled under their group). */
const LINKED: readonly { group: NavGroup; item: NavItem }[] = [
  { group: 'account', item: { to: '/backups', label: 'shell.rail.backups', icon: 'cloudup' } },
];

/** Find the nav entry (and its group) for a pathname. */
export function navFor(pathname: string): { group: NavGroup; item: NavItem } | null {
  for (const g of NAV) {
    const item = g.items.find((i) => i.to === pathname);
    if (item) return { group: g.group, item };
  }
  const linked = LINKED.find((l) => l.item.to === pathname);
  if (linked) return linked;
  const flow = FLOW.find((i) => i.to === pathname);
  return flow ? { group: 'workbench', item: flow } : null;
}
