/**
 * The ONE appearance-axis registry. public/prepaint.js (the pre-paint script) carries the same
 * table because it runs before any module loads; `src/theme/axes.test.ts` fails
 * when the two disagree.
 */
import type { TKey } from '@/i18n';

export const AXES = {
  theme: ['system', 'light', 'dark'],
  palette: ['survey', 'coral', 'violet'],
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
  theme: 'system', palette: 'survey', radius: 'medium', density: 'comfortable', 'type-scale': 'medium',
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
  survey: ['oklch(0.968 0.010 95)', 'oklch(0.180 0.009 95)', 'oklch(0.800 0.150 95)'],
  coral: ['oklch(0.976 0.010 25)', 'oklch(0.190 0.015 25)', 'oklch(0.720 0.160 25)'],
  violet: ['oklch(0.971 0.012 305)', 'oklch(0.190 0.015 305)', 'oklch(0.780 0.100 305)'],
};

/** Physical storage key for one axis (read directly by the pre-paint script). */
export const axisStorageKey = (axis: Axis): string => axis;

/** Narrow an unknown value to a valid axis value. */
export function isAxisValue<A extends Axis>(axis: A, v: unknown): v is AxisValue<A> {
  return (AXES[axis] as readonly unknown[]).includes(v);
}
