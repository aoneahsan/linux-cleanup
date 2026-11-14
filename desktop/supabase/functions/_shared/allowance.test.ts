import { describe, expect, it } from 'vitest';
import { type AllowanceFacts, choosePool, monthKey, resetsAt, toAllowance } from './allowance.ts';

/** Facts for a signed-out device on Free with the seeded defaults (15 + 15). */
function facts(overrides: Partial<AllowanceFacts> = {}): AllowanceFacts {
  return {
    month: '2026-10',
    is_anonymous: true,
    plan: { id: 'free', name: 'Free', unlimited: false },
    device: { used: 0, limit: 15 },
    account: null,
    ...overrides,
  };
}

describe('month boundary (UTC)', () => {
  it('keys an instant by its UTC month, not the local one', () => {
    expect(monthKey(new Date('2026-10-31T23:59:59.999Z'))).toBe('2026-10');
    expect(monthKey(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11');
    // 23:30 on 31 Oct in UTC-5 is already November in UTC.
    expect(monthKey(new Date('2026-10-31T23:30:00-05:00'))).toBe('2026-11');
  });

  it('resets at the first instant of the next UTC month, across the year end', () => {
    expect(resetsAt('2026-10')).toBe('2026-11-01T00:00:00.000Z');
    expect(resetsAt('2026-12')).toBe('2027-01-01T00:00:00.000Z');
    expect(resetsAt('2028-02')).toBe('2028-03-01T00:00:00.000Z');
  });

  it('refuses a malformed month key', () => {
    expect(() => resetsAt('2026-13')).toThrow(RangeError);
    expect(() => resetsAt('2026-1')).toThrow(RangeError);
  });
});

describe('pool order', () => {
  it('uses the device pool first while it has runs', () => {
    expect(choosePool(facts({ device: { used: 14, limit: 15 } }))).toBe('device');
  });

  it('falls to the account pool only for a signed-in account', () => {
    const spentDevice = { device: { used: 15, limit: 15 }, account: { used: 0, limit: 15 } };
    expect(choosePool(facts({ ...spentDevice, is_anonymous: false }))).toBe('account');
    expect(choosePool(facts({ ...spentDevice, is_anonymous: true }))).toBeNull();
  });

  it('an unlimited plan takes the plan pool even with both pools spent', () => {
    const plan = { id: 'pro', name: 'Pro', unlimited: true };
    expect(choosePool(facts({ plan, device: { used: 99, limit: 15 }, is_anonymous: false }))).toBe('plan');
  });
});

describe('limit reached', () => {
  it('returns null when the device and account pools are both spent', () => {
    expect(choosePool(facts({
      is_anonymous: false, device: { used: 15, limit: 15 }, account: { used: 15, limit: 15 },
    }))).toBeNull();
  });

  it('treats usage above a lowered limit as spent, never as negative runs', () => {
    expect(choosePool(facts({ device: { used: 20, limit: 15 } }))).toBeNull();
  });

  it('a limit of 0 (admin switched the pool off) is spent from the start', () => {
    expect(choosePool(facts({ device: { used: 0, limit: 0 } }))).toBeNull();
  });
});

describe('contract shape', () => {
  it('hides the account pool from an anonymous device and adds resets_at', () => {
    const shaped = toAllowance(facts({ account: { used: 1, limit: 15 } }));
    expect(shaped.account).toBeNull();
    expect(shaped.resets_at).toBe('2026-11-01T00:00:00.000Z');
    expect(toAllowance(facts({ is_anonymous: false, account: { used: 1, limit: 15 } })).account)
      .toEqual({ used: 1, limit: 15 });
  });
});
