import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/ui/keyboard.css', () => ({}));
const { FINGER_OF, FINGER_NAME } = await import('../../src/ui/keyboard');

describe('FINGER_OF', () => {
  it('covers letters, digits, punctuation and space', () => {
    const all = 'abcdefghijklmnopqrstuvwxyz0123456789;\',./-= ';
    for (const c of all) expect(FINGER_OF[c], c).toBeDefined();
  });
  it('has correct home row', () => {
    expect(FINGER_OF.a).toBe('lp');
    expect(FINGER_OF.s).toBe('lr');
    expect(FINGER_OF.d).toBe('lm');
    expect(FINGER_OF.f).toBe('li');
    expect(FINGER_OF.j).toBe('ri');
    expect(FINGER_OF.k).toBe('rm');
    expect(FINGER_OF.l).toBe('rr');
    expect(FINGER_OF[';']).toBe('rp');
    expect(FINGER_OF[' ']).toBe('thumb');
  });
  it('names every finger', () => {
    for (const f of new Set(Object.values(FINGER_OF))) expect(FINGER_NAME[f]).toBeTruthy();
  });
});
