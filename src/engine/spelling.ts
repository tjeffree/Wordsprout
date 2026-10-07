// The school spelling lists, one per week, each with its test date
// (spelling/words.txt, built into spelling.json by scripts/spelling.mjs).

import list from './spelling.json';

export interface SpellingWord { word: string; sentence: string }
export interface SpellingWeek { name: string; test: string; words: SpellingWord[] }

/** Every week of the term, in test-date order. */
export const WEEKS: SpellingWeek[] = list.weeks;

/** On test day, the next week's words take over at 3pm, once the test is done. */
const SWITCH_HOUR = 15;

/** The week to practise: the next test still to come, or the last week once they're all done. */
export function weekFor(now: Date = new Date()): SpellingWeek | null {
  for (const w of WEEKS) {
    const [y, m, d] = w.test.split('-').map(Number);
    if (now < new Date(y, m - 1, d, SWITCH_HOUR)) return w;
  }
  return WEEKS.at(-1) ?? null;
}

export const THIS_WEEK: SpellingWeek | null = weekFor();
