import { describe, expect, it } from 'vitest';
import { Sound, sound } from '../../src/audio/sound';

describe('sound (no AudioContext)', () => {
  it('imports and exposes a singleton', () => {
    expect(sound).toBeInstanceOf(Sound);
    expect(sound.ready).toBe(false);
  });

  it('every method is a silent no-op without throwing', () => {
    const s = new Sound();
    expect(() => {
      s.unlock();
      s.setVolume(0.5);
      s.setVolume(NaN);
      s.muted = true;
      s.muted = false;
      s.musicEnabled = false;
      s.musicEnabled = true;
      s.key(0, 0);
      s.key(12, 40);
      s.wrong();
      s.wordComplete(0, 3);
      s.wordComplete(50, 12);
      s.sprout();
      s.escape();
      s.levelUp();
      s.levelDown();
      s.streak(10);
      s.uiClick();
      s.uiHover();
      s.roundStart();
      s.roundEnd();
      s.startMusic();
      s.stopMusic();
    }).not.toThrow();
    expect(s.ready).toBe(false);
    expect(s.muted).toBe(false);
    expect(s.musicEnabled).toBe(true);
  });
});
