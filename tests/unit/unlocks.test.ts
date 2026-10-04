import { describe, it, expect } from 'vitest';
import { ITEMS, itemsFor, progressOf, isUnlocked, unlockedIds, nextUnlock, howToUnlock, key, type Progress } from '../../src/engine/unlocks';
import { HATS, EXTRAS } from '../../src/art/outfits';
import { PUFF_STYLES } from '../../src/art/characters';

const ZERO: Progress = { flowers: 0, maxLevel: 1, pbs: 0, bestStreak: 0, spelled: 0, kinds: 0, legendary: 0, mythic: 0 };

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
    expect(most).toBeLessThanOrEqual(1000);
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

  it('points at the nearest locked item', () => {
    expect(nextUnlock(ZERO)).toMatchObject({ item: { id: 'flowercrown' }, more: 20 });
    expect(nextUnlock({ ...ZERO, flowers: 25 })).toMatchObject({ item: { id: 'bowtie' }, more: 10 });
    expect(nextUnlock({ ...ZERO, flowers: 5000 })).toBeNull();
  });

  it('reads a gardener’s progress', () => {
    const pr = progressOf({ totalFlowers: 42, discovered: ['daisy', 'rose', 'starbloom', 'rainbowbloom'], skill: { level: 9 }, maxLevel: 12, pbs: 2 });
    expect(pr).toEqual({ flowers: 42, maxLevel: 12, pbs: 2, bestStreak: 0, spelled: 0, kinds: 4, legendary: 2, mythic: 1 });
    // A gardener from before the wardrobe has no maxLevel yet: their current level counts.
    expect(progressOf({ totalFlowers: 0, discovered: [], skill: { level: 7 } }).maxLevel).toBe(7);
  });
});
