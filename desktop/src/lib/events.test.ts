import { describe, expect, it } from 'vitest';
import { finishStream, foldLines, initialRunState, INTERRUPTED_REASON, tally } from '@/lib/events';

const line = (o: object) => JSON.stringify({ v: 1, ts: 1, ...o });

const PLAN = line({
  type: 'plan', version: '5.1.0', dry_run: true, profile: null,
  sections: [
    { id: 3, title: 'Package-manager caches', stamp: 'routine', sudo: false, deep: false },
    { id: 11, title: 'Time Machine local snapshots', stamp: 'permanent', sudo: true, deep: true },
    { id: 26, title: 'Disk usage report', stamp: 'read', sudo: false, deep: false },
  ],
});

describe('events parser', () => {
  it('folds plan → sections → items → results → summary', () => {
    const text = [
      PLAN,
      line({ type: 'disk', phase: 'before', total_kb: 1000, free_kb: 400, purgeable_kb: null, snapshots: 2, snapshot_note: true }),
      line({ type: 'section_start', id: 3, title: 'Package-manager caches', stamp: 'routine' }),
      line({ type: 'item', id: 3, path: '~/.npm/_cacache', kb: 300, action: 'delete', unique: false, age_days: 120 }),
      line({ type: 'item', id: 3, path: '~/Library/Caches/Yarn', kb: 200, action: 'delete', unique: false }),
      line({ type: 'progress', id: 3, done: 2, total: 2 }),
      line({ type: 'section_result', id: 3, status: 'completed', freed_kb: 500, items: 2, reason: null }),
      line({ type: 'section_result', id: 11, status: 'skipped', freed_kb: 0, items: 0, reason: 'needs --i-understand-deep' }),
      'not json at all',
      line({ type: 'future_event', whatever: true }),
      line({ type: 'section_result', id: 26, status: 'completed', freed_kb: 0, items: 0, reason: null }),
      line({
        type: 'summary', attempted: [3, 11, 26], completed: [3, 26], skipped: [11], failed: [], freed_kb: 500,
        disk_free_before_kb: 400, disk_free_after_kb: 400, elapsed_s: 3, reports: ['~/.macleanup/reports/r.txt'],
        log: '~/.macleanup/logs/l.log', dry_run: true,
      }),
    ].join('\n');
    const s = foldLines(initialRunState(), text);
    expect(s.phase).toBe('finished');
    expect(s.order).toEqual([3, 11, 26]);
    expect(s.sections[3]?.items).toHaveLength(2);
    expect(s.sections[3]?.items[0]?.ageDays).toBe(120);
    expect(s.sections[3]?.items[1]?.ageDays).toBeNull();
    expect(s.sections[3]?.plannedKb).toBe(500);
    expect(s.sections[3]?.state).toBe('completed');
    expect(s.sections[11]?.reason).toBe('needs --i-understand-deep');
    expect(s.sections[11]?.deep).toBe(true);
    expect(s.diskBefore?.snapshotNote).toBe(true);
    expect(s.summary?.reports).toEqual(['~/.macleanup/reports/r.txt']);
    expect(tally(s)).toEqual({ attempted: 3, completed: 2, skipped: 1, failed: 0 });
  });

  it('marks every unfinished section failed "interrupted" when the stream ends without a summary', () => {
    const text = [
      PLAN,
      line({ type: 'section_start', id: 3, title: 'Package-manager caches', stamp: 'routine' }),
      line({ type: 'section_result', id: 3, status: 'completed', freed_kb: 10, items: 1, reason: null }),
      line({ type: 'section_start', id: 11, title: 'Time Machine local snapshots', stamp: 'permanent' }),
    ].join('\n');
    const s = finishStream(foldLines(initialRunState(), text));
    expect(s.phase).toBe('interrupted');
    expect(s.sections[3]?.state).toBe('completed');
    expect(s.sections[11]).toMatchObject({ state: 'failed', reason: INTERRUPTED_REASON });
    expect(s.sections[26]).toMatchObject({ state: 'failed', reason: INTERRUPTED_REASON });
    expect(tally(s)).toEqual({ attempted: 3, completed: 1, skipped: 0, failed: 2 });
  });

  it('keeps section 0 toolchain fields (5.2.0) and ignores them when absent', () => {
    const s = foldLines(initialRunState(), [
      PLAN.replace('"id":3', '"id":0'),
      line({ type: 'item', id: 0, path: '/opt/homebrew', kb: 2048, action: 'report', unique: false, age_days: null, tool: 'homebrew', version: '4.4.0' }),
      line({ type: 'item', id: 0, path: '/tmp/x', kb: 1, action: 'report', unique: false }),
    ].join('\n'));
    expect(s.sections[0]?.items[0]).toMatchObject({ tool: 'homebrew', version: '4.4.0', ageDays: null, action: 'report' });
    expect(s.sections[0]?.items[1]).not.toHaveProperty('tool');
  });

  it('counts only delete and trash toward the planned size', () => {
    const s = foldLines(initialRunState(), [
      PLAN,
      line({ type: 'item', id: 3, path: '/a', kb: 100, action: 'delete', unique: false }),
      line({ type: 'item', id: 3, path: '/b', kb: 40, action: 'archive', unique: true }),
      line({ type: 'item', id: 3, path: '/b', kb: 40, action: 'delete', unique: true }),
      line({ type: 'item', id: 3, path: '/c', kb: 7, action: 'trash', unique: false }),
      line({ type: 'item', id: 3, path: '/d', kb: 900, action: 'report', unique: false }),
      line({ type: 'item', id: 3, path: '/e', kb: 0, action: 'skip', unique: false }),
    ].join('\n'));
    expect(s.sections[3]?.plannedKb).toBe(147);
    expect(s.sections[3]?.itemCount).toBe(6);
  });

  it('takes the script estimate when a preview section lists fewer paths than it frees', () => {
    const s = foldLines(initialRunState(), [
      PLAN,
      line({ type: 'item', id: 3, path: '/a', kb: 10, action: 'delete', unique: false }),
      line({ type: 'section_result', id: 3, status: 'completed', freed_kb: 878352, items: 1, reason: null }),
    ].join('\n'));
    expect(s.sections[3]?.plannedKb).toBe(878352);
  });

  it('refuses a higher schema major version', () => {
    const s = foldLines(initialRunState(), JSON.stringify({ v: 2, type: 'plan', ts: 1, sections: [] }));
    expect(s.phase).toBe('refused');
    expect(s.refusedVersion).toBe(2);
    expect(finishStream(s).phase).toBe('refused');
  });
});
