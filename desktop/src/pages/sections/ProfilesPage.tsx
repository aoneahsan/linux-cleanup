import { Form } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormTextField } from '@/components/form/FormTextField';
import { Btn, PageHead, Panel, PreviewBtn, RouterLink, Stamp, StateCard, TagChip } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useT, translate } from '@/i18n';
import { PROFILES, TIER, type Tier } from '@/data/sections';
import { Plates } from '@/pages/overview/OverviewPage';
import { usePlan } from '@/stores/plan';
import { startPreview } from '@/services/previewLauncher';
import { toast } from '@/lib/feedback';

const renameSchema = z.object({ name: z.string().trim().min(1).max(40) });

/** Rename a saved profile; saves on blur or Enter when the name changed. */
function RenameProfile({ id, name }: { id: string; name: string }) {
  const t = useT();
  const rename = usePlan((s) => s.renameProfile);
  const { control, handleSubmit } = useForm<{ name: string }>({ resolver: zodResolver(renameSchema), defaultValues: { name } });
  const submit = handleSubmit((v) => {
    if (v.name.trim() !== name) { rename(id, v.name.trim()); toast(translate('profilesPage.renamed')); }
  });
  return (
    <Form validationBehavior="aria" onSubmit={submit}>
      <FormTextField control={control} name="name" ariaLabel={t('profilesPage.nameLabel')} onBlur={() => void submit()} />
    </Form>
  );
}

const tiersOf = (ids: readonly number[]): Tier[] => [...new Set(ids.map((n) => TIER[n] ?? 'read'))];

/** Profiles: the five built-in bundles, profiles saved on this Mac, and their CLI lines. */
export default function ProfilesPage() {
  const t = useT();
  const saved = usePlan((s) => s.saved);
  const current = usePlan((s) => s.overviewProfile);
  const setCurrent = usePlan((s) => s.setOverviewProfile);
  const remove = usePlan((s) => s.deleteProfile);
  return (
    <div className="workbench">
      <PageHead
        id="h-prof"
        dateline={t('profilesPage.dateline', { count: saved.length })}
        title={t('profilesPage.title')}
        lede={t('profilesPage.lede')}
        actions={<RouterLink to="/sections" className="btn btn-quiet"><Icon name="plus" />{t('profilesPage.newFrom')}</RouterLink>}
      />
      <section className="span-12" aria-labelledby="h-built" data-tour={t('profilesPage.builtTour')}>
        <div className="panel-head"><span className="idx">§ 01</span><h2 id="h-built">{t('profilesPage.builtTitle')}</h2><span className="rule" /></div>
        <div className="plan-cards profile-cards">
          {PROFILES.map((p) => (
            <article className={`plan-card${p.id === current ? ' current' : ''}`} key={p.id}>
              <span className="badge">{t('profilesPage.flag', { id: p.id })}</span>
              <h3>{p.id}</h3>
              <p className="lede">{t(`sections.profiles.${p.id}`)}</p>
              <Plates ids={p.sections} />
              <div className="row-actions">{tiersOf(p.sections).map((tier) => <Stamp key={tier} tier={tier} />)}</div>
              <div className="foot">
                <PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview(p.sections, t('overview.profiles.runName', { id: p.id }), p.id)}>
                  {t('profilesPage.previewN', { count: p.sections.length })}
                </PreviewBtn>
                <Btn onPress={() => { setCurrent(p.id); toast(translate('profilesPage.used', { id: p.id })); }}>{t('profilesPage.use')}</Btn>
              </div>
            </article>
          ))}
        </div>
      </section>
      <Panel idx="§ 02" title={t('profilesPage.savedTitle')} titleId="h-saved" className="span-8" aside={<TagChip tone="pro">{t('profilesPage.proSyncs')}</TagChip>} tour={t('profilesPage.savedTour')}>
        {saved.length ? (
          <table className="ledger">
            <thead><tr><th>{t('profilesPage.colName')}</th><th>{t('profilesPage.colPlates')}</th><th className="num">{t('profilesPage.colActions')}</th></tr></thead>
            <tbody>
              {saved.map((p) => (
                <tr key={p.id}>
                  <td>
                    <RenameProfile id={p.id} name={p.name} />
                  </td>
                  <td><Plates ids={p.sections} /></td>
                  <td className="actions">
                    <PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview(p.sections, p.name)}>{t('profilesPage.preview')}</PreviewBtn>{' '}
                    <Btn onPress={() => { remove(p.id); toast(translate('profilesPage.deleted', { name: p.name })); }}>{t('profilesPage.delete')}</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <StateCard icon="stack" title={t('profilesPage.emptyTitle')} actions={<RouterLink to="/sections" className="btn btn-quiet">{t('profilesPage.openSections')}</RouterLink>}>
            {t('profilesPage.emptyBody')}
          </StateCard>
        )}
      </Panel>
      <Panel idx="§ 03" title={t('profilesPage.cliTitle')} titleId="h-cli" className="span-4" inset>
        <p className="lede">{t('profilesPage.cliLede')}</p>
        <div className="console mt-3">
          {PROFILES.map((p) => (
            <div key={p.id}><span className="dim">$</span> {t('profilesPage.cliLine', { id: p.id })}</div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
