import { describe, it, expect } from 'vitest';
import { Round, getMode } from '../../src/game/round';
import { DEFAULT_SKILL } from '../../src/engine/adaptive';
import { rng } from '../../src/art/palette';

describe('endless mode', () => {
  it('keeps going past every other mode’s limit and ends only when asked', () => {
    const r = new Round({ ...DEFAULT_SKILL, level: 6 }, getMode('endless'), rng(3));
    const days: number[] = [];
    for (let step = 0; step < 20 * 60 * 20; step++) { // 20 minutes at 20 fps
      r.update(0.05);
      // Type whatever is next, slowly enough to grow plenty of flowers.
      if (step % 4 === 0 && r.nextChar) r.handleKey(r.nextChar);
      r.drainEvents();
      days.push(r.day);
    }
    expect(r.phase).toBe('play');
    expect(r.stats.flowers.length).toBeGreaterThan(10);
    // The sky drifts but never reaches sunset.
    expect(Math.min(...days)).toBeGreaterThanOrEqual(0.1);
    expect(Math.max(...days)).toBeLessThanOrEqual(0.45 + 1e-9);

    r.finish();
    expect(r.phase).toBe('ending');
    for (let i = 0; i < 40; i++) r.update(0.05);
    expect(r.phase).toBe('done');
    expect(r.drainEvents().some((e) => e.type === 'end')).toBe(true);
  });
});
