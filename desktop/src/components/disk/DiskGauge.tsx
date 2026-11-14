import { useState } from 'react';
import { ToggleButton } from 'react-aria-components';
import { scaleLinear } from 'd3-scale';
import { useT } from '@/i18n';
import { formatGiB } from '@/i18n/format';
import type { DiskStatus } from '@/lib/tauri';

type Key = 'used' | 'purge' | 'free';

interface Segment {
  k: Key;
  kb: number;
  label: string;
  detail: string;
}

/** Split a disk reading into the gauge's segments (snapshot-held bytes are not reported separately). */
export function useSegments(disk: Pick<DiskStatus, 'total_kb' | 'free_kb' | 'purgeable_kb'>): Segment[] {
  const t = useT();
  const purge = disk.purgeable_kb ?? 0;
  const used = Math.max(0, disk.total_kb - disk.free_kb - purge);
  return [
    { k: 'used', kb: used, label: t('overview.disk.used'), detail: t('overview.disk.usedDetail') },
    { k: 'purge', kb: purge, label: t('overview.disk.purge'), detail: t('overview.disk.purgeDetail') },
    { k: 'free', kb: disk.free_kb, label: t('overview.disk.free'), detail: t('overview.disk.freeDetail') },
  ].filter((s) => s.kb > 0) as Segment[];
}

/** The segmented APFS gauge: bar, scale, detail line and legend. Bands are toggle buttons that explain themselves. */
export function DiskGauge({ disk }: { disk: DiskStatus }) {
  const t = useT();
  const segments = useSegments(disk);
  const [active, setActive] = useState<Key | null>(null);
  const [hover, setHover] = useState<Key | null>(null);
  const shown = segments.find((s) => s.k === (hover ?? active));
  const scale = scaleLinear().domain([0, disk.total_kb]).range([0, 1]);
  const ticks = [0, disk.total_kb / 2, disk.total_kb];
  return (
    <>
      <div className="gauge-bar" role="group" aria-label={t('overview.disk.groupLabel')}>
        {segments.map((s) => (
          <ToggleButton
            key={s.k}
            className="seg"
            data-k={s.k}
            style={{ flex: scale(s.kb) }}
            isSelected={active === s.k}
            onChange={(on) => setActive(on ? s.k : null)}
            onHoverStart={() => setHover(s.k)}
            onHoverEnd={() => setHover(null)}
            onFocus={() => setHover(s.k)}
            onBlur={() => setHover(null)}
            aria-label={t('overview.disk.segLabel', { label: s.label, size: formatGiB(s.kb) })}
          />
        ))}
      </div>
      <div className="gauge-scale" aria-hidden="true">
        {ticks.map((kb) => (
          <span key={kb}>{kb === 0 ? '0' : formatGiB(kb)}</span>
        ))}
      </div>
      <p className="gauge-detail" aria-live="polite">
        {shown ? t('overview.disk.segDetail', { label: shown.label, size: formatGiB(shown.kb), detail: shown.detail }) : t('overview.disk.pointAt')}
      </p>
      <div className="gauge-legend">
        {segments.map((s) => (
          <div className="legend-item" data-k={s.k} key={s.k}>
            <b>{formatGiB(s.kb)}</b>
            {s.label}
          </div>
        ))}
      </div>
    </>
  );
}

/** Static before/after bar for receipts (no interaction). */
export function StaticBar({ totalKb, freeKb }: { totalKb: number; freeKb: number }) {
  const scale = scaleLinear().domain([0, totalKb]).range([0, 1]);
  return (
    <div className="gauge-bar ba-bar" aria-hidden="true">
      <span className="seg" data-k="used" style={{ flex: scale(Math.max(0, totalKb - freeKb)) }} />
      <span className="seg" data-k="free" style={{ flex: scale(freeKb) }} />
    </div>
  );
}
