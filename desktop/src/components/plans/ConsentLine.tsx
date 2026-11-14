import { ExternalLink } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { env } from '@/config/env';

/** The ONE payment-terms line every pay surface carries, directly under its button. */
export function ConsentLine() {
  const t = useT();
  return (
    <p className="consent" data-consent-line>
      {t('account.plans.consentLead')}
      <ExternalLink href={`${env.websiteUrl}/terms`}>{t('account.plans.consentTerms')}</ExternalLink>
      {t('account.plans.consentAnd')}
      <ExternalLink href={`${env.websiteUrl}/privacy`}>{t('account.plans.consentPrivacy')}</ExternalLink>
      {t('account.plans.consentEnd')}
    </p>
  );
}
