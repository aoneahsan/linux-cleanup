import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { AppLink, PreviewBtn, Panel, Plate, Stamp } from '@/components/ui/primitives';
import { useT } from '@/i18n';
import { formatKb } from '@/i18n/format';
import { TIER } from '@/data/sections';
import { useDisk } from '@/hooks/useLocal';
import { useReceipts, type Finding } from '@/stores/receipts';
import { useMarks } from '@/stores/marks';
import { startPreview } from '@/services/previewLauncher';
import type { RunItem } from '@/lib/events';

const DEV = [1, 2, 3, 4, 17, 23];
const ITEM_ROWS = 4;

/** Items from the latest preview of the given sections, largest first. */
export function findingItems(findings: Record<number, Finding>, ids: readonly number[]): (RunItem & { section: number })[] {
  return ids
    .flatMap((id) => (findings[id]?.section.items ?? []).map((it) => ({ ...it, section: id })))
    .sort((a, b) => b.kb - a.kb);
}

function EmptyPreview({ text, label, ids }: { text: string; label: string; ids: readonly number[] }) {
  const t = useT();
  return (
    <div className="stack-v">
      <p className="lede">{text}</p>
      <div className="row-actions">
        <PreviewBtn tag={t('common.dryRun')} onPress={() => void startPreview(ids, label)}>
          {label}
        </PreviewBtn>
      </div>
    </div>
  );
}

function Footprint({ findings }: { findings: Record<number, Finding> }) {
  const t = useT();
  const rows = DEV.map((id) => ({ id, kb: findings[id]?.section.plannedKb ?? 0, seen: Boolean(findings[id]) }))
    .filter((r) => r.seen)
    .sort((a, b) => b.kb - a.kb);
  const max = Math.max(1, ...rows.map((r) => r.kb));
  return (
    <Panel idx={t('overview.footprint.idx')} title={t('overview.footprint.title')} titleId="h-dev" className="span-7" aside={t('overview.footprint.aside')}>
      {rows.length ? (
        <>
          <div className="bars">
            {rows.map((r) => (
              <div className="bar-row" key={r.id}>
                <Plate id={r.id} tier={TIER[r.id] ?? 'read'} />
                <span>{t(`sections.s${r.id}.title` as never)}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ ['--w' as string]: `${(r.kb / max) * 100}%` }} />
                </span>
                <span className="bar-val">{formatKb(r.kb)}</span>
              </div>
            ))}
          </div>
          <p className="lede mt-4">{t('overview.footprint.lede')}</p>
        </>
      ) : (
        <EmptyPreview text={t('overview.footprint.empty')} label={t('overview.footprint.preview')} ids={DEV} />
      )}
    </Panel>
  );
}

