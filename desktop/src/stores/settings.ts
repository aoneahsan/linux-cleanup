/**
 * App settings and rebindable shortcuts, stored through strata-storage. Every
 * binding is unique across the active set; a clash is refused by `bind` with the
 * owner's id so the UI can name it and deep-link to it.
 */
import { create } from 'zustand';
import { load, save } from '@/lib/storage';
import { track } from '@/services/analytics';

export interface Settings {
  /** null = the CLI's own default (and ~/.macleanuprc) applies. */
  ageDays: number | null;
  largeFileGb: number | null;
  units: 'GiB' | 'GB';
  scanRoots: string[];
  excludes: string[];
  notify: boolean;
  updatesAuto: boolean;
  syncHistory: boolean;
  closeToMenuBar: boolean;
  /** Email me when a scheduled run finishes (off by default). */
  emailOnSchedule: boolean;
  /** Pro: back up each real run's receipt summary when the run finishes (off by default). */
  autoBackup: boolean;
  inviteCode: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  ageDays: null, largeFileGb: null, units: 'GiB', scanRoots: [], excludes: [],
  notify: true, updatesAuto: true, syncHistory: true, closeToMenuBar: false, emailOnSchedule: false, autoBackup: false, inviteCode: null,
};

/** What the rulers show while the CLI default applies. */
export const CLI_DEFAULTS = { ageDays: 100, largeFileGb: 1 } as const;

export type ShortcutId = 'search' | 'preview' | 'appearance' | 'sections' | 'history' | 'cancel';
export type ShortcutGroup = 'everywhere' | 'navigation' | 'run';

/** Defaults ship clash-free. */
export const SHORTCUTS: readonly { id: ShortcutId; group: ShortcutGroup; keys: string }[] = [
  { id: 'search', group: 'everywhere', keys: '⌘K' },
  { id: 'preview', group: 'everywhere', keys: '⌘P' },
  { id: 'appearance', group: 'everywhere', keys: '⌥⌘A' },
  { id: 'sections', group: 'navigation', keys: '⌘2' },
  { id: 'history', group: 'navigation', keys: '⌘3' },
  { id: 'cancel', group: 'run', keys: '⌘.' },
];

/**
 * Accelerators owned by the native macOS menu (menu.rs) and the system. They are
 * part of the same namespace, so a binding can never take one of them.
 */
export const RESERVED: Readonly<Record<string, 'settings' | 'newPreview' | 'history' | 'quit' | 'close' | 'hide' | 'minimize'>> = {
  '⌘,': 'settings', '⌘N': 'newPreview', '⌘Y': 'history', '⌘Q': 'quit', '⌘W': 'close', '⌘H': 'hide', '⌘M': 'minimize',
};
export type BindResult = null | { kind: 'shortcut'; owner: ShortcutId } | { kind: 'menu'; item: (typeof RESERVED)[string] };

const DEFAULT_BINDINGS = Object.fromEntries(SHORTCUTS.map((s) => [s.id, s.keys])) as Record<ShortcutId, string>;

/** "⌃⌥⇧⌘K" from a key event, or null when no modifier other than Shift is held. */
export function comboFrom(e: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'key' | 'code'>): string | null {
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return null;
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null;
  const key = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^Digit\d$/.test(e.code) ? e.code.slice(5) : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return `${e.ctrlKey ? '⌃' : ''}${e.altKey ? '⌥' : ''}${e.shiftKey ? '⇧' : ''}${e.metaKey ? '⌘' : ''}${key}`;
}

interface SettingsState {
  settings: Settings;
  bindings: Record<ShortcutId, string>;
  update: (patch: Partial<Settings>) => void;
  /** Bind a combo, or return what already owns it (nothing changes). */
  bind: (id: ShortcutId, combo: string) => BindResult;
  resetBindings: () => void;
  replaceBindings: (b: Partial<Record<ShortcutId, string>>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('settings', {}) },
  // A stored binding that a reserved menu accelerator now owns falls back to its default.
  bindings: Object.fromEntries(Object.entries({ ...DEFAULT_BINDINGS, ...load<Partial<Record<ShortcutId, string>>>('shortcuts', {}) }).map(([k, v]) => [k, RESERVED[v as string] ? DEFAULT_BINDINGS[k as ShortcutId] : v])) as Record<ShortcutId, string>,
  update: (patch) => {
    const settings = { ...get().settings, ...patch };
    save('settings', settings);
    set({ settings });
    // Key names only, never values (a folder path is a value).
    for (const key of Object.keys(patch)) track('settings_changed', { key });
  },
  bind: (id, combo) => {
    const item = RESERVED[combo];
    if (item) return { kind: 'menu', item };
    const owner = (Object.entries(get().bindings) as [ShortcutId, string][]).find(([k, v]) => v === combo && k !== id);
    if (owner) return { kind: 'shortcut', owner: owner[0] };
    const bindings = { ...get().bindings, [id]: combo };
    save('shortcuts', bindings);
    set({ bindings });
    track('settings_changed', { key: `shortcut_${id}` });
    return null;
  },
  resetBindings: () => {
    save('shortcuts', DEFAULT_BINDINGS);
    set({ bindings: { ...DEFAULT_BINDINGS } });
  },
  replaceBindings: (b) => {
    // Synced bindings are applied as a set, then checked: a duplicate keeps the local value.
    const next = { ...get().bindings };
    for (const [id, combo] of Object.entries(b) as [ShortcutId, string][]) if (combo && id in next && !RESERVED[combo]) next[id] = combo;
    const seen = new Set<string>();
    for (const id of Object.keys(next) as ShortcutId[]) {
      if (seen.has(next[id])) next[id] = get().bindings[id];
      seen.add(next[id]);
    }
    if (new Set(Object.values(next)).size !== Object.keys(next).length) return;
    save('shortcuts', next);
    set({ bindings: next });
  },
}));
