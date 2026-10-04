import { describe, it, expect } from 'vitest';
import { Round, getMode } from '../../src/game/round';
import { DEFAULT_SKILL } from '../../src/engine/adaptive';
import { rng } from '../../src/art/palette';

describe('Slow & Steady', () => {
  it('shows one word at a time that waits in the middle and never escapes', () => {
    const r = new Round({ ...DEFAULT_SKILL, level: 20, cps: 3 }, getMode('endless'), rng(4), { steady: true });
    for (let i = 0; i < 2400; i++) {
      r.update(0.05);
      const flying = r.puffs.filter((p) => p.state === 'fly');
      expect(flying.length).toBeLessThanOrEqual(1);
      for (const p of flying) { expect(p.patient).toBe(true); expect(p.laneCount).toBe(1); }
    }
    expect(r.stats.escapes).toBe(0);
    expect(r.puffs.some((p) => p.state === 'fly')).toBe(true);
  });

  it('moves on to the next word once one is typed', () => {
    const r = new Round({ ...DEFAULT_SKILL, level: 14, cps: 3 }, getMode('ten'), rng(2), { steady: true });
    const seen = new Set<number>();
    for (let i = 0; i < 400; i++) {
      r.update(0.05);
      const p = r.puffs.find((q) => q.state === 'fly');
      if (p) { seen.add(p.id); for (const ch of p.text.slice(p.typed)) r.handleKey(ch); }
    }
    expect(seen.size).toBeGreaterThan(3);
    expect(r.stats.flowers.length).toBe(seen.size);
  });

  it('does not apply to the Spelling Bee', () => {
    const r = new Round({ ...DEFAULT_SKILL }, getMode('spelling'), rng(1), { steady: true, spelling: ['cat'] });
    expect(r.steady).toBe(false);
  });
});
