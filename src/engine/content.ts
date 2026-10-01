// Picks what each puff carries, tuned to the level, the player's weak keys,
// newly introduced keys, and what is already on screen.

import { CAPITAL_WORDS, LETTER_STAGES, LONG_WORDS, MEDIUM_WORDS, PHRASES, PICTURE_WORDS, SENTENCES, SHORT_WORDS } from './words';
import type { ContentKind, Level } from './levels';

export interface Item { text: string; emoji?: string; kind: ContentKind }

export interface LittleOpts { names: string[] }

/** Every 2–4 letter, all-lowercase word we have. */
export const LITTLE_WORDS: string[] = [...new Set([
  ...SHORT_WORDS.filter((w) => /^[a-z]{2,4}$/.test(w)),
  ...PICTURE_WORDS.map((w) => w.text),
  'nova',
])];

/** Turns a gardener's name into a Little Words-friendly word, if it is one. */
export function littleName(name: string): string | null {
  const n = name.trim().toLowerCase();
  return /^[a-z]{2,4}$/.test(n) ? n : null;
}

export function unlockedLetters(stage: number): string[] {
  return LETTER_STAGES.slice(0, Math.min(stage, LETTER_STAGES.length - 1) + 1).flat();
}

/** Keys that are new at this stage (vs. the previous level's stage). */
export function keysNewAt(stage: number, prevStage: number): string[] {
  if (stage <= prevStage) return [];
  const prev = new Set(prevStage < 0 ? [] : unlockedLetters(prevStage));
  return unlockedLetters(stage).filter((k) => !prev.has(k));
}

export class ContentPicker {
  private recent: string[] = [];
  private homerowCache = new Map<number, string[]>();

  constructor(private rand: () => number = Math.random) {}

  next(level: Level, opts: { avoidFirst?: Set<string>; weak?: Record<string, number>; focus?: string[]; little?: LittleOpts } = {}): Item {
    const avoid = opts.avoidFirst ?? new Set<string>();
    const weak = opts.weak ?? {};
    if (opts.little) {
      const item = this.pickLittle(level, avoid, weak, opts.little);
      this.recent.push(item.text);
      if (this.recent.length > 24) this.recent.shift();
      return item;
    }
    const kind = this.pickKind(level);
    let item: Item | null = null;
    for (let attempt = 0; attempt < 3 && !item; attempt++) {
      item = this.pickFrom(attempt === 0 ? kind : fallbackKind(kind), level, avoid, weak, opts.focus ?? []);
    }
    item ??= { text: 'bee', kind: 'short' };
    this.recent.push(item.text);
    if (this.recent.length > 24) this.recent.shift();
    return item;
  }

  private pickKind(level: Level): ContentKind {
    const entries = Object.entries(level.mix) as [ContentKind, number][];
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = this.rand() * total;
    for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
    return entries[0][0];
  }

  private pickFrom(kind: ContentKind, level: Level, avoid: Set<string>, weak: Record<string, number>, focus: string[]): Item | null {
    if (kind === 'letters') return this.pickLetter(level, avoid, weak, focus);
    if (kind === 'picture') {
      const pool = PICTURE_WORDS.filter((w) => !avoid.has(w.text[0]) && !this.recent.includes(w.text));
      const e = this.weighted(pool.length ? pool : PICTURE_WORDS, (w) => w.text, weak, focus);
      return e ? { text: e.text, emoji: e.emoji, kind } : null;
    }
    const pool = this.poolFor(kind, level);
    const filtered = pool.filter((t) => !avoid.has(t[0].toLowerCase()) && !this.recent.includes(t));
    const text = this.weighted(filtered.length ? filtered : pool, (t) => t, weak, focus);
    return text ? { text, kind } : null;
  }

