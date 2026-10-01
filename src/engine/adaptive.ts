// The adaptive skill model.
//
// Two separate loops keep progression fair:
//  1. LEVEL (content difficulty) climbs when you are accurate and fast enough for
//     the next rung, and steps down when you struggle. Decisions use a rolling
//     window of recent items and reset after every change (hysteresis).
//  2. PACE (how fast puffs drift) is a continuous controller. Each puff's travel
//     time is derived from YOUR measured speed times a "slack" factor, and slack
//     nudges itself so you typically finish a puff a bit past halfway across
//     the sky. A 10 WPM typist and a 120 WPM typist both feel the same
//     comfortable-but-exciting pressure.

import { getLevel, MAX_LEVEL, type Level } from './levels';

export interface ItemResult {
  chars: number;        // characters in the item
  correct: number;      // correct keystrokes
  wrong: number;        // wrong keystrokes
  escaped: boolean;     // drifted away untyped
  ms: number;           // active milliseconds spent on it (visible → done)
  progress: number;     // 0..1 how far across the sky it was when finished
  isLetters: boolean;   // single-letter item (no implicit space in WPM)
}

export interface KeyStat { hits: number; misses: number }

export interface SkillState {
  level: number;
  cps: number;     // estimated characters per second, including reaction time
  slack: number;   // travel-time multiplier
  keys: Record<string, KeyStat>;
}

export const DEFAULT_SKILL: SkillState = { level: 1, cps: 0.6, slack: 3, keys: {} };

/** Starting speed guess for a placement level, used until we've measured the player. */
export function cpsGuessForLevel(level: number): number {
  if (level <= 11) return 0.35;
  if (level <= 13) return 1.4;
  if (level <= 16) return 3.0;
  return 4.2;
}

const TARGET_PROGRESS = 0.55;
const MAX_SLACK = 5;

export type LevelChange = -1 | 0 | 1;

export class SkillModel {
  state: SkillState;
  private window: ItemResult[] = [];
  private history: ItemResult[] = []; // last ~20 items, for speed estimation
  /** keys introduced at the current level that still need practice */
  newKeyHits: Record<string, number> = {};

  constructor(state: SkillState) {
    this.state = { ...state, keys: { ...state.keys } };
  }

  get level(): Level { return getLevel(this.state.level); }

  /** Words-per-minute over the recent window (standard 5 chars = 1 word). */
  get recentWpm(): number { return wpmOf(this.window.length ? this.window : this.history.slice(-8)); }

  get recentAccuracy(): number { return accuracyOf(this.window.length ? this.window : this.history.slice(-8)); }

  /** Expected seconds for this player to type `chars` characters. */
  expectedSeconds(chars: number): number {
    return chars / Math.max(0.05, this.state.cps);
  }

  minSlack(): number {
    const p = this.level.pressure;
    return 2.3 + (1.3 - 2.3) * p;
  }

  /** Travel time across the sky for a puff, given the work queued ahead of it. */
  travelSeconds(chars: number, queuedAheadChars: number): number {
    const own = this.expectedSeconds(chars);
    const ahead = this.expectedSeconds(queuedAheadChars);
    // Reading time grows with item length; never less than ~2.4s total on screen.
    const read = 0.9 + Math.min(1.6, chars * 0.04);
    return Math.max(2.4, read + this.state.slack * own + ahead * 0.92);
  }

  recordKey(ch: string, correct: boolean): void {
    const k = ch.toLowerCase();
    if (!/^[a-z0-9;',./\- ]$/.test(k)) return;
    const s = (this.state.keys[k] ??= { hits: 0, misses: 0 });
    // Exponential decay so old mistakes fade and current weaknesses dominate.
    s.hits *= 0.97; s.misses *= 0.97;
    if (correct) s.hits += 1; else s.misses += 1;
    if (correct && k in this.newKeyHits) this.newKeyHits[k] += 1;
  }

  /** Error rate 0..1 per key, used to bias content toward weak keys. */
  weakness(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, s] of Object.entries(this.state.keys)) {
      const n = s.hits + s.misses;
      if (n >= 2) out[k] = s.misses / n;
    }
    return out;
  }

  /** Record a finished (or escaped) item. Returns a level change if one is due. */
  record(r: ItemResult): LevelChange {
    this.window.push(r);
    this.history.push(r);
    if (this.history.length > 20) this.history.shift();
    this.updateSpeed(r);
    this.updatePace(r);
    return this.decide();
  }

