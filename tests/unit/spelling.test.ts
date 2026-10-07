import { describe, it, expect } from 'vitest';
import { Round, getMode, HINT_AFTER, type Puff } from '../../src/game/round';
import { DEFAULT_SKILL } from '../../src/engine/adaptive';
import { rng } from '../../src/art/palette';
import { WEEKS, weekFor } from '../../src/engine/spelling';

const CLIPS = Object.keys(import.meta.glob('../../public/spelling/*.mp3'));
const WORDS = ['badge', 'edge', 'bridge'];
const spellingRound = (words = WORDS) => new Round({ ...DEFAULT_SKILL, level: 6 }, getMode('spelling'), rng(5), { spelling: words });

/** Run until a word is on screen and has floated in. */
function nextWord(r: Round): Puff {
  for (let i = 0; i < 200; i++) {
    r.update(0.05);
    const p = r.puffs.find((q) => q.state === 'fly');
    if (p && p.age >= 1.6) return p;
  }
  throw new Error('no word appeared');
}

function wait(r: Round, seconds: number) { for (let t = 0; t < seconds; t += 0.05) r.update(0.05); }

describe('spelling bee', () => {
  it("ships every week's list with audio for every word", () => {
    expect(WEEKS.length).toBeGreaterThan(0);
    for (const week of WEEKS) {
      expect(week.test, week.name).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(week.words.length, week.name).toBeGreaterThan(0);
      for (const w of week.words) {
        expect(w.word).toMatch(/^[a-z]+$/);
        for (const f of [w.word, `${w.word}-say`]) expect(CLIPS, f).toContain(`../../public/spelling/${f}.mp3`);
      }
    }
    const tests = WEEKS.map((w) => w.test);
    expect(tests).toEqual([...tests].sort());
  });

  it('plays the next test’s words, moving on at 3pm on test day', () => {
    const at = (test: string, hour: number) => { const [y, m, d] = test.split('-').map(Number); return new Date(y, m - 1, d, hour); };
    expect(weekFor(at(WEEKS[0].test, 9))).toBe(WEEKS[0]);
    WEEKS.forEach((w, i) => {
      expect(weekFor(at(w.test, 14)), `${w.name} test morning`).toBe(w);
      expect(weekFor(at(w.test, 16)), `${w.name} after the test`).toBe(WEEKS[i + 1] ?? w);
    });
    expect(weekFor(new Date(2100, 0, 1))).toBe(WEEKS.at(-1)); // the last list stays until a new one comes
  });

  it('asks each word once, one hidden word at a time, then ends', () => {
    const r = spellingRound();
    const seen: string[] = [];
    while (r.phase === 'play') {
      const p = nextWord(r);
      expect(p.hidden).toBe(true);
      expect(r.puffs.filter((q) => q.state === 'fly')).toHaveLength(1);
      seen.push(p.text);
      for (const ch of p.text) r.handleKey(ch);
    }
    expect(seen.sort()).toEqual([...WORDS].sort());
    expect(r.spellingDone).toBe(3);
    expect(r.day).toBe(1);
  });

  it('never escapes and never changes the typing level', () => {
    const r = spellingRound();
    const p = nextWord(r);
    wait(r, 120);
    expect(p.state).toBe('fly');
    for (const ch of p.text) r.handleKey(ch);
    expect(r.skill.state.level).toBe(6);
  });

  it('fades the next letter in after a quiet spell, and resets once it is typed', () => {
    const r = spellingRound();
    const p = nextWord(r);
    r.handleKey(p.text[0]);
    wait(r, HINT_AFTER - 1);
    expect(p.hint).toBe(0);
    wait(r, 1.5);
    expect(r.drainEvents().some((e) => e.type === 'hint')).toBe(true);
    const early = p.hint!;
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.5); // it fades in slowly, not all at once
    wait(r, 5);
    expect(p.hint).toBe(1);
    r.handleKey(p.text[1]);
    expect(p.hint).toBe(0);
    expect(p.hinted).toBe(true);
  });

  it('wrong letters are not taken in, and three at one letter bring the hint in', () => {
    const r = spellingRound();
    const p = nextWord(r);
    r.handleKey(p.text[0]);
    const wrong = p.text[1] === 'z' ? 'q' : 'z';
    for (let i = 0; i < 3; i++) r.handleKey(wrong);
    expect(p.typed).toBe(1);
    r.update(0.05);
    expect(p.hint).toBeGreaterThan(0);
    r.release(); // Backspace doesn't throw away the letters already spelled
    expect(p.typed).toBe(1);
  });

  it('brings a word that needed help back once at the end', () => {
    const r = spellingRound(['edge', 'age']);
    const first = nextWord(r);
    wait(r, HINT_AFTER + 1); // stuck on the first letter
    for (const ch of first.text) r.handleKey(ch);
    const spelled: string[] = [first.text];
    while (r.phase === 'play') {
      const p = nextWord(r);
      spelled.push(p.text);
      for (const ch of p.text) r.handleKey(ch);
    }
    expect(spelled).toHaveLength(3);
    expect(spelled[2]).toBe(first.text);
    expect(r.spelling!.results.map((x) => x.retry)).toEqual([false, false, true]);
    expect(r.spellingDone).toBe(2);
  });
});
