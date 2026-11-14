import { ExternalLink, StateCard } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { env } from '@/config/env';

/** Shown in a plain browser: no fake data, a named next step. */
export function NotInApp() {
  const t = useT();
  return (
    <StateCard
      tone="offline"
      icon="terminal"
      title={t('states.notInApp.title')}
      actions={
        <ExternalLink href={`${env.websiteUrl}/download`} className="btn btn-quiet">
          {t('states.notInApp.action')}
        </ExternalLink>
      }
    >
      {t('states.notInApp.body')}
    </StateCard>
  );
}

/** Account features without Supabase env: names the missing variables. */
export function AccountsOff({ vars }: { vars: string[] }) {
  const t = useT();
  return (
    <StateCard tone="offline" icon="person" title={t('states.accountsOff.title')}>
      {t('states.accountsOff.body', { vars: vars.join(', ') })}
    </StateCard>
  );
}
