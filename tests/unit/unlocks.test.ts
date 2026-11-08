import { describe, it, expect } from 'vitest';
import { ITEMS, itemsFor, progressOf, isUnlocked, unlockedIds, nextUnlock, howToUnlock, key, type Progress } from '../../src/engine/unlocks';
import { HATS, EXTRAS } from '../../src/art/outfits';
import { PUFF_STYLES } from '../../src/art/characters';

const ZERO: Progress = {
  flowers: 0, maxLevel: 1, pbs: 0, bestStreak: 0, spelled: 0, kinds: 0, legendary: 0, mythic: 0,
  bees: 0, firstTime: 0, golden: 0, perfect: 0, letters: 0, days: 0, bestRun: 0,
};

describe('Bumble’s Wardrobe unlocks', () => {
  it('has one item for every hat, extra and puff style there is art for', () => {
    expect(itemsFor('hat').map((i) => i.id)).toEqual([...HATS]);
    expect(itemsFor('extra').map((i) => i.id)).toEqual([...EXTRAS]);
    expect(itemsFor('puff').map((i) => i.id)).toEqual([...PUFF_STYLES]);
    expect(new Set(ITEMS.map(key)).size).toBe(ITEMS.length);
  });

  it('starts with plain Bumble and the dandelion puff', () => {
    expect([...unlockedIds(ZERO)].sort()).toEqual(['extra:none', 'hat:none', 'puff:dandelion']);
  });

  it('unlocks everything just by growing flowers, whatever else happens', () => {
    const most = Math.max(...ITEMS.map((i) => i.flowers));
    expect(most).toBeLessThanOrEqual(3000);
    for (const i of ITEMS) expect(isUnlocked(i, { ...ZERO, flowers: most })).toBe(true);
  });

  it('orders each slot from soonest to latest', () => {
    for (const slot of ['hat', 'extra', 'puff'] as const) {
      const f = itemsFor(slot).map((i) => i.flowers);
      expect(f).toEqual([...f].sort((a, b) => a - b));
    }
  });

  it('lets another goal unlock an item sooner', () => {
    const crown = ITEMS.find((i) => i.id === 'crown')!;
    expect(isUnlocked(crown, { ...ZERO, flowers: 50 })).toBe(false);
    expect(isUnlocked(crown, { ...ZERO, flowers: 50, mythic: 1 })).toBe(true);
    const cap = ITEMS.find((i) => i.id === 'graduation')!;
    expect(isUnlocked(cap, { ...ZERO, spelled: 30 })).toBe(true);
    expect(howToUnlock(cap)).toBe('Grow 250 flowers, or spell 30 words in the Spelling Bee');
  });

  it('has new treasures for a gardener who has everything from the first set', () => {
    const firstSet = { ...ZERO, flowers: 1000, maxLevel: 24, pbs: 9, bestStreak: 50, spelled: 200, kinds: 26, legendary: 5, mythic: 2 };
    const locked = ITEMS.filter((i) => !isUnlocked(i, firstSet));
    for (const slot of ['hat', 'extra', 'puff'] as const) expect(locked.filter((i) => i.slot === slot).length).toBeGreaterThanOrEqual(5);
    // Every one of them can also be won through the Spelling Bee, the stats or the flower collection.
    for (const i of locked) expect(i.alt).toBeDefined();
    expect(nextUnlock(firstSet)).toMatchObject({ item: { id: 'snowflake' }, more: 50 });
    const snow = ITEMS.find((i) => i.id === 'snowflake')!;
    expect(isUnlocked(snow, { ...firstSet, bees: 1 })).toBe(true);
    expect(howToUnlock(snow)).toBe('Grow 1050 flowers, or finish a Spelling Bee');
    expect(howToUnlock(ITEMS.find((i) => i.id === 'wand')!)).toBe('Grow 2400 flowers, or discover every kind of flower');
    expect(howToUnlock(ITEMS.find((i) => i.id === 'backpack')!)).toBe('Grow 2000 flowers, or type 10,000 letters');
  });

  it('points at the nearest locked item', () => {
    expect(nextUnlock(ZERO)).toMatchObject({ item: { id: 'flowercrown' }, more: 20 });
    expect(nextUnlock({ ...ZERO, flowers: 25 })).toMatchObject({ item: { id: 'bowtie' }, more: 10 });
    expect(nextUnlock({ ...ZERO, flowers: 5000 })).toBeNull();
  });

  it('reads a gardener’s progress', () => {
    const pr = progressOf({ totalFlowers: 42, discovered: ['daisy', 'rose', 'starbloom', 'rainbowbloom'], skill: { level: 9 }, maxLevel: 12, pbs: 2 });
    expect(pr).toEqual({ ...ZERO, flowers: 42, maxLevel: 12, pbs: 2, kinds: 4, legendary: 2, mythic: 1 });
    // Stats-based goals read the gardener's stats.
    expect(progressOf({ totalFlowers: 0, discovered: [], skill: { level: 1 }, stats: { bees: 2, firstTime: 30, golden: 4, days: 9, bestRun: 3 } }))
      .toMatchObject({ bees: 2, firstTime: 30, golden: 4, days: 9, bestRun: 3, perfect: 0, letters: 0 });
    // A gardener from before the wardrobe has no maxLevel yet: their current level counts.
    expect(progressOf({ totalFlowers: 0, discovered: [], skill: { level: 7 } }).maxLevel).toBe(7);
  });
});
