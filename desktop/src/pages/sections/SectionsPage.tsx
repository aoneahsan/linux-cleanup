import { Checkbox, CheckboxGroup, Input, Label, SearchField, Tab, TabList, TabPanel, Tabs, ToggleButton } from 'react-aria-components';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Btn, PreviewBtn, PageHead, Plate, Stamp } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { plate } from '@/i18n/format';
import { DEEP_CONFIRM, SAFE_BATCH, SECTION_IDS, SHELVES, SUDO, TIER, type ShelfId, type Tier } from '@/data/sections';
import { usePlan } from '@/stores/plan';
import { startPreview } from '@/services/previewLauncher';
import { Plates } from '@/pages/overview/OverviewPage';
import { toast } from '@/lib/feedback';
import { translate } from '@/i18n';

const TIERS: Tier[] = ['routine', 'trash', 'permanent', 'read'];
type ShelfKey = ShelfId | 'all';

function Detail({ id }: { id: number }) {
  const t = useT();
  const selection = usePlan((s) => s.selection);
  const toggle = usePlan((s) => s.toggle);
  const tier = TIER[id] ?? 'read';
  return (
    <aside className="panel inset span-4" aria-labelledby="h-detail" data-tour={t('sectionsPage.detailTour')}>
      <div className="panel-head">
        <span className="idx">{t('sectionsPage.detailIdx', { id: plate(id) })}</span>
        <h2 id="h-detail">{t('sectionsPage.detailTitle')}</h2>
        <span className="rule" />
      </div>
      <div className="stack-v">
        <div className="row-actions">
          <Plate id={id} tier={tier} /> <Stamp tier={tier} />
          {DEEP_CONFIRM.includes(id) ? <span className="badge bad">{t('sectionsPage.typedConfirm')}</span> : null}
          {SUDO.includes(id) ? <span className="badge warn">{t('sectionsPage.password')}</span> : null}
        </div>
        <h3 className="detail-title">{t(`sections.s${id}.title` as never)}</h3>
        <p className="lede">{t(`sections.s${id}.what` as never)}</p>
        <dl className="kv">
          <dt>{t('sectionsPage.getBack')}</dt>
          <dd>{t(`sectionsPage.getBackBy.${tier}`)}</dd>
          <dt>{t('sectionsPage.previewLabel')}</dt>
          <dd>{t('sectionsPage.previewCmd', { id })}</dd>
          <dt>{t('sectionsPage.runLabel')}</dt>
          <dd>{t('sectionsPage.runCmd', { id })}</dd>
        </dl>
        <div className="row-actions">
          <PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview([id], t('sectionsPage.sectionName', { id }))}>
            {t('sectionsPage.previewOne', { id: plate(id) })}
          </PreviewBtn>
          <Btn onPress={() => toggle(id)}>{selection.includes(id) ? t('sectionsPage.remove') : t('sectionsPage.add')}</Btn>
        </div>
      </div>
    </aside>
  );
}

