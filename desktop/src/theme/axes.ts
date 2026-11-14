/**
 * The ONE appearance-axis registry. public/prepaint.js (the pre-paint script) carries the same
 * table because it runs before any module loads; `src/theme/axes.test.ts` fails
 * when the two disagree.
 */
import type { TKey } from '@/i18n';

export const AXES = {
  theme: ['system', 'light', 'dark'],
  palette: ['jade', 'cobalt', 'brass'],
  radius: ['none', 'small', 'medium', 'large'],
  density: ['compact', 'comfortable', 'spacious'],
  'type-scale': ['small', 'medium', 'large'],
  motion: ['system', 'full', 'reduced'],
  sound: ['off', 'on'],
} as const;

export type Axis = keyof typeof AXES;
export type AxisValue<A extends Axis> = (typeof AXES)[A][number];
export type Appearance = { [A in Axis]: AxisValue<A> };

/** Defaults: the approved dummy's <html> attributes (sound starts off). */
export const DEFAULTS: Appearance = {
  theme: 'system', palette: 'jade', radius: 'medium', density: 'comfortable', 'type-scale': 'medium',
  motion: 'system', sound: 'off',
};

export const AXIS_ORDER = Object.keys(AXES) as Axis[];

const LEGEND_NS: Record<Axis, string> = {
  theme: 'theme', palette: 'palette', radius: 'radius', density: 'density', 'type-scale': 'typeScale',
  motion: 'motion', sound: 'sound',
};

/** Catalogue key for an axis legend. */
export const legendKey = (axis: Axis): TKey => `theme.axes.${LEGEND_NS[axis]}.legend` as TKey;
/** Catalogue key for one axis value. */
export const valueKey = (axis: Axis, value: string): TKey => `theme.axes.${LEGEND_NS[axis]}.${value}` as TKey;

/** Surface / ink / accent triad each palette card previews (light values). */
export const SWATCH: Record<AxisValue<'palette'>, [string, string, string]> = {
  jade: ['oklch(0.974 0.010 104)', 'oklch(0.231 0.032 169)', 'oklch(0.425 0.102 169)'],
  cobalt: ['oklch(0.972 0.008 260)', 'oklch(0.235 0.039 260)', 'oklch(0.431 0.157 260)'],
  brass: ['oklch(0.974 0.018 80)', 'oklch(0.246 0.033 65)', 'oklch(0.428 0.120 70)'],
};

/** Physical storage key for one axis (read directly by the pre-paint script). */
export const axisStorageKey = (axis: Axis): string => axis;

/** Narrow an unknown value to a valid axis value. */
export function isAxisValue<A extends Axis>(axis: A, v: unknown): v is AxisValue<A> {
  return (AXES[axis] as readonly unknown[]).includes(v);
}
