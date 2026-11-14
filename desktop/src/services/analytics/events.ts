/**
 * The one analytics vocabulary. Adding an event means adding it here. Properties
 * are counts, flags and bounded names only — never a path, file name, email,
 * device id, item list or free text.
 */
export const EVENTS = {
  screen_view: { screen: 'string' },
  preview_started: { sections: 'number' },
  preview_finished: { sections: 'number', completed: 'number', skipped: 'number', failed: 'number', interrupted: 'boolean' },
  run_started: { sections: 'number' },
  run_finished: { sections: 'number', completed: 'number', skipped: 'number', failed: 'number', interrupted: 'boolean', cancelled: 'boolean' },
  plan_viewed: {},
  checkout_opened: { plan_id: 'string', interval: 'string' },
  sign_in: { method: 'string' },
  settings_changed: { key: 'string' },
} as const;

export type EventName = keyof typeof EVENTS;
type Kind = { string: string; number: number; boolean: boolean };
export type EventProps<E extends EventName> = { [K in keyof (typeof EVENTS)[E]]: Kind[(typeof EVENTS)[E][K] & keyof Kind] };

/** Bounded string values: identifiers and route names, never anything a user typed or a path. */
const SAFE_STRING = /^[a-z0-9_/-]{1,40}$/i;

/** Keep only registered keys with the registered type; drop any string that is not a bounded token. */
export function clean<E extends EventName>(name: E, props: Record<string, unknown>): Record<string, string | number | boolean> {
  const schema = EVENTS[name] as Record<string, keyof Kind>;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, type] of Object.entries(schema)) {
    const v = props[k];
    if (type === 'number' && typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (type === 'boolean' && typeof v === 'boolean') out[k] = v;
    else if (type === 'string' && typeof v === 'string' && SAFE_STRING.test(v) && !v.includes('@') && !v.startsWith('/Users') && !v.startsWith('~')) out[k] = v;
  }
  return out;
}

/** The gtag shim: gtag.js accepts a command only as an `arguments` object, never a spread array. */
export function makeGtag(dataLayer: unknown[]): (...args: unknown[]) => void {
  return function gtagShim() {
    // eslint-disable-next-line prefer-rest-params -- gtag/Clarity read an `arguments` object
    dataLayer.push(arguments);
  };
}