/** Sections: 28 plates on five shelves, URL-held filters, multi-select into a plan. */
export default function SectionsPage() {
  const t = useT();
  const search = useSearch({ from: '/sections' });
  const navigate = useNavigate({ from: '/sections' });
  const selection = usePlan((s) => s.selection);
  const setSelection = usePlan((s) => s.setSelection);
  const saved = usePlan((s) => s.saved);
  const saveProfile = usePlan((s) => s.saveProfile);
  const shelf: ShelfKey = search.shelf ?? 'all';
  const off = new Set((search.off ?? '').split(',').filter(Boolean));
  const q = (search.q ?? '').trim().toLowerCase();
  const focus = search.s ?? selection[0] ?? 3;
  const allowed = shelf === 'all' ? null : SHELVES.find((x) => x.id === shelf)?.sections ?? null;

  const visible = SECTION_IDS.filter((n) => {
    const tier = TIER[n] ?? 'read';
    const title = t(`sections.s${n}.title` as never).toLowerCase();
    return (!allowed || allowed.includes(n)) && !off.has(tier) && (!q || plate(n).includes(q) || title.includes(q) || t(`common.tiers.${tier}`).toLowerCase().includes(q));
  });

  const setSearch = (patch: Partial<typeof search>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const toggleTier = (tier: Tier) => {
    const next = new Set(off);
    if (next.has(tier)) next.delete(tier);
    else next.add(tier);
    setSearch({ off: next.size ? [...next].join(',') : undefined });
  };

  const hasPermanent = selection.some((n) => DEEP_CONFIRM.includes(n));
  const shelves: { id: ShelfKey; count: number }[] = [{ id: 'all', count: 28 }, ...SHELVES.map((s) => ({ id: s.id as ShelfKey, count: s.sections.length }))];

  const grid = (
    <>
      <CheckboxGroup
        className="plate-grid"
        aria-label={t('sectionsPage.gridLabel')}
        value={selection.map(String)}
        onChange={(v) => setSelection(v.map(Number))}
      >
        {visible.map((n) => {
          const tier = TIER[n] ?? 'read';
          const what = t(`sections.s${n}.what` as never);
          return (
            <Checkbox key={n} value={String(n)} className="plate-card" data-tier={tier} onFocus={() => setSearch({ s: n })}>
              <Plate id={n} tier={tier} />
              <span>
                <b>{t(`sections.s${n}.title` as never)}</b>
                <span className="why">{`${what.split('. ')[0] ?? what}${what.includes('. ') ? '.' : ''}`}</span>
              </span>
              <span className="punch" aria-hidden="true" />
              <Stamp tier={tier} />
            </Checkbox>
          );
        })}
      </CheckboxGroup>
      {visible.length === 0 ? <p className="lede mt-4">{t('sectionsPage.noMatch')}</p> : null}
    </>
  );

  return (
    <div className="workbench">
      <PageHead
        id="h-sections"
        dateline={t('sectionsPage.dateline')}
        title={t('sectionsPage.title')}
        lede={t('sectionsPage.lede')}
        actions={
          <>
            <Btn onPress={() => { setSelection([...SAFE_BATCH]); toast(translate('sectionsPage.safePicked')); }}>{t('sectionsPage.pickSafe')}</Btn>
            <Btn onPress={() => setSelection([])}>{t('sectionsPage.clear')}</Btn>
          </>
        }
      />
      <Tabs className="span-12 section-tabs" selectedKey={shelf} onSelectionChange={(k) => setSearch({ shelf: k === 'all' ? undefined : (k as ShelfId) })}>
        <section aria-label={t('sectionsPage.filters')} data-tour={t('sectionsPage.filtersTour')}>
          <TabList className="tabs" aria-label={t('sectionsPage.shelves')}>
            {shelves.map((s) => (
              <Tab key={s.id} id={s.id}>
                {s.id === 'all' ? t('sectionsPage.all') : t(`sections.shelves.${s.id}`)}
                <span className="count">{s.count}</span>
              </Tab>
            ))}
          </TabList>
          <div className="filter-bar">
            <span className="field-inline">{t('sectionsPage.stamps')}</span>
            {TIERS.map((tier) => (
              <ToggleButton key={tier} className="stamp" data-tier={tier} isSelected={!off.has(tier)} onChange={() => toggleTier(tier)}>
                {t(`common.tiers.${tier}`)}
              </ToggleButton>
            ))}
            <span className="spacer" />
            <SearchField className="field" value={search.q ?? ''} onChange={(v) => setSearch({ q: v || undefined })}>
              <Label className="sr-only">{t('sectionsPage.find')}</Label>
              <Input className="input" placeholder={t('sectionsPage.findPlaceholder')} />
            </SearchField>
          </div>
        </section>
        <div className="workbench-inner">
          {shelves.map((s) => (
            <TabPanel key={s.id} id={s.id} className="span-8" aria-label={t('sectionsPage.grid')} data-tour={t('sectionsPage.gridTour')}>
              {grid}
            </TabPanel>
          ))}
          <Detail id={focus} />
        </div>
      </Tabs>
      <div className="tray span-12" data-tour={t('sectionsPage.trayTour')}>
        <span className="count">{t('sectionsPage.selected', { count: selection.length })}</span>
        <Plates ids={selection} />
        <span className="muted">
          {!selection.length ? t('sectionsPage.pickOne') : hasPermanent ? t('sectionsPage.hasPermanent') : t('sectionsPage.noTyped')}
        </span>
        <PreviewBtn tag={t('common.dryRun')} isDisabled={!selection.length} onPress={() => void startPreview(selection, t('sectionsPage.customName'))}>
          {t('sectionsPage.previewSelection')}
        </PreviewBtn>
        <Btn
          isDisabled={!selection.length}
          onPress={() => {
            const name = translate('sectionsPage.savedName', { n: saved.length + 1 });
            saveProfile(name, selection);
            toast(translate('sectionsPage.saved', { name }));
          }}
        >
          {t('sectionsPage.saveProfile')}
        </Btn>
      </div>
    </div>
  );
}
