// Round simulation: puffs, typing, scoring, adaptation. No rendering here, so it
// is deterministic given a random source and can be unit-tested with fake time.

import { SkillModel, type SkillState, type ItemResult } from '../engine/adaptive';
import { ContentPicker, keysNewAt, type LittleOpts } from '../engine/content';
import { getLevel, type ContentKind, type Level } from '../engine/levels';
import { pickFlowerKind, type FlowerKind } from '../art/flowers';

export type ModeId = 'stroll' | 'sunny' | 'summer' | 'ten' | 'endless' | 'spelling';
export interface Mode { id: ModeId; name: string; detail: string; duration: number | null; flowerGoal: number | null; emoji: string }

export const MODES: Mode[] = [
  { id: 'ten', name: 'Ten Flowers', detail: 'No clock. Grow ten flowers at your own pace.', duration: null, flowerGoal: 10, emoji: '🌼' },
  { id: 'stroll', name: 'Morning Stroll', detail: 'A quick one-minute garden.', duration: 60, flowerGoal: null, emoji: '🌤️' },
  { id: 'sunny', name: 'Sunny Day', detail: 'Two minutes from sunrise to sunset.', duration: 120, flowerGoal: null, emoji: '☀️' },
  { id: 'summer', name: 'Long Summer', detail: 'Five minutes: grow a whole meadow.', duration: 300, flowerGoal: null, emoji: '🌻' },
  { id: 'endless', name: 'Forever Garden', detail: 'No clock, no goal. Pause when you want to finish.', duration: null, flowerGoal: null, emoji: '🌈' },
  { id: 'spelling', name: 'Spelling Bee', detail: 'Listen to this week’s words and spell them.', duration: null, flowerGoal: null, emoji: '🐝' },
];

/** Spelling Bee: seconds without typing before the next letter starts to fade in. */
export const HINT_AFTER = 10;
/** Seconds the hint letter takes to fade in fully. */
const HINT_FADE = 4;
/** Wrong guesses at one letter that also bring the hint in. */
const HINT_MISSES = 3;

/** How one spelling word went. */
export interface SpellingResult { word: string; wrong: number; hinted: boolean; retry: boolean }
export const getMode = (id: ModeId) => MODES.find((m) => m.id === id) ?? MODES[0];

export type PuffState = 'fly' | 'pop' | 'escape' | 'leave';

export interface Puff {
  id: number;
  text: string;
  emoji?: string;
  kind: ContentKind;
  typed: number;
  lane: number;
  laneCount: number;
  travel: number;     // seconds to cross the sky
  age: number;        // seconds since spawn
  progress: number;   // 0..1 across the sky
  state: PuffState;
  stateT: number;     // seconds in current state
  shake: number;      // error wobble 0..1 (decays)
  correct: number;
  wrong: number;
  patient: boolean;
  strict: boolean;
  seed: number;
  availableAt: number; // round time this item started "counting" for speed
  flower?: FlowerKind;
  points?: number;
  /** Golden dandelion: double points and a rare flower. */
  golden?: boolean;
  /** Spelling Bee: the word is heard, not shown; letters appear as they're typed. */
  hidden?: boolean;
  /** Spelling Bee: seconds since the last key on this puff. */
  idle?: number;
  /** Spelling Bee: wrong guesses at the current letter. */
  missHere?: number;
  /** Spelling Bee: 0..1 how far the next letter has faded in. */
  hint?: number;
  /** Spelling Bee: a hint was shown for this word. */
  hinted?: boolean;
  /** Spelling Bee: the last wrong letter, shown briefly in its slot. */
  wrongCh?: string;
  wrongT?: number;
  /** Spelling Bee: this is the word's second go. */
  retry?: boolean;
}

export type RoundEvent =
  | { type: 'spawn'; puff: Puff }
  | { type: 'key'; puff: Puff; index: number; ch: string }
  | { type: 'wrong'; puff: Puff | null; expected: string | null; ch: string }
  | { type: 'complete'; puff: Puff; points: number; combo: number; flower: FlowerKind; perfect: boolean }
  | { type: 'escape'; puff: Puff }
  | { type: 'hint'; puff: Puff }
  | { type: 'streak'; combo: number }
  | { type: 'level'; level: Level; dir: 1 | -1; newKeys: string[] }
  | { type: 'ending' }
  | { type: 'end' };

