import { describe, it, expect } from 'vitest';
import { ContentPicker, SHORT, MEDIUM, LONG } from '../../src/engine/content';
import { LEVELS } from '../../src/engine/levels';
import { rng } from '../../src/art/palette';
import bank from '../../src/engine/spelling-bank.json';
import week from '../../src/engine/spelling.json';
import {
  LETTER_STAGES,
  PICTURE_WORDS,
  SHORT_WORDS,
  MEDIUM_WORDS,
  LONG_WORDS,
  CAPITAL_WORDS,
  PHRASES,
  SENTENCES,
} from '../../src/engine/words';

const HOME = /^[asdfghjkl]+$/;
const noDupes = (list: string[]) => {
  const dupes = list.filter((x, i) => list.indexOf(x) !== i);
  expect(dupes).toEqual([]);
};
const bad = (list: string[], ok: (s: string) => boolean) => list.filter((s) => !ok(s));

describe('words library', () => {
  it('LETTER_STAGES cover a-z exactly once, home row first', () => {
    const all = LETTER_STAGES.flat();
    expect([...all].sort().join('')).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(all.every((k) => /^[a-z]$/.test(k))).toBe(true);
    expect(LETTER_STAGES[0]).toEqual(['f', 'j']);
    expect(LETTER_STAGES.every((s) => s.length > 0)).toBe(true);
  });

  it('PICTURE_WORDS are 3 lowercase letters with an emoji', () => {
    expect(PICTURE_WORDS.length).toBeGreaterThanOrEqual(70);
    for (const e of PICTURE_WORDS) {
      expect(e.text).toMatch(/^[a-z]{3}$/);
      expect(e.emoji && e.emoji.length > 0).toBe(true);
    }
    noDupes(PICTURE_WORDS.map((e) => e.text));
  });

  it('SHORT_WORDS', () => {
    expect(SHORT_WORDS.length).toBeGreaterThanOrEqual(300);
    noDupes(SHORT_WORDS);
    expect(bad(SHORT_WORDS, (s) => /^[a-z]+$/.test(s))).toEqual([]);
    expect(bad(SHORT_WORDS, (s) => s.length >= 2 && (s.length <= 4 || (s.length === 5 && HOME.test(s))))).toEqual([]);
    expect(SHORT_WORDS.filter((s) => HOME.test(s)).length).toBeGreaterThanOrEqual(25);
  });

  it('MEDIUM_WORDS', () => {
    expect(MEDIUM_WORDS.length).toBeGreaterThanOrEqual(300);
    noDupes(MEDIUM_WORDS);
    expect(bad(MEDIUM_WORDS, (s) => /^[a-z]{5,6}$/.test(s))).toEqual([]);
  });

  it('LONG_WORDS', () => {
    expect(LONG_WORDS.length).toBeGreaterThanOrEqual(200);
    noDupes(LONG_WORDS);
    expect(bad(LONG_WORDS, (s) => /^[a-z]{7,11}$/.test(s))).toEqual([]);
  });

  it('CAPITAL_WORDS', () => {
    expect(CAPITAL_WORDS.length).toBeGreaterThanOrEqual(80);
    noDupes(CAPITAL_WORDS);
    expect(bad(CAPITAL_WORDS, (s) => /^[A-Z][a-z]+$/.test(s))).toEqual([]);
  });

  it('PHRASES', () => {
    expect(PHRASES.length).toBeGreaterThanOrEqual(150);
    noDupes(PHRASES);
    expect(bad(PHRASES, (s) => /^[a-z]+( [a-z]+){1,3}$/.test(s))).toEqual([]);
  });

  it('SENTENCES', () => {
    expect(SENTENCES.length).toBeGreaterThanOrEqual(150);
    noDupes(SENTENCES);
    expect(bad(SENTENCES, (s) => /^[A-Z][A-Za-z ,'-]*[.!?]$/.test(s))).toEqual([]);
    expect(bad(SENTENCES, (s) => { const n = s.split(' ').length; return n >= 4 && n <= 10; })).toEqual([]);
  });
});

describe('spelling words in the other games', () => {
  it('every spelling word so far is in a word list that fits its length', () => {
    for (const w of bank.words) {
      const pool = w.length <= 4 ? SHORT : w.length <= 6 ? MEDIUM : LONG;
      expect(pool, w).toContain(w);
    }
    for (const w of week.words) expect(bank.words, w.word).toContain(w.word);
  });

  it("this week's words come up often in ordinary games", () => {
    const p = new ContentPicker(rng(4));
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(p.next(LEVELS[14]).text);
    const fits = week.words.map((w) => w.word).filter((w) => w.length <= 6);
    expect(fits.filter((w) => seen.has(w))).toEqual(fits);
  });
});
