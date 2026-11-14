/**
 * The i18n layer. English ships alone, but the mechanism is complete: a second
 * language is one new folder `locales/<code>/index.ts` exporting the same shape,
 * picked up by the glob below with no component edits. Keys are meaning-named;
 * plurals use `_one` / `_other` suffixes resolved with Intl.PluralRules.
 */
import { create } from 'zustand';
import en from '@/i18n/locales/en';

type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type StripPlural<K extends string> = K extends `${infer B}_${PluralSuffix}` ? B : K;
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${StripPlural<K>}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type DeepStrings<T> = { [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]> };

/** Every valid translation key. A missing key is a type error. */
export type TKey = Leaves<typeof en>;
/** The shape every locale catalogue must satisfy. */
export type Catalogue = DeepStrings<typeof en>;
export type TVars = Record<string, string | number>;

const modules = import.meta.glob<{ default: Catalogue }>('./locales/*/index.ts', { eager: true });
const catalogues: Record<string, Catalogue> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [path.split('/')[2] ?? 'en', mod.default]),
);

/** Locale used for dates and numbers (the project's decided English locale). */
export const FORMAT_LOCALE = 'en-US';

interface LocaleState {
  locale: string;
  setLocale: (locale: string) => void;
}

/** Current UI language. */
export const useLocale = create<LocaleState>((set) => ({
  locale: 'en',
  setLocale: (locale) => {
    if (!catalogues[locale]) return;
    document.documentElement.lang = locale === 'en' ? FORMAT_LOCALE : locale;
    set({ locale });
  },
}));

/** Locales that have a catalogue. */
export const availableLocales = (): string[] => Object.keys(catalogues);

function lookup(cat: unknown, path: string): string | undefined {
  let node: unknown = cat;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

const plural = new Map<string, Intl.PluralRules>();

/** Translate a key with interpolation (`{{name}}`) and `count` plurals. */
export function translate(key: TKey, vars?: TVars, locale = useLocale.getState().locale): string {
  const cat = catalogues[locale] ?? en;
  let text: string | undefined;
  if (vars && typeof vars.count === 'number') {
    let rules = plural.get(locale);
    if (!rules) {
      rules = new Intl.PluralRules(locale === 'en' ? FORMAT_LOCALE : locale);
      plural.set(locale, rules);
    }
    text = lookup(cat, `${key}_${rules.select(vars.count)}`) ?? lookup(cat, `${key}_other`);
  }
  text ??= lookup(cat, key) ?? lookup(en, key) ?? key;
  if (!vars) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** Non-React access (stores, services). */
export const t = translate;

/** React hook: re-renders when the language changes. */
export function useT(): typeof translate {
  const locale = useLocale((s) => s.locale);
  return (key, vars) => translate(key, vars, locale);
}
