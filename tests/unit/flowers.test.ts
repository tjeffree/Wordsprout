import { describe, it, expect } from 'vitest';
import {
  pickFlowerKind, drawFlower, flowerAnimated, flowerSizeScale,
  FLOWER_RARITY, FLOWER_KINDS, FLOWER_NAMES, TIER_NAMES, type FlowerKind,
} from '../../src/art/flowers';

const ALL = Object.keys(FLOWER_RARITY) as FlowerKind[];

describe('flower collection', () => {
  it('has all 26 kinds, matching the rarity table, each with a name', () => {
    expect(FLOWER_KINDS.length).toBe(26);
    expect(new Set(FLOWER_KINDS).size).toBe(26);
    expect([...FLOWER_KINDS].sort()).toEqual([...ALL].sort());
    for (const k of FLOWER_KINDS) {
      expect(typeof FLOWER_NAMES[k]).toBe('string');
      expect(FLOWER_NAMES[k].length).toBeGreaterThan(0);
    }
    expect(Object.keys(FLOWER_NAMES).sort()).toEqual([...ALL].sort());
  });

  it('is listed in tier order, every tier has a kind, and exactly two are mythic', () => {
    expect(TIER_NAMES.length).toBe(5);
    for (let i = 1; i < FLOWER_KINDS.length; i++) {
      expect(FLOWER_RARITY[FLOWER_KINDS[i]]).toBeGreaterThanOrEqual(FLOWER_RARITY[FLOWER_KINDS[i - 1]]);
    }
    for (let t = 0; t < TIER_NAMES.length; t++) expect(ALL.filter((k) => FLOWER_RARITY[k] === t).length).toBeGreaterThan(0);
    expect(ALL.filter((k) => FLOWER_RARITY[k] === 4).sort()).toEqual(['phoenixbloom', 'rainbowbloom']);
  });

  it('knows which kinds animate and how big each one is', () => {
    expect(ALL.filter(flowerAnimated).sort()).toEqual(
      ['frostlotus', 'goldenlotus', 'moonflower', 'phoenixbloom', 'rainbowbloom', 'starbloom'],
    );
    expect(flowerSizeScale('sprout')).toBe(0.55);
    expect(flowerSizeScale('sunflower')).toBe(1.18);
    for (const k of ALL) expect(flowerSizeScale(k)).toBeGreaterThan(0);
  });
});

describe('flower picking', () => {
  it('every flower in the collection can grow with a good streak', () => {
    const seen = new Set<FlowerKind>();
    for (let i = 0; i < 2000; i++) seen.add(pickFlowerKind(20, (i + 0.5) / 2000));
    expect([...seen].sort()).toEqual([...ALL].sort());
  });

  it('a streak makes rarer flowers more likely', () => {
    const avgRarity = (combo: number) => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += FLOWER_RARITY[pickFlowerKind(combo, (i + 0.5) / 1000)];
      return sum / 1000;
    };
    expect(avgRarity(20)).toBeGreaterThan(avgRarity(0) + 0.5);
  });

  it('mythic flowers never appear without a streak', () => {
    for (let i = 0; i <= 1000; i++) expect(FLOWER_RARITY[pickFlowerKind(0, i / 1000)]).toBeLessThan(4);
  });

  it('is deterministic', () => {
    for (let i = 0; i < 50; i++) expect(pickFlowerKind(7, i / 50)).toBe(pickFlowerKind(7, i / 50));
  });
});

/** A do-nothing 2D context: every method is a no-op, gradients accept colour stops. */
function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const props: Record<string | symbol, unknown> = {};
  const noop = () => {};
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key) {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key in props) return props[key];
      return noop;
    },
    set(_t, key, value) { props[key] = value; return true; },
  });
}

describe('drawing', () => {
  it('draws every kind at every growth stage without throwing', () => {
    const ctx = fakeContext();
    for (const kind of ALL) {
      for (const growth of [0.1, 0.5, 0.8, 1]) {
        for (const still of [true, false]) {
          for (const time of [0, 1.7]) {
            expect(() => drawFlower(ctx, { kind, x: 50, y: 100, size: 80, growth, time, seed: 7 + time * 10, still })).not.toThrow();
          }
        }
      }
    }
  });
});
