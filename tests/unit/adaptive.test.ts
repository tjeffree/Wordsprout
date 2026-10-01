import { describe, it, expect } from 'vitest';
import { simulate } from './sim';
import { DEFAULT_SKILL, SkillModel, wpmOf } from '../../src/engine/adaptive';
import { LEVELS } from '../../src/engine/levels';
import { cpsGuessForLevel } from '../../src/engine/adaptive';

const start = (level: number) => ({ ...DEFAULT_SKILL, level, cps: cpsGuessForLevel(level), keys: {} });

describe('adaptive engine', () => {
  it('a 1 WPM six-year-old never loses a puff and slowly climbs', () => {
    const s = simulate({ wpm: 1, accuracy: 0.85, seconds: 600, skill: start(1) });
    expect(s.escapes).toBe(0);
    expect(s.completed).toBeGreaterThan(12);
    expect(s.skill.level).toBeGreaterThanOrEqual(2);
    expect(s.skill.level).toBeLessThanOrEqual(11); // still patient levels
  });

  it('a 1 WPM child mashing wrong keys is stepped down, never stuck', () => {
    const s = simulate({ wpm: 1.5, accuracy: 0.4, seconds: 600, skill: start(4) });
    expect(s.skill.level).toBeLessThan(4);
    expect(s.escapes).toBe(0);
  });

  it('a 110 WPM typist placed low climbs into the upper levels quickly', () => {
    const s = simulate({ wpm: 110, accuracy: 0.98, seconds: 300, skill: start(13) });
    expect(s.skill.level).toBeGreaterThanOrEqual(19);
    expect(s.wpm).toBeGreaterThan(60);
  });

  it('a 20 WPM typist placed too high is brought down and keeps most puffs', () => {
    const s = simulate({ wpm: 20, accuracy: 0.95, seconds: 300, skill: start(20) });
    expect(s.skill.level).toBeLessThan(18);
    // After settling, very few escapes
    expect(s.escapes / Math.max(1, s.completed + s.escapes)).toBeLessThan(0.2);
  });

  it('pace settles so a mid typist rarely loses puffs', () => {
    const s = simulate({ wpm: 45, accuracy: 0.96, seconds: 300, skill: start(14) });
    const rate = s.escapes / Math.max(1, s.completed + s.escapes);
    expect(rate).toBeLessThan(0.12);
    expect(s.skill.level).toBeGreaterThan(14);
  });

  it('measured WPM tracks the true WPM', () => {
    for (const wpm of [15, 40, 80]) {
      const s = simulate({ wpm, accuracy: 1, seconds: 180, skill: start(15) });
      expect(s.wpm).toBeGreaterThan(wpm * 0.5);
      expect(s.wpm).toBeLessThan(wpm * 1.6);
    }
  });

  it('wpmOf counts an implicit space for words but not letters', () => {
    expect(wpmOf([{ chars: 4, correct: 4, wrong: 0, escaped: false, ms: 1000, progress: 0.5, isLetters: false }])).toBeCloseTo(60);
    expect(wpmOf([{ chars: 5, correct: 5, wrong: 0, escaped: false, ms: 60000, progress: 0.5, isLetters: true }])).toBeCloseTo(1);
  });

  it('every level has sane parameters', () => {
    LEVELS.forEach((l, i) => {
      expect(l.id).toBe(i + 1);
      expect(l.maxActive).toBeGreaterThanOrEqual(1);
      if (i > 0) expect(l.promoteWpm).toBeGreaterThanOrEqual(LEVELS[i - 1].promoteWpm);
    });
  });

  it('weak keys are reported', () => {
    const m = new SkillModel(start(5));
    for (let i = 0; i < 6; i++) { m.recordKey('k', false); m.recordKey('f', true); }
    const w = m.weakness();
    expect(w.k).toBeGreaterThan(0.9);
    expect(w.f).toBeLessThan(0.1);
  });
});
