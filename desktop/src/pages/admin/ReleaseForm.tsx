import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from 'react-aria-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Btn } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { FormTextField } from '@/components/form/FormTextField';
import { FormNoteField } from '@/components/form/FormNoteField';
import { FormCardRadio } from '@/components/form/FormFields';
import { useT, translate } from '@/i18n';
import { env } from '@/config/env';
import { compareSemver } from '@/lib/releaseGate';
import { isPublishableVersion, publishRelease, type AdminRelease, type ReleaseChannel, type ReleasePlatform } from '@/services/releases';
import { toast } from '@/lib/feedback';

const REASON_MAX = 280;

const schema = z.object({
  platform: z.enum(['desktop', 'web', 'docs']),
  channel: z.enum(['test', 'production']),
  version: z.string().refine(isPublishableVersion, { error: () => translate('releases.admin.versionError') }),
  severity: z.enum(['normal', 'urgent']),
  reason: z.string().trim().min(1, { error: () => translate('releases.admin.reasonMissing') }).max(REASON_MAX, { error: () => translate('releases.admin.reasonTooLong') }),
  min: z.string().refine((v) => v.trim() === '' || isPublishableVersion(v), { error: () => translate('releases.admin.minError') }),
});
type Values = z.infer<typeof schema>;

const DEFAULTS: Values = { platform: 'desktop', channel: 'test', version: '', severity: 'normal', reason: '', min: '' };

/** The newest published version on a platform + channel, from the list the page already read. */
const previousOf = (list: readonly AdminRelease[], platform: ReleasePlatform, channel: ReleaseChannel) =>
  list.find((r) => r.platform === platform && r.channel === channel)?.version ?? null;

/** Publish a release: card selectors, version, reason with a /280 counter, optional minimum build, a confirm step. */
export function ReleaseForm({ list }: { list: readonly AdminRelease[] }) {
  const t = useT();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<Values | null>(null);
  const { control, handleSubmit, reset } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const [platform, channel, version] = useWatch({ control, name: ['platform', 'channel', 'version'] });

  const publish = useMutation({
    mutationFn: (v: Values) => publishRelease({
      platform: v.platform, channel: v.channel, version: v.version, severity: v.severity, reason: v.reason,
      ...(v.min.trim() ? { minNativeVersion: v.min } : {}),
    }),
    onSuccess: ({ release, previous_version }) => {
      const notNewer = previous_version !== null && compareSemver(release.version, previous_version) !== 1;
      toast(notNewer
        ? translate('releases.admin.publishedAfter', { version: release.version, previous: previous_version })
        : translate('releases.admin.published', { version: release.version, channel: translate(`releases.channel.${release.channel}`) }));
      setConfirm(null);
      reset(DEFAULTS);
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast(translate('releases.admin.failed', { message: e instanceof Error ? e.message : String(e) })),
  });

  // The non-blocking warning: the version is not above what this channel (or this build) already has.
  const v = version.trim();
  const previous = previousOf(list, platform, channel);
  const warn = !isPublishableVersion(v) ? null
    : previous && compareSemver(v, previous) !== 1 ? t('releases.admin.notNewerPrevious', { previous, version: v })
      : platform === 'desktop' && compareSemver(v, env.appVersion) !== 1 ? t('releases.admin.notNewer', { running: env.appVersion }) : null;

  const card = (value: string, label: string, sub: string) => ({ value, label, sub });

  return (
    <Form className="form-grid" validationBehavior="aria" onSubmit={handleSubmit((values) => {
      setConfirm(values);
      window.requestAnimationFrame(() => document.getElementById('rel-publish')?.focus());
    })}>
      <FormCardRadio control={control} name="platform" label={t('releases.admin.platform')} help={t('releases.admin.platformHelp')} options={[
        card('desktop', t('releases.admin.platformDesktop'), t('releases.admin.platformDesktopSub')),
        card('web', t('releases.admin.platformWeb'), t('releases.admin.platformWebSub')),
        card('docs', t('releases.admin.platformDocs'), t('releases.admin.platformDocsSub')),
      ]} />
      <FormCardRadio control={control} name="channel" label={t('releases.admin.channel')} options={[
        card('test', t('releases.admin.channelTest'), t('releases.admin.channelTestSub')),
        card('production', t('releases.admin.channelProduction'), t('releases.admin.channelProductionSub')),
      ]} />
      <FormTextField control={control} name="version" label={t('releases.admin.version')} help={t('releases.admin.versionHelp')} placeholder={t('releases.admin.versionPlaceholder')} mono autoComplete="off" />
      <FormCardRadio control={control} name="severity" label={t('releases.admin.severity')} options={[
        card('normal', t('releases.admin.normal'), t('releases.admin.normalSub')),
        card('urgent', t('releases.admin.urgent'), t('releases.admin.urgentSub')),
      ]} />
      <FormNoteField control={control} name="reason" label={t('releases.admin.reason')} help={t('releases.admin.reasonHelp')} placeholder={t('releases.admin.reasonPlaceholder')} max={REASON_MAX} />
      <FormTextField control={control} name="min" label={t('releases.admin.minLabel')} help={t('releases.admin.minHelp')} placeholder={t('releases.admin.versionPlaceholder')} mono autoComplete="off" className="field full" />
      {warn ? <div className="banner warn full" role="status"><Icon name="alert" /><span>{warn}</span></div> : null}
      {confirm ? (
        <div className="callout full stack-v" role="group" aria-labelledby="rel-confirm-text">
          <b id="rel-confirm-text">{t('releases.admin.confirmTitle', { version: confirm.version.trim(), channel: t(`releases.channel.${confirm.channel}`), severity: t(`releases.severity.${confirm.severity}`) })}</b>
          <p>{confirm.severity === 'urgent' ? t('releases.admin.confirmUrgent') : t('releases.admin.confirmNormal')}</p>
          <p>{t('releases.admin.confirmNever')}</p>
          <div className="row-actions">
            <Btn id="rel-publish" variant="run" tag={t('releases.admin.publishTag')} isDisabled={publish.isPending} onPress={() => publish.mutate(confirm)}>{t('releases.admin.publish')}</Btn>
            <Btn isDisabled={publish.isPending} onPress={() => setConfirm(null)}>{t('releases.admin.back')}</Btn>
          </div>
        </div>
      ) : (
        <div className="row-actions full">
          <Btn type="submit" variant="run" tag={t('releases.admin.publishTag')}>{t('releases.admin.review')}</Btn>
        </div>
      )}
    </Form>
  );
}
