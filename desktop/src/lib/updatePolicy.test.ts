import { describe, expect, it } from 'vitest';
import { decide } from '@/lib/releaseGate';
import { isQuietMoment, mayRecheck, nextStartCount, QUIET_HIDDEN_MS, QUIET_IDLE_MS, readStoredNotice } from '@/lib/updatePolicy';

const NOW = 1_800_000_000_000;

describe('isQuietMoment', () => {
  it('never while a run is live, however long the window was away', () => {
    expect(isQuietMoment({ runLive: true, hiddenSince: NOW - QUIET_HIDDEN_MS * 10, lastActivity: NOW - QUIET_IDLE_MS * 10, now: NOW })).toBe(false);
  });
  it('hidden or unfocused for 2 minutes is quiet; 1:59 is not', () => {
    expect(isQuietMoment({ runLive: false, hiddenSince: NOW - QUIET_HIDDEN_MS, lastActivity: NOW, now: NOW })).toBe(true);
    expect(isQuietMoment({ runLive: false, hiddenSince: NOW - QUIET_HIDDEN_MS + 1000, lastActivity: NOW, now: NOW })).toBe(false);
  });
  it('in front but idle for 10 minutes is quiet; 9:59 is not', () => {
    expect(isQuietMoment({ runLive: false, hiddenSince: null, lastActivity: NOW - QUIET_IDLE_MS, now: NOW })).toBe(true);
    expect(isQuietMoment({ runLive: false, hiddenSince: null, lastActivity: NOW - QUIET_IDLE_MS + 1000, now: NOW })).toBe(false);
  });
});

describe('mayRecheck', () => {
  it('allows the first check, then at most one a minute', () => {
    expect(mayRecheck(null, NOW)).toBe(true);
    expect(mayRecheck(NOW - 59_000, NOW)).toBe(false);
    expect(mayRecheck(NOW - 60_000, NOW)).toBe(true);
  });
});

describe('start count and stored notice', () => {
  it('counts starts from the stored number; garbage restarts at 1', () => {
    expect(nextStartCount(4)).toBe(5);
    expect(nextStartCount(null)).toBe(1);
    expect(nextStartCount('4')).toBe(1);
    expect(nextStartCount(-1)).toBe(1);
    expect(nextStartCount(1.5)).toBe(1);
  });
  it('reads a well-formed notice and refuses a damaged one', () => {
    const good = { version: '5.3.0', reason: 'r', storedAt: NOW, startId: '3' };
    expect(readStoredNotice(good)).toEqual(good);
    expect(readStoredNotice({ ...good, version: '5.3' })).toBeNull();
    expect(readStoredNotice({ ...good, startId: 3 })).toBeNull();
    expect(readStoredNotice({ ...good, storedAt: Number.NaN })).toBeNull();
    expect(readStoredNotice('5.3.0')).toBeNull();
  });
  it('a notice stored at start 3 blocks at start 4, not at start 3 (with the read failing)', () => {
    const stored = readStoredNotice({ version: '5.3.0', reason: 'r', storedAt: NOW, startId: String(3) });
    const same = decide({ running: '5.2.2', record: null, stored, startId: String(3), now: NOW });
    const next = decide({ running: '5.2.2', record: null, stored, startId: String(nextStartCount(3)), now: NOW });
    expect(same.action).toBe('none');
    expect(next.action).toBe('block');
  });
});