export interface RoundStats {
  score: number;
  correct: number;
  wrong: number;
  wpmChars: number;   // chars counted for WPM (words + implicit space)
  activeMs: number;
  combo: number;
  bestCombo: number;
  flowers: FlowerKind[];
  escapes: number;
  items: number;
  levelStart: number;
  levelPeak: number;
}

const SPAWN_FADE = 0.45;     // seconds a puff takes to "blow in"
const PATIENT_ARRIVE = 1.5;  // seconds for a patient puff to float to its rest spot
const ENDLESS_SKY_PERIOD = 480; // seconds for one morning-afternoon-morning sky loop

export class Round {
  readonly skill: SkillModel;
  readonly mode: Mode;
  puffs: Puff[] = [];
  target: Puff | null = null;
  time = 0;
  phase: 'play' | 'ending' | 'done' = 'play';
  stats: RoundStats;
  focusKeys: string[] = [];
  private events: RoundEvent[] = [];
  private nextId = 1;
  private spawnCooldown = 1.1;
  private lastDoneAt = 0;
  private picker: ContentPicker;
  private endingT = 0;

  readonly little: LittleOpts | null;

  readonly noCaps: boolean;

  /** Spelling Bee: words still to come (missed words come back once at the end). */
  readonly spelling: { total: number; queue: { word: string; retry: boolean }[]; results: SpellingResult[] } | null;

  constructor(skill: SkillState, mode: Mode, private rand: () => number = Math.random, opts: { little?: LittleOpts | null; noCaps?: boolean; spelling?: string[] } = {}) {
    const words = mode.id === 'spelling' ? [...new Set((opts.spelling ?? []).map((w) => w.toLowerCase()))] : [];
    this.spelling = words.length ? { total: words.length, queue: shuffle(words, rand).map((word) => ({ word, retry: false })), results: [] } : null;
    this.noCaps = !!opts.noCaps || !!opts.little || !!this.spelling;
    this.little = opts.little ?? null;
    this.skill = new SkillModel(skill);
    this.mode = mode;
    this.picker = new ContentPicker(rand);
    this.stats = {
      score: 0, correct: 0, wrong: 0, wpmChars: 0, activeMs: 0, combo: 0, bestCombo: 0,
      flowers: [], escapes: 0, items: 0, levelStart: this.skill.state.level, levelPeak: this.skill.state.level,
    };
    this.setFocus(0);
  }

  get level(): Level { return this.skill.level; }

  /** How many puff lanes fit on this screen (set by the app from the layout). */
  laneCap = 99;
  get maxActive(): number { return Math.max(1, Math.min(this.level.maxActive, this.laneCap)); }

  /** 0..1 how far through the "day" we are (drives the sun & sky). */
  get day(): number {
    if (this.mode.duration) return Math.min(1, this.time / this.mode.duration);
    if (this.mode.flowerGoal) return Math.min(1, this.stats.flowers.length / this.mode.flowerGoal);
    if (this.spelling) return Math.min(1, this.spellingDone / this.spelling.total);
    // Endless: the sky drifts gently from morning to afternoon and back.
    if (this.mode.id === 'endless') return 0.1 + 0.35 * (0.5 - 0.5 * Math.cos((this.time / ENDLESS_SKY_PERIOD) * Math.PI * 2));
    return 0;
  }

  /** Spelling Bee: words spelled at least once. */
  get spellingDone(): number { return this.spelling ? this.spelling.results.filter((r) => !r.retry).length : 0; }

  /** Spelling Bee: the tricky words that come back once at the end (done so far, and how many). */
  get spellingRetries(): { done: number; total: number } {
    const res = this.spelling?.results ?? [];
    return { done: res.filter((r) => r.retry).length, total: res.filter((r) => !r.retry && (r.hinted || r.wrong >= 2)).length };
  }

  get timeLeft(): number | null { return this.mode.duration ? Math.max(0, this.mode.duration - this.time) : null; }

  get wpm(): number { return this.stats.activeMs > 0 ? this.stats.wpmChars / 5 / (this.stats.activeMs / 60000) : 0; }
  get accuracy(): number { const t = this.stats.correct + this.stats.wrong; return t ? this.stats.correct / t : 1; }

  /** The character the player should press next (for the keyboard guide). */
  get nextChar(): string | null {
    if (this.target && this.target.state === 'fly') return this.target.text[this.target.typed] ?? null;
    const flying = this.puffs.filter((p) => p.state === 'fly' && p.age >= SPAWN_FADE * 0.5);
    if (!flying.length) return null;
    flying.sort((a, b) => b.progress - a.progress);
    return flying[0].text[0];
  }

