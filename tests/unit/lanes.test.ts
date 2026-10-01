import { describe, it, expect } from 'vitest';
import { Round, getMode, laneFraction } from '../../src/game/round';
import { DEFAULT_SKILL } from '../../src/engine/adaptive';
import { rng } from '../../src/art/palette';

describe('lanes', () => {
  it('flying puffs never share a height, even when the lane count changes mid-round', () => {
    const r = new Round({ ...DEFAULT_SKILL, level: 15, cps: 0.5 }, getMode('summer'), rng(11));
    for (let step = 0; step < 4000; step++) {
      if (step % 300 === 0) r.laneCap = 2 + ((step / 300) % 3); // 2, 3, 4, 2, ...
      r.update(0.05);
      r.drainEvents();
      const fly = r.puffs.filter((p) => p.state === 'fly');
      const fr = fly.map((p) => laneFraction(p.lane, p.laneCount));
      for (let i = 0; i < fr.length; i++) for (let j = i + 1; j < fr.length; j++) expect(Math.abs(fr[i] - fr[j])).toBeGreaterThan(0.2);
    }
  });
});
