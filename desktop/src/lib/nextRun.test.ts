import { describe, expect, it } from 'vitest';
import { nextRun } from '@/lib/nextRun';

const local = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('nextRun', () => {
  it('daily: later today, else tomorrow', () => {
    const c = { weekday: null, dayOfMonth: null, hour: 9, minute: 30 };
    expect(nextRun(c, local(2026, 10, 30, 8))).toBe(local(2026, 10, 30, 9, 30));
    expect(nextRun(c, local(2026, 10, 30, 9, 30))).toBe(local(2026, 10, 31, 9, 30));
  });
  it('weekly: the next matching weekday (Monday = 1)', () => {
    const c = { weekday: 1, dayOfMonth: null, hour: 9, minute: 0 };
    // 2026-10-30 is a Friday → Monday 2 Nov.
    expect(nextRun(c, local(2026, 10, 30, 12))).toBe(local(2026, 11, 2, 9));
  });
  it('monthly: day 1, rolling over the year end', () => {
    const c = { weekday: 3, dayOfMonth: 1, hour: 8, minute: 0 };
    expect(nextRun(c, local(2026, 12, 15))).toBe(local(2027, 1, 1, 8));
    expect(nextRun(c, local(2026, 12, 1, 7))).toBe(local(2026, 12, 1, 8));
  });
});