  drainEvents(): RoundEvent[] { const e = this.events; this.events = []; return e; }

  private emit(e: RoundEvent) { this.events.push(e); }

  private setFocus(dir: number): void {
    const lv = this.level;
    const prev = getLevel(lv.id - 1);
    const keys = dir >= 0 ? keysNewAt(lv.letterStage, lv.id === 1 ? -1 : prev.letterStage) : [];
    this.focusKeys = keys.length && lv.letterStage < 99 && !this.little ? keys : [];
    this.skill.newKeyHits = Object.fromEntries(this.focusKeys.map((k) => [k, 0]));
  }

  // ---------------------------------------------------------------- input --
  handleKey(raw: string): void {
    if (this.phase !== 'play' || raw.length !== 1) return;
    const t = this.target;
    if (t && t.state === 'fly') {
      const expected = t.text[t.typed];
      if (matches(raw, expected, t.strict)) this.hit(t, expected);
      else if (raw === ' ' && expected !== ' ') return; // stray space: harmless
      else this.miss(t, expected, raw);
      return;
    }
    if (raw === ' ') return;
    // Lock onto the puff (closest to escaping) whose first letter matches.
    const cands = this.puffs.filter((p) => p.state === 'fly' && p.typed === 0 && matches(raw, p.text[0], p.strict));
    if (cands.length) {
      cands.sort((a, b) => b.progress - a.progress);
      this.target = cands[0];
      this.hit(cands[0], cands[0].text[0]);
      return;
    }
    const flying = this.puffs.filter((p) => p.state === 'fly');
    const only = flying.length === 1 ? flying[0] : null;
    this.miss(only, only ? only.text[0] : null, raw);
  }

  /** Backspace: let go of the current target (its progress resets). */
  release(): void {
    // Spelling Bee never takes in a wrong letter, so there is nothing to undo.
    if (this.target?.hidden) return;
    if (this.target && this.target.state === 'fly') this.target.typed = 0;
    this.target = null;
  }

  private hit(p: Puff, expected: string): void {
    p.typed++;
    p.correct++;
    this.stats.correct++;
    this.skill.recordKey(expected, true);
    if (p.hidden) { p.idle = 0; p.missHere = 0; p.hint = 0; p.wrongT = undefined; }
    this.emit({ type: 'key', puff: p, index: p.typed - 1, ch: expected });
    if (p.typed >= p.text.length) this.complete(p);
  }

  private miss(p: Puff | null, expected: string | null, ch: string): void {
    this.stats.wrong++;
    if (p) { p.wrong++; p.shake = 1; }
    if (p?.hidden) { p.idle = 0; p.missHere = (p.missHere ?? 0) + 1; p.wrongCh = ch; p.wrongT = 0; }
    if (expected) this.skill.recordKey(expected, false);
    if (this.stats.combo > 0 && p) this.stats.combo = 0;
    this.emit({ type: 'wrong', puff: p, expected, ch });
  }

  private complete(p: Puff): void {
    p.state = 'pop';
    p.stateT = 0;
    if (this.target === p) this.target = null;
    const perfect = p.wrong === 0;
    this.stats.combo = perfect ? this.stats.combo + 1 : 0;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.stats.combo);
    const lv = this.level;
    const chars = p.text.length;
    const mult = (1 + 0.08 * (lv.id - 1)) * (1 + Math.min(this.stats.combo, 40) * 0.05) * (perfect ? 1.25 : 1);
    const points = Math.round(10 * chars * mult * (p.golden ? 2 : 1));
    p.points = points;
    this.stats.score += points;
    const flower: FlowerKind = p.golden ? pickFlowerKind(30 + this.stats.combo, this.rand()) : p.wrong >= 3 ? 'sprout' : pickFlowerKind(perfect ? this.stats.combo : 0, this.rand());
    p.flower = flower;
    this.stats.flowers.push(flower);
    this.stats.items++;

    const start = Math.max(p.availableAt, this.lastDoneAt);
    const ms = Math.max(150, (this.time - start) * 1000);
    this.lastDoneAt = this.time;
    const isLetters = p.kind === 'letters';
    this.stats.wpmChars += chars + (isLetters ? 0 : 1);
    this.stats.activeMs += ms;

