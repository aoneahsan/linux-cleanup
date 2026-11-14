import { describe, expect, it } from 'vitest';
import { compareSemver, decide, type ReleaseRecord, type StoredNotice } from '@/lib/releaseGate';

const NOW = 1_793_000_000_000;
const THIS_START = 'start-b';
const normal = (version: string): ReleaseRecord => ({ version, severity: 'normal', reason: `Normal ${version}` });
const urgent = (version: string): ReleaseRecord => ({ version, severity: 'urgent', reason: `Urgent ${version}` });
const storedBy = (startId: string, version = '5.3.0'): StoredNotice => ({ version, reason: `Normal ${version}`, storedAt: NOW - 1000, startId });
const run = (running: string, record: ReleaseRecord | null, stored: StoredNotice | null) =>
  decide({ running, record, stored, startId: THIS_START, now: NOW });

describe('compareSemver', () => {
  it('orders by major, minor, patch numerically, not as text', () => {
    expect(compareSemver('5.2.2', '5.3.0')).toBe(-1);
    expect(compareSemver('5.10.0', '5.9.9')).toBe(1);
    expect(compareSemver('10.0.0', '9.99.99')).toBe(1);
    expect(compareSemver('5.2.2', '5.2.2')).toBe(0);
    expect(compareSemver('99999999999999999999.0.0', '99999999999999999998.9.9')).toBe(1);
  });
  it('is null for anything that is not strict x.y.z', () => {
    for (const bad of ['5.3.0-beta.1', 'v5.3.0', '5.3', '05.3.0', '5.3.0 ', '', 'latest']) {
      expect(compareSemver(bad, '5.3.0')).toBeNull();
      expect(compareSemver('5.3.0', bad)).toBeNull();
    }
  });
});

describe('decide — one case per contract row', () => {
  it('no record (read failed) and nothing stored: nothing, fail open', () => {
    expect(run('5.2.2', null, null)).toEqual({ action: 'none', clearStored: false });
  });
  it('no record, but a normal release stored by an EARLIER start: block', () => {
    expect(run('5.2.2', null, storedBy('start-a'))).toEqual({ action: 'block', version: '5.3.0', reason: 'Normal 5.3.0', severity: 'normal' });
  });
  it('no record, notice stored during THIS start: nothing yet (it blocks at the next start)', () => {
    expect(run('5.2.2', null, storedBy(THIS_START))).toEqual({ action: 'none', clearStored: false });
  });
  it('running >= record: nothing, and any stored notice is cleared', () => {
    expect(run('5.3.0', normal('5.3.0'), storedBy('start-a'))).toEqual({ action: 'none', clearStored: true });
    expect(run('5.4.0', urgent('5.3.0'), null)).toEqual({ action: 'none', clearStored: false });
  });
  it('urgent and older: block now, whatever is stored', () => {
    expect(run('5.2.2', urgent('5.3.0'), null)).toEqual({ action: 'block', version: '5.3.0', reason: 'Urgent 5.3.0', severity: 'urgent' });
    expect(run('5.2.2', urgent('5.3.0'), storedBy(THIS_START))).toMatchObject({ action: 'block', severity: 'urgent' });
  });
  it('normal and older, nothing stored: notice now, and store it for this start', () => {
    expect(run('5.2.2', normal('5.3.0'), null)).toEqual({
      action: 'notice', version: '5.3.0', reason: 'Normal 5.3.0',
      store: { version: '5.3.0', reason: 'Normal 5.3.0', storedAt: NOW, startId: THIS_START },
    });
  });
  it('normal and older, stored during this start: notice again, keeping the original stored time', () => {
    const stored = storedBy(THIS_START);
    expect(run('5.2.2', normal('5.3.0'), stored)).toEqual({ action: 'notice', version: '5.3.0', reason: 'Normal 5.3.0', store: stored });
  });
  it('normal and older, stored by an earlier start: block', () => {
    expect(run('5.2.2', normal('5.3.0'), storedBy('start-a'))).toEqual({ action: 'block', version: '5.3.0', reason: 'Normal 5.3.0', severity: 'normal' });
  });
});

describe('decide — edges', () => {
  it('a stored notice this build already meets never blocks; a newer normal release is a fresh notice', () => {
    expect(run('5.3.0', normal('5.4.0'), storedBy('start-a', '5.3.0'))).toMatchObject({
      action: 'notice', version: '5.4.0', store: { version: '5.4.0', startId: THIS_START, storedAt: NOW },
    });
    expect(run('5.3.0', null, storedBy('start-a', '5.3.0'))).toEqual({ action: 'none', clearStored: true });
  });
  it('a bad record counts as no record (never a block)', () => {
    for (const version of ['5.3.0-beta.1', 'v9.9.9', '', 'garbage']) {
      expect(run('5.2.2', urgent(version), null)).toEqual({ action: 'none', clearStored: false });
    }
    expect(run('5.2.2', { version: '9.9.9', severity: 'critical' as 'urgent', reason: 'x' }, null)).toEqual({ action: 'none', clearStored: false });
  });
  it('a bad stored notice is cleared, never a block', () => {
    expect(run('5.2.2', null, storedBy('start-a', 'not-a-version'))).toEqual({ action: 'none', clearStored: true });
  });
  it('a running version that is not x.y.z fails open', () => {
    expect(run('5.3.0-dev', urgent('9.9.9'), storedBy('start-a'))).toEqual({ action: 'none', clearStored: false });
  });
});