  private poolFor(kind: ContentKind, level: Level): string[] {
    switch (kind) {
      case 'homerow': return this.homerowWords(level.letterStage);
      case 'short': return SHORT_WORDS;
      case 'medium': return MEDIUM_WORDS;
      case 'long': return LONG_WORDS;
      case 'capital': return CAPITAL_WORDS;
      case 'phrase': return PHRASES;
      case 'sentence': return SENTENCES;
      default: return SHORT_WORDS;
    }
  }

  /**
   * Little Words: only 2–4 letter lowercase words, never capitals or
   * punctuation. Picture words (with an emoji) are favoured while the player
   * is still at the patient, early levels. Special names (like the gardener's
   * own) pop up now and then with a star.
   */
  private pickLittle(level: Level, avoid: Set<string>, weak: Record<string, number>, o: LittleOpts): Item {
    const names = o.names.filter((n) => !this.recent.slice(-8).includes(n));
    if (names.length && this.rand() < 0.1) {
      const n = names[Math.floor(this.rand() * names.length)];
      if (!avoid.has(n[0])) return { text: n, emoji: '🌟', kind: 'picture' };
    }
    const pictureChance = level.patient ? 0.6 : 0.3;
    if (this.rand() < pictureChance) {
      const pool = PICTURE_WORDS.filter((w) => !avoid.has(w.text[0]) && !this.recent.includes(w.text));
      const e = this.weighted(pool.length ? pool : PICTURE_WORDS, (w) => w.text, weak, []);
      if (e) return { text: e.text, emoji: e.emoji, kind: 'picture' };
    }
    const pool = LITTLE_WORDS.filter((t) => !avoid.has(t[0]) && !this.recent.includes(t));
    const text = this.weighted(pool.length ? pool : LITTLE_WORDS, (t) => t, weak, []) ?? 'sun';
    return { text, kind: 'short' };
  }

  /** Short words spelled only with unlocked letters. */
  homerowWords(stage: number): string[] {
    let c = this.homerowCache.get(stage);
    if (!c) {
      const ok = new Set(unlockedLetters(stage));
      c = SHORT_WORDS.filter((w) => w.length >= 2 && w.length <= 4 && [...w].every((ch) => ok.has(ch)));
      this.homerowCache.set(stage, c);
    }
    return c;
  }

  private pickLetter(level: Level, avoid: Set<string>, weak: Record<string, number>, focus: string[]): Item {
    const letters = unlockedLetters(level.letterStage);
    const last = this.recent.slice(-2);
    const weights = letters.map((l) => {
      let w = 1;
      if (focus.includes(l)) w *= 3.5;          // freshly introduced keys get lots of practice
      w *= 1 + 3 * (weak[l] ?? 0);              // keys you miss come back more often
      if (last.includes(l)) w *= 0.25;          // avoid boring repeats
      if (last.length === 2 && last[0] === l && last[1] === l) w = 0;
      if (avoid.has(l)) w *= 0.01;
      return w;
    });
    return { text: letters[pickIndex(weights, this.rand)], kind: 'letters' };
  }

  /** Weighted sample: items containing weak/focus letters are favoured. */
  private weighted<T>(pool: T[], textOf: (t: T) => string, weak: Record<string, number>, focus: string[]): T | null {
    if (!pool.length) return null;
    // Sample a manageable candidate subset, then weight — keeps it O(k) on big lists.
    const k = Math.min(pool.length, 24);
    const cands: T[] = [];
    for (let i = 0; i < k; i++) cands.push(pool[Math.floor(this.rand() * pool.length)]);
    const weights = cands.map((c) => {
      const t = textOf(c).toLowerCase();
      let w = 1;
      for (const ch of new Set(t)) {
        w += 2.5 * (weak[ch] ?? 0);
        if (focus.includes(ch)) w += 0.8;
      }
      return w;
    });
    return cands[pickIndex(weights, this.rand)];
  }
}

function fallbackKind(k: ContentKind): ContentKind {
  return k === 'homerow' || k === 'picture' ? 'letters' : 'short';
}

function pickIndex(weights: number[], rand: () => number): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return Math.floor(rand() * weights.length);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
  return weights.length - 1;
}
