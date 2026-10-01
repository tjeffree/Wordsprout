import { describe, it, expect } from 'vitest';
import { ContentPicker, LITTLE_WORDS, littleName } from '../../src/engine/content';
import { LEVELS } from '../../src/engine/levels';
import { Round, getMode } from '../../src/game/round';
import { DEFAULT_SKILL } from '../../src/engine/adaptive';
import { rng } from '../../src/art/palette';

describe('Little Words mode', () => {
  it('only ever serves 2-4 letter lowercase words, at every level', () => {
    const p = new ContentPicker(rng(3));
    const names = ['nova'];
    let sawNova = false;
    for (const lv of LEVELS) {
      for (let i = 0; i < 300; i++) {
        const it = p.next(lv, { little: { names } });
        expect(it.text).toMatch(/^[a-z]{2,4}$/);
        if (it.text === 'nova') sawNova = true;
      }
    }
    expect(sawNova).toBe(true);
  });

  it('includes nova in the word pool', () => {
    expect(LITTLE_WORDS).toContain('nova');
    expect(LITTLE_WORDS.every((w) => /^[a-z]{2,4}$/.test(w))).toBe(true);
    expect(LITTLE_WORDS.length).toBeGreaterThan(150);
  });

  it('turns short names into words', () => {
    expect(littleName('Nova')).toBe('nova');
    expect(littleName('Maximilian')).toBeNull();
    expect(littleName('Jo-Jo')).toBeNull();
  });

  it('No capitals lowercases every game, keeping punctuation', () => {
    const r = new Round({ ...DEFAULT_SKILL, level: 21, cps: 3 }, getMode('stroll'), rng(9), { noCaps: true });
    const seen: string[] = [];
    for (let i = 0; i < 2000; i++) {
      r.update(0.05);
      for (const e of r.drainEvents()) if (e.type === 'spawn') seen.push(e.puff.text);
      if (i % 40 === 0) for (const p of r.puffs) if (p.state === 'fly') { p.state = 'pop'; }
    }
    expect(seen.length).toBeGreaterThan(5);
    for (const t of seen) expect(t).toBe(t.toLowerCase());
    expect(r.puffs.every((p) => !p.strict)).toBe(true);
  });

  it('never requires capitals even at capital levels', () => {
    const r = new Round({ ...DEFAULT_SKILL, level: 21, cps: 3 }, getMode('stroll'), rng(5), { little: { names: ['nova'] } });
    for (let i = 0; i < 600; i++) r.update(0.05);
    expect(r.puffs.length).toBeGreaterThan(0);
    for (const p of r.puffs) { expect(p.strict).toBe(false); expect(p.text).toMatch(/^[a-z]{2,4}$/); }
  });
});
