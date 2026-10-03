import { describe, it, expect } from 'vitest';
import { pickFlowerKind, FLOWER_RARITY, type FlowerKind } from '../../src/art/flowers';

const ALL = Object.keys(FLOWER_RARITY) as FlowerKind[];

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

  it('legendary flowers never appear without a streak', () => {
    for (let i = 0; i < 1000; i++) expect(FLOWER_RARITY[pickFlowerKind(0, (i + 0.5) / 1000)]).toBeLessThan(4);
  });
});
