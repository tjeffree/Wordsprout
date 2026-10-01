// Virtual typists for exercising the adaptive engine.
import { Round, getMode, type ModeId } from '../../src/game/round';
import { DEFAULT_SKILL, type SkillState } from '../../src/engine/adaptive';
import { rng } from '../../src/art/palette';

export interface SimResult {
  round: Round;
  skill: SkillState;
  levels: number[];
  escapes: number;
  completed: number;
  wpm: number;
  accuracy: number;
}

/**
 * Simulates a player with a "true" speed (WPM) and accuracy. Each keystroke takes
 * 60/(wpm*5) seconds with some jitter; a new item needs an extra reaction time.
 */
export function simulate(opts: { wpm: number; accuracy: number; seconds: number; mode?: ModeId; skill?: SkillState; seed?: number }): SimResult {
  const r = rng(opts.seed ?? 7);
  const mode = { ...getMode(opts.mode ?? 'summer'), duration: opts.seconds, flowerGoal: null };
  const round = new Round(opts.skill ?? { ...DEFAULT_SKILL }, mode, r);
  const keyGap = 60 / (opts.wpm * 5);
  const dt = 1 / 60;
  let wait = 0.8;
  let lastTargetId = -1;
  const levels: number[] = [];
  let escapes = 0, completed = 0;
  while (round.phase !== 'done' && round.time < opts.seconds + 5) {
    round.update(dt);
    for (const e of round.drainEvents()) {
      if (e.type === 'escape') escapes++;
      if (e.type === 'complete') completed++;
      if (e.type === 'level') levels.push(e.level.id);
    }
    wait -= dt;
    if (wait <= 0) {
      const ch = round.nextChar;
      if (ch) {
        const tid = round.target?.id ?? -1;
        const newItem = tid !== lastTargetId && round.target === null;
        if (newItem && wait > -0.25 * keyGap) { wait += 0; } // reaction time is folded into jitter
        if (r() < opts.accuracy) round.handleKey(ch);
        else round.handleKey(ch === 'q' ? 'w' : 'q');
        lastTargetId = round.target?.id ?? -1;
        wait = keyGap * (0.6 + r() * 0.8) + (round.target === null ? keyGap * 1.5 : 0);
      } else wait = 0.05;
    }
  }
  return { round, skill: round.snapshot(), levels, escapes, completed, wpm: round.wpm, accuracy: round.accuracy };
}
