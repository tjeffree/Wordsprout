// Shared colour palette for every procedural art module.
// Outlines use a darker shade of the fill colour, never pure black.

export const INK = '#3d2c4e';
export const CREAM = '#fff8ec';

export const SKY = {
  top: '#8fc8ff',
  mid: '#cfe6ff',
  horizon: '#ffe3c9',
  // Dusk variants used near the end of a round.
  duskTop: '#7b8fe0',
  duskMid: '#d7a8e6',
  duskHorizon: '#ffc2a1',
};

export const HILLS = ['#c3e59a', '#a8d672', '#86c25a', '#6aa84f'];
export const SOIL = '#9b6b4a';
export const SOIL_DARK = '#7a5038';

export const PETALS = {
  coral: { fill: '#ff7a7a', stroke: '#c4525a' },
  butter: { fill: '#ffd45c', stroke: '#c99a22' },
  lilac: { fill: '#b99cff', stroke: '#7d62c9' },
  pink: { fill: '#ff9ec7', stroke: '#cf5f92' },
  mint: { fill: '#7ee0c3', stroke: '#3fa487' },
  tangerine: { fill: '#ffa45c', stroke: '#cc6f2a' },
  sky: { fill: '#8fd0ff', stroke: '#4f93c9' },
  white: { fill: '#fffdf7', stroke: '#c9bba8' },
} as const;

export type PetalColor = keyof typeof PETALS;

export const STEM = { fill: '#6dbb52', stroke: '#4a8a37' };
export const LEAF = { fill: '#86cf63', stroke: '#4a8a37' };

/** Deterministic PRNG (mulberry32) so seeded art looks the same every frame. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** easeOutBack: overshoots slightly, which gives a bouncy feel. */
export const easeOutBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
