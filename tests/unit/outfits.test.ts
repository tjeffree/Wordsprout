import { describe, it, expect, beforeAll } from 'vitest';
import { drawBee, drawPuff, puffBurstColors, PUFF_STYLES, type BeeMood } from '../../src/art/characters';
import { HATS, EXTRAS } from '../../src/art/outfits';

// A fake 2D context: every method is a no-op, gradients accept colour stops,
// and every call is counted so we can check something was drawn.
function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: () => number } {
  let n = 0;
  const gradient = { addColorStop: () => undefined };
  const props: Record<string | symbol, unknown> = {};
  const ctx = new Proxy({}, {
    get(_t, k) {
      if (k in props) return props[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createConicGradient') return () => { n++; return gradient; };
      if (k === 'measureText') return () => ({ width: 10 });
      return () => { n++; };
    },
    set(_t, k, v) { props[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls: () => n };
}

beforeAll(() => {
  // drawPuff caches heads on an OffscreenCanvas; node has none, so stub one.
  (globalThis as Record<string, unknown>).OffscreenCanvas = class {
    width: number;
    height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext() { return fakeCtx().ctx; }
  };
});

const MOODS: BeeMood[] = ['idle', 'happy', 'cheer', 'oops', 'sleepy'];

describe('Bumble outfits', () => {
  it('lists the hats and extras in order', () => {
    expect(HATS).toEqual(['none', 'flowercrown', 'party', 'sunhat', 'graduation', 'tophat', 'wizard', 'crown']);
    expect(EXTRAS).toEqual(['none', 'bowtie', 'heartglasses', 'scarf', 'specs', 'cape', 'lei']);
  });

  it('draws every hat and extra in every mood and facing', () => {
    const plain = fakeCtx();
    drawBee(plain.ctx, { x: 50, y: 50, size: 60, time: 1.3, mood: 'idle', facing: 1, tilt: 0.1 });
    for (const hat of HATS) for (const extra of EXTRAS) for (const mood of MOODS) for (const facing of [1, -1] as const) {
      for (const t of [0, 1.3, 7.77]) {
        const f = fakeCtx();
        expect(() => drawBee(f.ctx, { x: 50, y: 50, size: 60, time: t, mood, facing, tilt: 0.1, hat, extra })).not.toThrow();
        if (mood === 'idle' && t === 1.3 && facing === 1) {
          if (hat === 'none' && extra === 'none') expect(f.calls()).toBe(plain.calls());
          else expect(f.calls()).toBeGreaterThan(plain.calls());
        }
      }
    }
  });
});

describe('puff styles', () => {
  it('lists the styles in order', () => {
    expect(PUFF_STYLES).toEqual(['dandelion', 'sparkle', 'bubble', 'balloon', 'cloud', 'rainbow']);
  });

  it('draws every style with target, shake and urgency', () => {
    for (const style of PUFF_STYLES) for (const radius of [14, 30, 54, 90]) {
      for (const target of [0, 1]) for (const shake of [0, 0.7]) for (const urgency of [0, 0.5, 1]) for (const seed of [0, 3.7, 41]) {
        const f = fakeCtx();
        expect(() => drawPuff(f.ctx, { x: 100, y: 100, radius, time: seed + 2.1, seed, target, shake, urgency, style })).not.toThrow();
        expect(f.calls()).toBeGreaterThan(0);
      }
    }
    // no style means the classic dandelion
    const a = fakeCtx();
    const b = fakeCtx();
    drawPuff(a.ctx, { x: 0, y: 0, radius: 40, time: 1, seed: 5, urgency: 0.8 });
    drawPuff(b.ctx, { x: 0, y: 0, radius: 40, time: 1, seed: 5, urgency: 0.8, style: 'dandelion' });
    expect(a.calls()).toBe(b.calls());
  });

  it('gives burst colours for every style but the dandelion', () => {
    expect(puffBurstColors('dandelion')).toBeNull();
    for (const s of PUFF_STYLES) if (s !== 'dandelion') {
      const c = puffBurstColors(s);
      expect(c && c.length).toBeGreaterThan(2);
      for (const col of c!) expect(col).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
