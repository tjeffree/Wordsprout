// Spelling Bee voice: pre-recorded British English clips made by
// scripts/spelling.mjs (public/spelling/*.mp3). One clip plays at a time.

import list from '../engine/spelling.json';

/** This week's spelling words (lowercase). */
export const SPELLING_WORDS: string[] = list.words.map((w) => w.word);

let playing: HTMLAudioElement | null = null;
const cache = new Map<string, HTMLAudioElement>();

function clip(name: string): HTMLAudioElement {
  let a = cache.get(name);
  if (!a) {
    a = new Audio(`spelling/${name}.mp3`);
    a.preload = 'auto';
    cache.set(name, a);
  }
  return a;
}

export const speech = {
  volume: 0.8,

  /** Fetch a word's clips ahead of time so they play straight away. */
  preload(word: string) { clip(word); clip(`${word}-say`); },

  /** `full`: the word, a sentence using it, then the word again. Otherwise just the word. */
  say(word: string, full = false) {
    this.stop();
    const a = clip(full ? `${word}-say` : word);
    a.currentTime = 0;
    a.volume = this.volume;
    playing = a;
    a.play().catch(() => { /* not allowed yet, or missing: the player can press Enter to hear it */ });
  },

  stop() {
    if (playing) { playing.pause(); playing = null; }
  },
};