    this.emit({ type: 'complete', puff: p, points, combo: this.stats.combo, flower, perfect });
    if (this.stats.combo > 0 && (this.stats.combo === 5 || this.stats.combo % 10 === 0)) this.emit({ type: 'streak', combo: this.stats.combo });

    this.spawnCooldown = p.patient ? 0.75 : 0.2;
    if (this.spelling) {
      // Spelling doesn't move the typing level. A word that needed help comes back once at the end.
      const sp = this.spelling;
      sp.results.push({ word: p.text, wrong: p.wrong, hinted: !!p.hinted, retry: !!p.retry });
      if (!p.retry && (p.hinted || p.wrong >= 2)) sp.queue.push({ word: p.text, retry: true });
      this.spawnCooldown = 1.4; // let the pop and the flower land before the next word is read out
      if (!sp.queue.length) this.beginEnding();
    } else this.recordItem({ chars, correct: p.correct, wrong: p.wrong, escaped: false, ms, progress: p.patient ? 0.5 : p.progress, isLetters });

    if (this.mode.flowerGoal && this.stats.flowers.length >= this.mode.flowerGoal) this.beginEnding();
  }

  private recordItem(r: ItemResult): void {
    const d = this.skill.record(r);
    if (d !== 0) {
      this.stats.levelPeak = Math.max(this.stats.levelPeak, this.skill.state.level);
      this.setFocus(d);
      this.emit({ type: 'level', level: this.level, dir: d, newKeys: this.focusKeys });
    }
  }

  // --------------------------------------------------------------- update --
  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    if (this.phase === 'done') return;
    this.time += dt;

    for (const p of this.puffs) {
      p.age += dt;
      p.stateT += dt;
      p.shake = Math.max(0, p.shake - dt * 2.8);
      if (p.wrongT !== undefined) p.wrongT += dt;
      if (p.hidden && p.state === 'fly' && this.phase === 'play' && p.age >= PATIENT_ARRIVE) this.updateHint(p, dt);
      if (p.state === 'fly') {
        if (p.patient) p.progress = 0.5 * easeOut(Math.min(1, p.age / PATIENT_ARRIVE));
        else {
          // Typing a puff slows it a touch, which feels responsive and fair.
          const ease = p.typed > 0 ? 0.8 : 1;
          p.progress += (dt / p.travel) * ease;
          if (p.progress >= 1) this.escape(p);
        }
      }
    }
    this.puffs = this.puffs.filter((p) => !(p.state !== 'fly' && p.stateT > 1.6));

    if (this.phase === 'play') {
      if (this.mode.duration && this.time >= this.mode.duration) this.beginEnding();
      else this.maybeSpawn(dt);
    } else if (this.phase === 'ending') {
      this.endingT += dt;
      if (this.endingT > 1.4) { this.phase = 'done'; this.emit({ type: 'end' }); }
    }
  }

  /** Stuck on a letter (a quiet spell, or several wrong guesses): fade the next letter in. */
  private updateHint(p: Puff, dt: number): void {
    p.idle = (p.idle ?? 0) + dt;
    const stuck = p.idle >= HINT_AFTER || (p.missHere ?? 0) >= HINT_MISSES;
    if (!stuck) return;
    const was = p.hint ?? 0;
    p.hint = Math.min(1, was + dt / HINT_FADE);
    if (was === 0) {
      p.hinted = true;
      this.emit({ type: 'hint', puff: p });
    }
  }

  private escape(p: Puff): void {
    p.state = 'escape';
    p.stateT = 0;
    if (this.target === p) this.target = null;
    this.stats.escapes++;
    this.stats.combo = 0;
    this.emit({ type: 'escape', puff: p });
    this.spawnCooldown = Math.min(this.spawnCooldown, 0.3);
    const start = Math.max(p.availableAt, this.lastDoneAt);
    this.recordItem({ chars: p.text.length, correct: p.correct, wrong: p.wrong, escaped: true, ms: (this.time - start) * 1000, progress: 1, isLetters: p.kind === 'letters' });
  }

  /** Wrap up early (how an endless round ends). */
  finish(): void { this.beginEnding(); }

  private beginEnding(): void {
    if (this.phase !== 'play') return;
    this.phase = 'ending';
    this.endingT = 0;
    this.target = null;
    for (const p of this.puffs) if (p.state === 'fly') { p.state = 'leave'; p.stateT = 0; }
    this.emit({ type: 'ending' });
  }

  private maybeSpawn(dt: number): void {
    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0) return;
    const lv = this.level;
    const flying = this.puffs.filter((p) => p.state === 'fly');
    if (this.spelling) {
      if (!flying.length && this.spelling.queue.length) this.spawnSpelling();
      return;
    }
    const maxActive = this.maxActive;
    if (flying.length >= maxActive) return;
    // Remaining work on screen, in characters.
    const queued = flying.reduce((a, p) => a + (p.text.length - p.typed), 0);
    if (flying.length > 0) {
      const typical = this.skill.expectedSeconds(averageLen(flying));
      const remaining = this.skill.expectedSeconds(queued);
      if (remaining > typical * (maxActive - 1) * 0.85 + 0.3) return;
    }
    this.spawn(lv, flying, queued);
  }

  private spawn(lv: Level, flying: Puff[], queued: number): void {
    const avoid = new Set(flying.map((p) => p.text[0].toLowerCase()));
    const item = this.picker.next(lv, { avoidFirst: avoid, weak: this.skill.weakness(), focus: this.focusKeys, little: this.little ?? undefined });
    if (this.noCaps) item.text = item.text.toLowerCase();
    // Pick a lane by vertical position, not index: lane counts can change
    // mid-round (level or screen changes), and indices from different counts
    // can land at the same height.
    const laneCount = Math.max(1, this.maxActive);
    const used = flying.map((p) => laneFraction(p.lane, p.laneCount));
    let best: number[] = [], bestGap = -1;
    for (let i = 0; i < laneCount; i++) {
      const f = laneFraction(i, laneCount);
      const gap = used.length ? Math.min(...used.map((u) => Math.abs(u - f))) : 1;
      if (gap > bestGap + 1e-6) { best = [i]; bestGap = gap; } else if (Math.abs(gap - bestGap) < 1e-6) best.push(i);
    }
    const lane = best[Math.floor(this.rand() * best.length)] ?? 0;
    const p: Puff = {
      id: this.nextId++, text: item.text, emoji: item.emoji, kind: item.kind, typed: 0, lane, laneCount,
      travel: this.skill.travelSeconds(item.text.length, queued), age: 0, progress: 0, state: 'fly', stateT: 0,
      shake: 0, correct: 0, wrong: 0, patient: lv.patient, strict: lv.strictCase && !this.noCaps, seed: Math.floor(this.rand() * 1e6),
      availableAt: this.time + SPAWN_FADE * 0.5,
      golden: this.stats.items >= 4 && !flying.some((f) => f.golden) && this.rand() < (lv.patient ? 0.12 : 0.08),
    };
    this.puffs.push(p);
    this.spawnCooldown = 0.35;
    this.emit({ type: 'spawn', puff: p });
  }

  /** Spelling Bee: one patient puff at a time, carrying a word the player hears but can't see. */
  private spawnSpelling(): void {
    const { word, retry } = this.spelling!.queue.shift()!;
    const p: Puff = {
      id: this.nextId++, text: word, emoji: '🔊', kind: 'short', typed: 0, lane: 0, laneCount: 1,
      travel: 1e9, age: 0, progress: 0, state: 'fly', stateT: 0, shake: 0, correct: 0, wrong: 0,
      patient: true, strict: false, seed: Math.floor(this.rand() * 1e6), availableAt: this.time + SPAWN_FADE * 0.5,
      hidden: true, idle: 0, missHere: 0, hint: 0, retry,
    };
    this.puffs.push(p);
    this.spawnCooldown = 0.35;
    this.emit({ type: 'spawn', puff: p });
  }

  /** Skill snapshot to persist after the round. */
  snapshot(): SkillState { return { ...this.skill.state, keys: { ...this.skill.state.keys } }; }
}

function matches(typed: string, expected: string | undefined, strict: boolean): boolean {
  if (expected === undefined) return false;
  if (typed === expected) return true;
  if (!strict && typed.toLowerCase() === expected.toLowerCase()) return true;
  // Friendly equivalents for curly punctuation from mobile keyboards.
  if (expected === "'" && (typed === '’' || typed === '‘')) return true;
  return false;
}

function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function averageLen(ps: Puff[]): number {
  return ps.reduce((a, p) => a + p.text.length, 0) / Math.max(1, ps.length);
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Vertical position (0 = top, 1 = bottom) of a lane within the sky band. */
export function laneFraction(lane: number, count: number): number {
  return count <= 1 ? 0.4 : lane / (count - 1);
}
