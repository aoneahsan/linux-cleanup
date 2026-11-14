/**
 * The linux-cleanup component vocabulary from the approved dummy: buttons (dashed =
 * preview, solid = changes files), section plates, recovery stamps, tag chips,
 * panels and state cards. Every interactive part is a React Aria primitive.
 */
import type { ReactNode } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { createLink, type LinkComponent } from '@tanstack/react-router';
import { Link as AriaLink, type LinkProps as AriaLinkProps } from 'react-aria-components';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/i18n';
import { plate as pad } from '@/i18n/format';
import type { Tier } from '@/data/sections';
import { click } from '@/lib/feedback';
import { openExternal } from '@/lib/open';
import { isRegistered } from '@/router/registry';
import { isActive, useRun } from '@/stores/run';
import type { AppPath } from '@/router/nav';

export type Variant = 'preview' | 'run' | 'quiet' | 'stop' | 'danger';

interface BtnProps extends Omit<AriaButtonProps, 'children' | 'className'> {
  variant?: Variant;
  tag?: string;
  icon?: IconName;
  kbd?: string;
  className?: string;
  children: ReactNode;
}

/** A command button. */
export function Btn({ variant = 'quiet', tag, icon, kbd, className, children, onPress, ...rest }: BtnProps) {
  return (
    <AriaButton
      {...rest}
      className={`btn btn-${variant}${className ? ` ${className}` : ''}`}
      onPress={(e) => {
        click();
        onPress?.(e);
      }}
    >
      {tag ? <span className="tag">{tag}</span> : null}
      {icon ? <Icon name={icon} /> : null}
      {children}
      {kbd ? <span className="kbd">{kbd}</span> : null}
    </AriaButton>
  );
}

const AriaRouterLink = createLink(AriaLink);

/** A router link styled with the dummy's classes (React Aria Link under TanStack's createLink). */
export const RouterLink: LinkComponent<typeof AriaLink> = AriaRouterLink;

/** An external link: opens in the system browser through plugin-opener, and says so (icon + accessible text). */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode } & Pick<AriaLinkProps, 'aria-label'>) {
  const t = useT();
  const hasArrow = typeof children === 'string' && children.trim().endsWith('↗');
  return (
    <AriaLink
      href={href}
      className={className}
      onPress={() => {
        void openExternal(href);
      }}
      onClick={(e) => e.preventDefault()}
    >
      {children}
      {hasArrow ? null : <Icon name="external" className="ext-icon" />}
      <span className="sr-only">{t('common.opensBrowser')}</span>
    </AriaLink>
  );
}

/** The numbered section plate. */
export function Plate({ id, tier }: { id: number; tier: Tier }) {
  return (
    <span className="plate" data-tier={tier}>
      {pad(id)}
    </span>
  );
}

/** The recovery stamp: four shapes, four meanings, never colour alone. */
export function Stamp({ tier }: { tier: Tier }) {
  const t = useT();
  return (
    <span className="stamp" data-tier={tier}>
      {t(`common.tiers.${tier}`)}
    </span>
  );
}

/** Luggage-tag chip: a label, not a button. */
export function TagChip({ tone, children }: { tone?: 'pro' | 'note'; children: ReactNode }) {
  return <span className={`tagchip${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

interface PanelProps {
  idx?: string;
  title: string;
  titleId: string;
  aside?: ReactNode;
  className?: string;
  inset?: boolean;
  tour?: string;
  children: ReactNode;
}

/** Panel: § index, serif title and a ledger rule running to the edge. */
export function Panel({ idx, title, titleId, aside, className, inset, tour, children }: PanelProps) {
  return (
    <section className={`panel${inset ? ' inset' : ''}${className ? ` ${className}` : ''}`} aria-labelledby={titleId} data-tour={tour}>
      <div className="panel-head">
        {idx ? <span className="idx">{idx}</span> : null}
        <h2 id={titleId}>{title}</h2>
        <span className="rule" />
        {aside ? <span className="aside">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A note pinned to the bench: empty, error and offline states. */
export function StateCard({ tone, icon, title, children, actions }: {
  tone?: 'error' | 'offline';
  icon: IconName;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={`state-card${tone ? ` ${tone}` : ''}`}>
      <Icon name={icon} />
      <h3>{title}</h3>
      <p>{children}</p>
      {actions ? <div className="row-actions">{actions}</div> : null}
    </div>
  );
}

/** Screen head: a dated ledger line, not a hero. */
export function PageHead({ id, dateline, title, lede, actions, tour }: {
  id: string;
  dateline: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
  tour?: string;
}) {
  return (
    <section className="head span-12" aria-labelledby={id} data-tour={tour}>
      <div>
        <span className="dateline">{dateline}</span>
        <h1 id={id}>{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </section>
  );
}

/**
 * A link to an app screen by path. Hidden when that screen's route is not
 * registered, so the shell never offers a dead link.
 */
export function AppLink({ to, className, children, ...rest }: { to: AppPath; className?: string; children: ReactNode } & Pick<AriaLinkProps, 'aria-label' | 'aria-current'>) {
  if (!isRegistered(to)) return null;
  return (
    <RouterLink to={to as '/'} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/** Navigate to an app screen by path (typed against the planned path set). */
export const goTo = (navigate: (opts: { to: '/' }) => unknown, to: AppPath): void => {
  void navigate({ to: to as '/' });
};

/** True while a preview or real run is live; start buttons disable (one run at a time). */
export const useRunLive = (): boolean => useRun((s) => isActive(s));

/** A dashed dry-run button that disables itself while any run is live. */
export function PreviewBtn({ isDisabled, ...props }: Omit<BtnProps, 'variant'>) {
  const live = useRunLive();
  return <Btn {...props} variant="preview" isDisabled={Boolean(isDisabled) || live} />;
}
