import { it } from 'vitest';
import { simulate } from './sim';
import { DEFAULT_SKILL, cpsGuessForLevel } from '../../src/engine/adaptive';

// Prints adaptation trajectories for a spread of virtual players. Run with DIAG=1.
const start = (level: number) => ({ ...DEFAULT_SKILL, level, cps: cpsGuessForLevel(level), keys: {} });
it.skipIf(!(globalThis as any).process?.env?.DIAG)('kid seeds', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = simulate({ wpm: 1, accuracy: 0.85, seconds: 600, skill: start(1), seed });
    console.log(`seed ${seed}: L${s.skill.level} done ${s.completed} acc ${(s.accuracy * 100).toFixed(0)} levels [${s.levels.join(',')}]`);
  }
});
it.skipIf(!(globalThis as any).process?.env?.DIAG)('diag', () => {
  for (const [wpm, acc, lvl] of [[1, 0.85, 1], [20, 0.95, 20], [20, 0.95, 13], [45, 0.96, 14], [110, 0.98, 13], [70, 0.97, 16], [8, 0.9, 11]]) {
    const s = simulate({ wpm, accuracy: acc, seconds: 300, skill: start(lvl) });
    console.log(`wpm ${wpm} acc ${acc} start ${lvl} -> end L${s.skill.level} levels [${s.levels.join(',')}] done ${s.completed} esc ${s.escapes} measured ${s.wpm.toFixed(1)} acc ${(s.accuracy * 100).toFixed(0)} slack ${s.skill.slack.toFixed(2)} cps ${s.skill.cps.toFixed(2)}`);
  }
});
