// Bumble's Wardrobe: hats, extras and puff styles that unlock as a gardener plays.
// Every item unlocks by growing enough flowers, so simply playing (any game, the
// Spelling Bee included) always gets there. Many can also unlock sooner through
// another goal: a level, personal bests, a streak, spelling words or rare flowers.

import { FLOWER_RARITY, type FlowerKind } from '../art/flowers';
import type { HatId, ExtraId } from '../art/outfits';
import type { PuffStyle } from '../art/characters';

export type Slot = 'hat' | 'extra' | 'puff';

/** What a gardener has done so far (all only ever go up). */
export interface Progress {
  flowers: number;
  maxLevel: number;
  pbs: number;
  bestStreak: number;
  spelled: number;
  kinds: number;
  legendary: number;
  mythic: number;
}

export interface Goal { stat: Exclude<keyof Progress, 'flowers'>; n: number }

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  emoji: string;
  /** Flowers to grow to unlock it (0 = from the start). */
  flowers: number;
  /** A second way to unlock it sooner. */
  alt?: Goal;
}

const hat = (id: HatId, name: string, emoji: string, flowers: number, alt?: Goal): Item => ({ id, slot: 'hat', name, emoji, flowers, alt });
const extra = (id: ExtraId, name: string, emoji: string, flowers: number, alt?: Goal): Item => ({ id, slot: 'extra', name, emoji, flowers, alt });
const puff = (id: PuffStyle, name: string, emoji: string, flowers: number, alt?: Goal): Item => ({ id, slot: 'puff', name, emoji, flowers, alt });

export const ITEMS: readonly Item[] = [
  hat('none', 'No hat', '🐝', 0),
  hat('flowercrown', 'Flower crown', '🌼', 20),
  hat('party', 'Party hat', '🎉', 60),
  hat('sunhat', 'Sun hat', '👒', 120, { stat: 'bestStreak', n: 10 }),
  hat('graduation', 'Clever cap', '🎓', 250, { stat: 'spelled', n: 30 }),
  hat('tophat', 'Top hat', '🎩', 400, { stat: 'pbs', n: 3 }),
  hat('wizard', 'Wizard hat', '🧙', 600, { stat: 'maxLevel', n: 14 }),
  hat('crown', 'Golden crown', '👑', 1000, { stat: 'mythic', n: 1 }),

  extra('none', 'Nothing', '🐝', 0),
  extra('bowtie', 'Bow tie', '🎀', 35),
  extra('heartglasses', 'Heart glasses', '💖', 90, { stat: 'pbs', n: 1 }),
  extra('scarf', 'Cosy scarf', '🧣', 180, { stat: 'kinds', n: 10 }),
  extra('specs', 'Reading specs', '👓', 300, { stat: 'spelled', n: 50 }),
  extra('cape', 'Super cape', '🦸', 500, { stat: 'maxLevel', n: 10 }),
  extra('lei', 'Flower garland', '🌺', 800, { stat: 'kinds', n: 20 }),

  puff('dandelion', 'Dandelion', '🌬️', 0),
  puff('sparkle', 'Sparkly puff', '✨', 45),
  puff('bubble', 'Bubble', '🫧', 100, { stat: 'spelled', n: 10 }),
  puff('balloon', 'Balloon', '🎈', 160, { stat: 'pbs', n: 2 }),
  puff('cloud', 'Little cloud', '☁️', 350, { stat: 'bestStreak', n: 20 }),
  puff('rainbow', 'Rainbow puff', '🌈', 700, { stat: 'legendary', n: 1 }),
];

export const DEFAULT_OUTFIT = { hat: 'none' as HatId, extra: 'none' as ExtraId, puff: 'dandelion' as PuffStyle };

export function itemsFor(slot: Slot): Item[] { return ITEMS.filter((i) => i.slot === slot); }

export function getItem(slot: Slot, id: string): Item | undefined { return ITEMS.find((i) => i.slot === slot && i.id === id); }

/** The bits of a gardener the wardrobe needs (a Profile fits). */
export interface ProgressSource {
  totalFlowers: number;
  discovered: readonly FlowerKind[];
  skill: { level: number };
  maxLevel?: number;
  pbs?: number;
  bestStreak?: number;
  spelled?: number;
}

export function progressOf(p: ProgressSource): Progress {
  const tiers = p.discovered.map((k) => FLOWER_RARITY[k] ?? 0);
  return {
    flowers: p.totalFlowers,
    maxLevel: Math.max(p.maxLevel ?? 0, p.skill.level),
    pbs: p.pbs ?? 0,
    bestStreak: p.bestStreak ?? 0,
    spelled: p.spelled ?? 0,
    kinds: p.discovered.length,
    legendary: tiers.filter((t) => t >= 3).length,
    mythic: tiers.filter((t) => t >= 4).length,
  };
}

export function isUnlocked(item: Item, pr: Progress): boolean {
  return pr.flowers >= item.flowers || (!!item.alt && pr[item.alt.stat] >= item.alt.n);
}

export function unlockedIds(pr: Progress): Set<string> {
  return new Set(ITEMS.filter((i) => isUnlocked(i, pr)).map(key));
}

/** A stable id across slots (both slots have a 'none'). */
export function key(i: Item): string { return `${i.slot}:${i.id}`; }

export function goalText(g: Goal): string {
  switch (g.stat) {
    case 'maxLevel': return `reach level ${g.n}`;
    case 'pbs': return g.n === 1 ? 'get a personal best' : `get ${g.n} personal bests`;
    case 'bestStreak': return `type ${g.n} words in a row`;
    case 'spelled': return `spell ${g.n} words in the Spelling Bee`;
    case 'kinds': return `discover ${g.n} kinds of flower`;
    case 'legendary': return 'find a Legendary flower';
    case 'mythic': return 'find a Mythic flower';
  }
}

/** How to unlock it, for a locked item: "Grow 60 flowers" or "Grow 120 flowers, or type 10 words in a row". */
export function howToUnlock(i: Item): string {
  const grow = `Grow ${i.flowers} flowers`;
  return i.alt ? `${grow}, or ${goalText(i.alt)}` : grow;
}

/** The locked item that's fewest flowers away, and how many more flowers it needs. */
export function nextUnlock(pr: Progress): { item: Item; more: number } | null {
  let best: { item: Item; more: number } | null = null;
  for (const i of ITEMS) {
    if (isUnlocked(i, pr)) continue;
    const more = i.flowers - pr.flowers;
    if (!best || more < best.more) best = { item: i, more };
  }
  return best;
}
