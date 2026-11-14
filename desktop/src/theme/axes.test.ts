import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AXES } from '@/theme/axes';

describe('appearance axis registry', () => {
  it('public/prepaint.js table equals src/theme/axes.ts', () => {
    const html = readFileSync(new URL('../../public/prepaint.js', import.meta.url), 'utf8');
    const match = /var A = (\{.*?\});/.exec(html);
    expect(match).not.toBeNull();
    expect(JSON.parse(match?.[1] ?? '{}')).toEqual(AXES);
  });
});
