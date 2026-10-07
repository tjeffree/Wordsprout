// Spelling Bee voice: pre-recorded British English clips made by
// scripts/spelling.mjs (public/spelling/*.mp3). One clip plays at a time.
//
// Every clip plays through one shared <audio> element. iOS only lets an element play
// by itself (not from a tap) once a tap has started it, so unlock() plays a moment of
// silence through it from the tap that starts the round; after that it can read each
// word out as it floats in.

import { THIS_WEEK } from '../engine/spelling';

/** This week's spelling words (lowercase): the list for the next test. */
export const SPELLING_WORDS: string[] = THIS_WEEK?.words.map((w) => w.word) ?? [];

const SILENCE = 'data:audio/wav;base64,UklGRqQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

let player: HTMLAudioElement | null = null;
let unlocked = false;
/** Clips fetched ahead of time, as blob: URLs so they start straight away. */
const ready = new Map<string, string>();
const fetching = new Set<string>();

function getPlayer(): HTMLAudioElement {
  if (!player) { player = new Audio(); player.preload = 'auto'; }
  return player;
}

function fetchClip(name: string) {
  if (ready.has(name) || fetching.has(name)) return;
  fetching.add(name);
  fetch(`spelling/${name}.mp3`)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.statusText))))
    .then((b) => { ready.set(name, URL.createObjectURL(b)); })
    .catch(() => { /* say() falls back to the file itself */ })
    .finally(() => fetching.delete(name));
}

export const speech = {
  volume: 0.8,

  /** Call from a tap or key press (e.g. Start) so later clips may play on their own. */
  unlock() {
    if (unlocked) return;
    const a = getPlayer();
    a.src = SILENCE;
    unlocked = true; // a word arriving straight away may interrupt the silence, which is fine
    a.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'NotAllowedError') unlocked = false; // try again on the next tap
    });
  },

  /** Fetch a word's clips ahead of time so they play straight away. */
  preload(word: string) { fetchClip(word); fetchClip(`${word}-say`); },

  /** `full`: the word, a sentence using it, then the word again. Otherwise just the word. */
  say(word: string, full = false) {
    const name = full ? `${word}-say` : word;
    const a = getPlayer();
    a.pause();
    a.src = ready.get(name) ?? `spelling/${name}.mp3`;
    a.volume = this.volume;
    a.play().catch(() => { /* not allowed yet, or missing: the player can press Enter to hear it */ });
  },

  stop() {
    player?.pause();
  },
};