  private updateSpeed(r: ItemResult): void {
    if (r.escaped || r.ms <= 0) return;
    // Pooled estimate over recent completions is much steadier than per-item EWMA.
    const done = this.history.filter((h) => !h.escaped && h.ms > 0).slice(-10);
    const chars = done.reduce((a, h) => a + h.chars, 0);
    const secs = done.reduce((a, h) => a + h.ms / 1000, 0);
    if (secs <= 0) return;
    const measured = chars / secs;
    // Blend toward measured; faster when we have few samples to quickly fit newcomers.
    const w = done.length < 4 ? 0.6 : 0.35;
    this.state.cps = clamp(this.state.cps + (measured - this.state.cps) * w, 0.03, 20);
  }

  private updatePace(r: ItemResult): void {
    if (this.level.patient) return;
    let s = this.state.slack;
    if (r.escaped) s *= 1.2;
    else s *= Math.exp(0.42 * (r.progress - TARGET_PROGRESS));
    // Mistakes mean you're at your limit: ease off a touch.
    if (!r.escaped && r.wrong > 0) s *= 1 + Math.min(0.08, r.wrong * 0.025);
    this.state.slack = clamp(s, this.minSlack(), MAX_SLACK);
  }

  private decide(): LevelChange {
    const lv = this.level;
    const w = this.window;
    const n = w.length;
    const acc = accuracyOf(w.slice(-8));
    const wpm = wpmOf(w.slice(-8));
    const escapesRecent = w.slice(-4).filter((x) => x.escaped).length;

    // --- step down ---------------------------------------------------------
    if (this.state.level > 1) {
      const prev = getLevel(this.state.level - 1);
      const tooManyEscapes = escapesRecent >= 2;
      const lowAcc = n >= (lv.patient ? 6 : 5) && acc < (lv.patient ? 0.6 : 0.74);
      // Far below the speed that earned this level (e.g. a slow typist placed too high).
      const tooSlow = !lv.patient && n >= 5 && prev.promoteWpm > 0 && wpm < prev.promoteWpm * 0.6;
      if (tooManyEscapes || lowAcc || tooSlow) return this.change(-1);
    }

    // --- step up -----------------------------------------------------------
    if (this.state.level < MAX_LEVEL) {
      const perfect = w.every((x) => !x.escaped && x.wrong === 0);
      const newKeysPracticed = Object.values(this.newKeyHits).every((h) => h >= 2);
      // Fast track: flawless and clearly over the bar.
      if (n >= 3 && perfect && wpm >= Math.max(lv.promoteWpm * 1.5, lv.patient ? 0 : 8) && newKeysPracticed && (!lv.patient || n >= 5)) {
        return this.change(1);
      }
      const need = lv.patient ? 6 : 8;
      if (n >= need && acc >= (lv.patient ? 0.85 : 0.9) && escapesRecent === 0 && wpm >= lv.promoteWpm && newKeysPracticed) {
        return this.change(1);
      }
    }
    return 0;
  }

  private change(d: -1 | 1): LevelChange {
    this.state.level = clamp(this.state.level + d, 1, MAX_LEVEL);
    this.window = [];
    // New content is harder: give breathing room. Stepping down: relax a lot.
    this.state.slack = clamp(this.state.slack * (d > 0 ? 1.12 : 1.3), this.minSlack(), MAX_SLACK);
    return d;
  }

  /** Placement/override (e.g. start of a round warm-up). */
  setLevel(level: number): void {
    this.state.level = clamp(Math.round(level), 1, MAX_LEVEL);
    this.window = [];
    this.state.slack = clamp(this.state.slack, this.minSlack(), MAX_SLACK);
  }
}

export function wpmOf(items: ItemResult[]): number {
  let chars = 0, ms = 0;
  for (const it of items) {
    if (it.escaped || it.ms <= 0) continue;
    chars += it.chars + (it.isLetters ? 0 : 1); // a word "costs" its trailing space in standard WPM
    ms += it.ms;
  }
  return ms > 0 ? (chars / 5) / (ms / 60000) : 0;
}

export function accuracyOf(items: ItemResult[]): number {
  let c = 0, t = 0;
  for (const it of items) { c += it.correct; t += it.correct + it.wrong; }
  return t > 0 ? c / t : 1;
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