function Apps({ findings }: { findings: Record<number, Finding> }) {
  const t = useT();
  const items = findingItems(findings, [21, 12]).slice(0, ITEM_ROWS);
  const seen = Boolean(findings[21] || findings[12]);
  return (
    <Panel
      idx={t('overview.apps.idx')}
      title={t('overview.apps.title')}
      titleId="h-apps"
      className="span-7"
      aside={<AppLink to="/apps" className="link-arrow">{t('overview.apps.all')}</AppLink>}
    >
      {seen ? (
        <table className="ledger">
          <thead>
            <tr>
              <th>{t('overview.apps.colApp')}</th>
              <th className="num">{t('overview.apps.colData')}</th>
              <th>{t('overview.apps.colIf')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={`${it.section}:${it.path}`}>
                <td><span className="path">{it.path}</span></td>
                <td className="num">{formatKb(it.kb)}</td>
                <td><Stamp tier={TIER[it.section] ?? 'trash'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyPreview text={t('overview.apps.empty')} label={t('overview.apps.preview')} ids={[12, 21]} />
      )}
    </Panel>
  );
}

function Launch({ findings }: { findings: Record<number, Finding> }) {
  const t = useT();
  const f = findings[25];
  const unique = f ? f.section.items.filter((i) => i.unique) : [];
  return (
    <Panel
      idx={t('overview.launch.idx')}
      title={t('overview.launch.title')}
      titleId="h-launch"
      className="span-5"
      inset
      aside={<AppLink to="/services" className="link-arrow">{t('overview.launch.review')}</AppLink>}
    >
      {f ? (
        <>
          <div className="domain">
            <span className="big">{f.section.itemCount}</span> {t('overview.launch.found', { count: f.section.itemCount })}
            <ul>
              <li><span>{t('overview.launch.orphaned', { count: unique.length })}</span><b>{unique.length}</b></li>
              {unique.slice(0, 3).map((i) => (
                <li key={i.path}><span className="path">{i.path}</span><Stamp tier="permanent" /></li>
              ))}
            </ul>
          </div>
          <p className="lede mt-3">{t('overview.launch.lede')}</p>
        </>
      ) : (
        <EmptyPreview text={t('overview.launch.empty')} label={t('overview.launch.preview')} ids={[25]} />
      )}
    </Panel>
  );
}

function Orphans({ findings }: { findings: Record<number, Finding> }) {
  const t = useT();
  const marks = useMarks((s) => s.orphans);
  const mark = useMarks((s) => s.markOrphan);
  const f = findings[12];
  return (
    <Panel
      idx={t('overview.orphans.idx')}
      title={t('overview.orphans.title')}
      titleId="h-orphans"
      className="span-5"
      aside={f ? <AppLink to="/orphans" className="link-arrow">{t('overview.orphans.all', { count: f.section.itemCount })}</AppLink> : undefined}
    >
      {f ? (
        <>
          <p className="lede">{t('overview.orphans.lede')}</p>
          <ul className="orphans">
            {f.section.items.slice(0, ITEM_ROWS).map((o) => (
              <li key={o.path}>
                <span className="path">{`${o.path} · ${formatKb(o.kb)}`}</span>
                <ToggleButtonGroup
                  className="toggle-pair"
                  aria-label={t('overview.orphans.decisionFor', { path: o.path })}
                  selectedKeys={marks[o.path] ? [marks[o.path] as string] : []}
                  onSelectionChange={(keys) => mark(o.path, ([...keys][0] as 'keep' | 'review' | undefined) ?? null)}
                >
                  <ToggleButton id="keep">{t('overview.orphans.keep')}</ToggleButton>
                  <ToggleButton id="review">{t('overview.orphans.review')}</ToggleButton>
                </ToggleButtonGroup>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyPreview text={t('overview.orphans.empty')} label={t('overview.orphans.preview')} ids={[12]} />
      )}
    </Panel>
  );
}

function Snapshots({ findings }: { findings: Record<number, Finding> }) {
  const t = useT();
  const disk = useDisk();
  const items = findings[11]?.section.items ?? [];
  const count = disk.data?.snapshots ?? 0;
  return (
    <Panel
      idx={t('overview.snapshots.idx')}
      title={t('overview.snapshots.title')}
      titleId="h-snaps"
      className="span-4"
      aside={<AppLink to="/snapshots" className="link-arrow">{t('overview.snapshots.open')}</AppLink>}
    >
      <p className="lede">{count ? t('overview.snapshots.count', { count }) : t('overview.snapshots.none')}</p>
      {items.length ? (
        <ol className="timeline mt-3">
          {items.slice(0, 3).map((i) => (
            <li key={i.path}>
              <span className="when">{formatKb(i.kb)}</span>
              <br />
              <span className="path">{i.path}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {count ? <p className="callout warn mt-4">{t('overview.snapshots.warn')}</p> : null}
    </Panel>
  );
}

/** Overview review panels, each filled from the latest preview of its sections. */
export function ReviewPanels() {
  const findings = useReceipts((s) => s.findings);
  return (
    <>
      <Footprint findings={findings} />
      <Apps findings={findings} />
      <Launch findings={findings} />
      <Orphans findings={findings} />
      <Snapshots findings={findings} />
    </>
  );
}
