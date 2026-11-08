import { describe, it, expect } from 'vitest';
import { addRound, backfillStats, emptyStats, firstTimeWords, playTime, ordinal, dayKey, type RoundSummary } from '../../src/engine/stats';

const GAME: RoundSummary = { mode: 'ten', words: 10, letters: 42, perfect: 8, golden: 1, flowers: ['daisy', 'rose', 'starbloom', 'sprout'], levelUps: 1, seconds: 95.4, longest: 'garden' };
const day = (d: number, h = 10) => new Date(2026, 10, d, h);

describe('gardener stats', () => {
  it('adds up a game', () => {
    const { stats } = addRound(emptyStats(0), GAME, day(8));
    expect(stats).toMatchObject({ games: 1, modes: { ten: 1 }, words: 10, letters: 42, perfect: 8, golden: 1, rare: 2, levelUps: 1, seconds: 95, longest: 'garden', days: 1, bestRun: 1, lastDay: '2026-11-08' });
  });

  it('never changes the stats it was given', () => {
    const before = emptyStats(0);
    addRound(before, GAME, day(8));
    expect(before).toEqual(emptyStats(0));
  });

  it('only ever goes up, and keeps the longest word', () => {
    let s = emptyStats(0);
    for (const g of [GAME, { ...GAME, longest: 'cat' }, { ...GAME, mode: 'spelling' as const, longest: 'beautiful' }]) {
      const next = addRound(s, g, day(8)).stats;
      for (const k of ['games', 'words', 'letters', 'perfect', 'golden', 'rare', 'seconds', 'days', 'bestRun'] as const) expect(next[k]).toBeGreaterThanOrEqual(s[k]);
      s = next;
    }
    expect(s.longest).toBe('beautiful');
    expect(s.modes).toEqual({ ten: 2, spelling: 1 });
  });

  it('counts days played and the most days in a row', () => {
    let s = emptyStats(0);
    for (const d of [day(1), day(1, 18), day(2), day(3), day(5), day(6)]) s = addRound(s, GAME, d).stats;
    expect(s.days).toBe(5);
    expect(s.bestRun).toBe(3);
    // A run across the end of a month still counts.
    s = emptyStats(0);
    for (const d of [new Date(2026, 9, 31), new Date(2026, 10, 1)]) s = addRound(s, GAME, d).stats;
    expect(s.bestRun).toBe(2);
  });

  it('counts Spelling Bees finished and words right first time', () => {
    const results = [
      { word: 'cake', wrong: 0, hinted: false, retry: false },
      { word: 'snake', wrong: 2, hinted: false, retry: false },
      { word: 'snake', wrong: 0, hinted: false, retry: true },
      { word: 'plate', wrong: 0, hinted: true, retry: false },
      { word: 'grape', wrong: 0, hinted: false, retry: false },
    ];
    expect(firstTimeWords(results)).toEqual(['cake', 'grape']);
    const { stats } = addRound(emptyStats(0), { ...GAME, mode: 'spelling', spelling: { results, finished: true } }, day(8));
    expect(stats.bees).toBe(1);
    expect(stats.firstTime).toBe(2);
    const quit = addRound(emptyStats(0), { ...GAME, mode: 'spelling', spelling: { results, finished: false } }, day(8)).stats;
    expect(quit.bees).toBe(0);
    expect(quit.firstTime).toBe(2);
  });

  it('celebrates big numbers once', () => {
    const before = { ...emptyStats(0), words: 95, games: 9, days: 6, lastDay: '2026-11-07', run: 2, bestRun: 2 };
    const { stats, milestones } = addRound(before, GAME, day(8));
    expect(milestones.map((m) => m.text)).toEqual(['100 words typed!', 'Your 10th game!', 'Your first golden dandelion!', '7 days in the garden!', '3 days in a row!']);
    expect(addRound(stats, { ...GAME, golden: 0 }, day(8)).milestones).toEqual([]);
    // Past the end of the list, every 5,000 words.
    expect(addRound({ ...emptyStats(0), words: 14995 }, GAME, day(8)).milestones[0].text).toBe('15,000 words typed!');
  });

  it('starts older gardeners from what is already known', () => {
    const s = backfillStats({ rounds: 120, totalFlowers: 1400, lastPlayed: day(7).getTime() }, 5);
    expect(s).toMatchObject({ since: 5, games: 120, words: 1400, days: 1, bestRun: 1, lastDay: '2026-11-07', letters: 0, firstTime: 0 });
    expect(backfillStats({ rounds: 0, totalFlowers: 0, lastPlayed: 0 }, 5).days).toBe(0);
    // Saved stats are kept (and filled in if a field is missing).
    const kept = backfillStats({ rounds: 999, totalFlowers: 999, lastPlayed: 0, stats: { since: 3, games: 4, words: 50 } });
    expect(kept).toMatchObject({ since: 3, games: 4, words: 50, golden: 0, modes: {} });
  });

  it('says things kindly', () => {
    expect(playTime(0)).toBe('0 minutes');
    expect(playTime(20)).toBe('Under a minute');
    expect(playTime(60)).toBe('1 minute');
    expect(playTime(12 * 60)).toBe('12 minutes');
    expect(playTime(60 * 60)).toBe('1 hour');
    expect(playTime(200 * 60)).toBe('3 hours 20 min');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
