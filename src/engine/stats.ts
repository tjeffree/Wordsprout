// A gardener's stats: a happy record of everything they've done. Only good things
// are counted (words typed, games played, words spelled...), never mistakes, and
// every number only ever goes up.

import { FLOWER_RARITY, type FlowerKind } from '../art/flowers';
import type { ModeId, SpellingResult } from '../game/round';

export interface Stats {
  /** When these started counting (older gardeners: the day stats arrived). */
  since: number;
  games: number;
  /** Games played of each kind. */
  modes: Partial<Record<ModeId, number>>;
  /** Words, letters and sentences typed (one flower each), in every game. */
  words: number;
  letters: number;
  /** Words typed with no slips. */
  perfect: number;
  golden: number;
  /** Rare, Legendary and Mythic flowers grown. */
  rare: number;
  levelUps: number;
  seconds: number;
  /** Spelling Bees played to the end. */
  bees: number;
  /** Spelling Bee words spelled first time with no help. */
  firstTime: number;
  /** Days with at least one game, and the most days in a row. */
  days: number;
  bestRun: number;
  lastDay: string;
  run: number;
  longest: string;
}

/** What one finished game adds. */
export interface RoundSummary {
  mode: ModeId;
  words: number;
  letters: number;
  perfect: number;
  golden: number;
  flowers: readonly FlowerKind[];
  levelUps: number;
  seconds: number;
  longest: string;
  spelling?: { results: readonly SpellingResult[]; finished: boolean };
}

export function emptyStats(now = Date.now()): Stats {
  return { since: now, games: 0, modes: {}, words: 0, letters: 0, perfect: 0, golden: 0, rare: 0, levelUps: 0, seconds: 0, bees: 0, firstTime: 0, days: 0, bestRun: 0, lastDay: '', run: 0, longest: '' };
}

/**
 * Stats for a gardener from before stats were kept: games and words are known
 * exactly (every word grows one flower), the rest start counting now.
 */
export function backfillStats(p: { rounds: number; totalFlowers: number; lastPlayed: number; stats?: Partial<Stats> }, now = Date.now()): Stats {
  if (p.stats) return { ...emptyStats(p.stats.since ?? now), ...p.stats, modes: { ...(p.stats.modes ?? {}) } };
  const s = emptyStats(now);
  s.games = p.rounds;
  s.words = p.totalFlowers;
  if (p.rounds > 0) { s.days = 1; s.run = 1; s.bestRun = 1; s.lastDay = dayKey(new Date(p.lastPlayed)); }
  return s;
}

/** A local calendar day, like "2026-11-08". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + 1));
}

/** The spelling words in a Bee that were spelled first time with no help. */
export function firstTimeWords(results: readonly SpellingResult[]): string[] {
  const words = [...new Set(results.map((r) => r.word))];
  return words.filter((w) => results.some((r) => r.word === w && !r.retry && !r.hinted && r.wrong === 0));
}

export interface Milestone { emoji: string; text: string }

const WORD_STEPS = [100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000];
const GAME_STEPS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
const LETTER_STEPS = [1000, 2500, 5000, 10000, 20000, 30000, 50000, 75000, 100000];
const GOLD_STEPS = [1, 10, 25, 50, 100, 200];
const FIRST_STEPS = [10, 25, 50, 100, 150, 200, 300, 400, 500];
const DAY_STEPS = [7, 14, 30, 50, 75, 100, 150, 200, 365];

/** The step crossed going from a to b (the biggest, if several), past the list every `every` after its end. */
function crossed(a: number, b: number, steps: readonly number[], every: number): number {
  let hit = 0;
  for (const n of steps) if (a < n && b >= n) hit = n;
  const last = steps[steps.length - 1];
  for (let n = last + every; n <= b; n += every) if (a < n) hit = n;
  return hit;
}

const fmt = (n: number) => n.toLocaleString('en-GB');

/** Adds a finished game. Returns the new stats and anything worth celebrating. */
export function addRound(before: Stats, r: RoundSummary, now = new Date()): { stats: Stats; milestones: Milestone[] } {
  const s: Stats = { ...before, modes: { ...before.modes } };
  s.games++;
  s.modes[r.mode] = (s.modes[r.mode] ?? 0) + 1;
  s.words += r.words;
  s.letters += r.letters;
  s.perfect += r.perfect;
  s.golden += r.golden;
  s.rare += r.flowers.filter((k) => (FLOWER_RARITY[k] ?? 0) >= 2).length;
  s.levelUps += r.levelUps;
  s.seconds += Math.max(0, Math.round(r.seconds));
  if (r.spelling) {
    if (r.spelling.finished && r.spelling.results.length) s.bees++;
    s.firstTime += firstTimeWords(r.spelling.results).length;
  }
  if (r.longest.length > s.longest.length) s.longest = r.longest;
  const today = dayKey(now);
  if (s.lastDay !== today) {
    s.days++;
    s.run = s.lastDay && nextDay(s.lastDay) === today ? s.run + 1 : 1;
    s.bestRun = Math.max(s.bestRun, s.run);
    s.lastDay = today;
  }

  const m: Milestone[] = [];
  let n: number;
  if ((n = crossed(before.words, s.words, WORD_STEPS, 5000))) m.push({ emoji: '🎉', text: `${fmt(n)} words typed!` });
  if ((n = crossed(before.games, s.games, GAME_STEPS, 250))) m.push({ emoji: '🎈', text: `Your ${ordinal(n)} game!` });
  if ((n = crossed(before.letters, s.letters, LETTER_STEPS, 50000))) m.push({ emoji: '⌨️', text: `${fmt(n)} letters typed!` });
  if ((n = crossed(before.firstTime, s.firstTime, FIRST_STEPS, 250))) m.push({ emoji: '🐝', text: `${fmt(n)} spellings right first time!` });
  if ((n = crossed(before.golden, s.golden, GOLD_STEPS, 100))) m.push({ emoji: '✨', text: n === 1 ? 'Your first golden dandelion!' : `${fmt(n)} golden dandelions!` });
  if ((n = crossed(before.days, s.days, DAY_STEPS, 100))) m.push({ emoji: '📅', text: `${fmt(n)} days in the garden!` });
  if (s.bestRun > before.bestRun && s.bestRun >= 3) m.push({ emoji: '🔥', text: `${s.bestRun} days in a row!` });
  return { stats: s, milestones: m };
}

export function ordinal(n: number): string {
  const t = n % 100;
  const suf = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${fmt(n)}${suf}`;
}

/** Time played, kindly rounded: "12 minutes", "3 hours 20 minutes". */
export function playTime(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return seconds > 0 ? 'Under a minute' : '0 minutes';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`;
  const h = Math.floor(mins / 60), mm = mins % 60;
  return `${h} hour${h === 1 ? '' : 's'}${mm ? ` ${mm} min` : ''}`;
}
