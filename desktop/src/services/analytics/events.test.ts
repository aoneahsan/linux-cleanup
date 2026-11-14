import { describe, expect, it } from 'vitest';
import { clean, makeGtag } from '@/services/analytics/events';

describe('analytics registry', () => {
  it('keeps registered counts and drops anything unregistered or path-like', () => {
    expect(clean('run_finished', { sections: 3, completed: 2, skipped: 1, failed: 0, interrupted: false, cancelled: false, path: '/Users/x' }))
      .toEqual({ sections: 3, completed: 2, skipped: 1, failed: 0, interrupted: false, cancelled: false });
    expect(clean('settings_changed', { key: '~/Projects' })).toEqual({});
    expect(clean('settings_changed', { key: 'someone@example.com' })).toEqual({});
    expect(clean('screen_view', { screen: '/Users/pc/secret' })).toEqual({});
    expect(clean('screen_view', { screen: '/admin/users' })).toEqual({ screen: '/admin/users' });
  });

  it('the gtag shim pushes an arguments object (a spread array is ignored by gtag.js)', () => {
    const layer: unknown[] = [];
    makeGtag(layer)('config', 'G-TEST');
    expect(Object.prototype.toString.call(layer[0])).toBe('[object Arguments]');
    const spread: unknown[] = [];
    ((...args: unknown[]) => spread.push(args))('config', 'G-TEST');
    expect(Object.prototype.toString.call(spread[0])).toBe('[object Array]');
  });
});
