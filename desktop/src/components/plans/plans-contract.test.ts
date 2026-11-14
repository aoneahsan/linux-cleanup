import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en';

const CONSENT = 'By continuing, you agree to our Terms of Service and Privacy Policy.';
/** Refund and discouraging wording banned on every product surface (payment-copy law). */
const BANNED = /\brefund|money[- ]back|non-refundable|before you pay|are you sure|cannot get (this|it) back|no refunds?\b/i;

function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

describe('plans contract (D-NO-REFUND-IN-APP)', () => {
  it('no catalogue string carries refund or discouraging payment wording', () => {
    const hits = strings(en).filter(([, v]) => BANNED.test(v)).map(([k]) => k);
    expect(hits).toEqual([]);
  });

  it('the consent line reads exactly the one approved sentence', () => {
    const p = en.account.plans;
    expect(`${p.consentLead}${p.consentTerms}${p.consentAnd}${p.consentPrivacy}${p.consentEnd}`).toBe(CONSENT);
  });

  it('every pay button on a pay surface is followed by the consent line', () => {
    const src = readFileSync(new URL('../../pages/account/PlansPage.tsx', import.meta.url), 'utf8');
    const pay = src.match(/t\('account\.plans\.choose'/g)?.length ?? 0;
    const consent = src.match(/<ConsentLine \/>/g)?.length ?? 0;
    expect(pay).toBeGreaterThan(0);
    expect(consent).toBe(pay);
    const after = src.slice(src.indexOf("t('account.plans.choose'"));
    expect(after.indexOf('<ConsentLine />')).toBeGreaterThan(0);
    expect(after.indexOf('<ConsentLine />')).toBeLessThan(200);
  });
});
