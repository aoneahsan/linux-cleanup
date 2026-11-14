/**
 * The single write path for every appearance axis. The pre-paint script stamps the
 * stored values on <html> before first paint; this keeps them, the store and
 * storage in step, and resolves `system` with a live macOS listener.
 */
import { create } from 'zustand';
import { load, save } from '@/lib/storage';
import { track } from '@/services/analytics';
import { AXES, AXIS_ORDER, DEFAULTS, isAxisValue, type Appearance, type Axis, type AxisValue } from '@/theme/axes';

const root = document.documentElement;
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const dataKey = (axis: Axis): string => axis.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function resolveAppearance(theme: AxisValue<'theme'>): void {
  root.dataset.appearance = theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : theme;
}

function readInitial(): Appearance {
  const out = { ...DEFAULTS } as Record<Axis, string>;
  for (const axis of AXIS_ORDER) {
    const stored = load<unknown>(axis, root.dataset[dataKey(axis)]);
    if (isAxisValue(axis, stored)) out[axis] = stored;
  }
  return out as Appearance;
}

interface AppearanceState {
  values: Appearance;
  set: <A extends Axis>(axis: A, value: AxisValue<A>, persist?: boolean) => void;
  replace: (values: Partial<Appearance>) => void;
}

/** Appearance store. `set` is the only path that writes an axis. */
export const useAppearance = create<AppearanceState>((setState, get) => ({
  values: readInitial(),
  set: (axis, value, persist = true) => {
    if (!isAxisValue(axis, value)) return;
    root.dataset[dataKey(axis)] = value;
    if (axis === 'theme') resolveAppearance(value as AxisValue<'theme'>);
    if (persist) {
      save(axis, value);
      track('settings_changed', { key: `appearance_${axis}` });
    }
    setState({ values: { ...get().values, [axis]: value } });
  },
  replace: (values) => {
    for (const axis of AXIS_ORDER) {
      const v = values[axis];
      if (v !== undefined) get().set(axis, v);
    }
  },
}));

/** Apply every axis once at boot (repairs anything the pre-paint script skipped) and follow macOS. */
export function initAppearance(): () => void {
  const { values, set } = useAppearance.getState();
  for (const axis of AXIS_ORDER) set(axis, values[axis], false);
  const onChange = () => resolveAppearance(useAppearance.getState().values.theme);
  darkQuery.addEventListener('change', onChange);
  return () => darkQuery.removeEventListener('change', onChange);
}

export { AXES };
