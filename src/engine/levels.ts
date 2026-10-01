// The level ladder. Content gets richer as you climb; drift speed is handled
// separately by the pace controller in adaptive.ts, so it fits the player's
// actual speed at every level.

export type ContentKind = 'letters' | 'picture' | 'homerow' | 'short' | 'medium' | 'long' | 'capital' | 'phrase' | 'sentence';

export interface Level {
  id: number;           // 1-based
  name: string;         // shown on the HUD badge
  blurb: string;        // shown in the level-up toast
  mix: Partial<Record<ContentKind, number>>; // weights of content kinds
  letterStage: number;  // highest LETTER_STAGES index unlocked (for letters/homerow content)
  maxActive: number;    // simultaneous puffs
  patient: boolean;     // puffs wait forever (no escaping) — for little learners
  guide: boolean;       // on-screen keyboard shown by default at this level
  /** Speed needed (WPM) to be promoted out of this level. */
  promoteWpm: number;
  /** Pressure 0..1: lower slack (faster drift relative to your speed) as levels rise. */
  pressure: number;
  strictCase: boolean;  // capitals/punctuation matter
}

export const LEVELS: Level[] = [
  { id: 1, name: 'First Keys', blurb: 'Find F and J — they have little bumps!', mix: { letters: 1 }, letterStage: 0, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 2, name: 'Pointer Pals', blurb: 'New keys: D and K', mix: { letters: 1 }, letterStage: 1, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 3, name: 'Busy Fingers', blurb: 'New keys: S and L', mix: { letters: 1 }, letterStage: 2, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 4, name: 'Little Fingers', blurb: 'New key: A', mix: { letters: 1 }, letterStage: 3, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 5, name: 'Home Row', blurb: 'New keys: G and H — the whole home row!', mix: { letters: 0.7, homerow: 0.3 }, letterStage: 4, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 6, name: 'Reaching Up', blurb: 'New keys: E and I', mix: { letters: 0.8, homerow: 0.2 }, letterStage: 5, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 7, name: 'Treetops', blurb: 'New keys: R and U', mix: { letters: 0.8, homerow: 0.2 }, letterStage: 6, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 8, name: 'Tall Trees', blurb: 'New keys: T and Y', mix: { letters: 1 }, letterStage: 7, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 9, name: 'Round O', blurb: 'New keys: O and N', mix: { letters: 1 }, letterStage: 9, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 10, name: 'Every Letter', blurb: 'All the letters are yours!', mix: { letters: 1 }, letterStage: 99, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 11, name: 'Picture Words', blurb: 'Now type whole words!', mix: { picture: 1 }, letterStage: 99, maxActive: 1, patient: true, guide: true, promoteWpm: 0, pressure: 0, strictCase: false },
  { id: 12, name: 'Word Sprouts', blurb: 'Words start to drift — catch them!', mix: { picture: 0.5, short: 0.5 }, letterStage: 99, maxActive: 1, patient: false, guide: true, promoteWpm: 6, pressure: 0.05, strictCase: false },
  { id: 13, name: 'Breezy', blurb: 'Two puffs at once!', mix: { short: 1 }, letterStage: 99, maxActive: 2, patient: false, guide: false, promoteWpm: 12, pressure: 0.15, strictCase: false },
  { id: 14, name: 'Meadow', blurb: 'Longer words bloom here', mix: { short: 0.6, medium: 0.4 }, letterStage: 99, maxActive: 2, patient: false, guide: false, promoteWpm: 18, pressure: 0.25, strictCase: false },
  { id: 15, name: 'Orchard', blurb: 'Three puffs at once!', mix: { short: 0.3, medium: 0.7 }, letterStage: 99, maxActive: 3, patient: false, guide: false, promoteWpm: 24, pressure: 0.35, strictCase: false },
  { id: 16, name: 'Big Names', blurb: 'Capital letters — hold Shift!', mix: { medium: 0.6, capital: 0.4 }, letterStage: 99, maxActive: 3, patient: false, guide: false, promoteWpm: 30, pressure: 0.42, strictCase: true },
  { id: 17, name: 'Wildflowers', blurb: 'Long words ahead', mix: { medium: 0.4, long: 0.4, capital: 0.2 }, letterStage: 99, maxActive: 3, patient: false, guide: false, promoteWpm: 36, pressure: 0.5, strictCase: true },
  { id: 18, name: 'Whispers', blurb: 'Little phrases — spaces count!', mix: { phrase: 0.5, medium: 0.3, long: 0.2 }, letterStage: 99, maxActive: 3, patient: false, guide: false, promoteWpm: 44, pressure: 0.56, strictCase: true },
  { id: 19, name: 'Storybook', blurb: 'Whole sentences, with punctuation!', mix: { sentence: 0.4, phrase: 0.3, long: 0.3 }, letterStage: 99, maxActive: 3, patient: false, guide: false, promoteWpm: 52, pressure: 0.62, strictCase: true },
  { id: 20, name: 'Gale', blurb: 'Four puffs — the wind picks up!', mix: { long: 0.5, medium: 0.3, capital: 0.2 }, letterStage: 99, maxActive: 4, patient: false, guide: false, promoteWpm: 62, pressure: 0.7, strictCase: true },
  { id: 21, name: 'Rainbow Road', blurb: 'Everything at once!', mix: { sentence: 0.3, phrase: 0.2, long: 0.3, capital: 0.2 }, letterStage: 99, maxActive: 4, patient: false, guide: false, promoteWpm: 75, pressure: 0.78, strictCase: true },
  { id: 22, name: 'Starlight', blurb: 'Five puffs. Wow.', mix: { long: 0.5, sentence: 0.3, capital: 0.2 }, letterStage: 99, maxActive: 5, patient: false, guide: false, promoteWpm: 90, pressure: 0.85, strictCase: true },
  { id: 23, name: 'Hummingbird', blurb: 'Faster than a hummingbird!', mix: { long: 0.4, sentence: 0.4, capital: 0.2 }, letterStage: 99, maxActive: 5, patient: false, guide: false, promoteWpm: 110, pressure: 0.92, strictCase: true },
  { id: 24, name: 'Legend of the Garden', blurb: 'The very top of the garden!', mix: { long: 0.4, sentence: 0.4, capital: 0.2 }, letterStage: 99, maxActive: 6, patient: false, guide: false, promoteWpm: Infinity, pressure: 1, strictCase: true },
];

export const MAX_LEVEL = LEVELS.length;

export function getLevel(id: number): Level {
  return LEVELS[Math.max(1, Math.min(MAX_LEVEL, Math.round(id))) - 1];
}

/** Starting levels for the "how do you type?" question when creating a gardener. */
export const PLACEMENTS = [
  { id: 'sprout', level: 1, title: 'Just starting', detail: 'Learning where the letters live', emoji: '🌱' },
  { id: 'bud', level: 11, title: 'I know my letters', detail: 'Ready for little words', emoji: '🌷' },
  { id: 'bloom', level: 13, title: 'I can type', detail: 'Words come easily', emoji: '🌻' },
  { id: 'speedy', level: 16, title: 'I’m speedy', detail: 'Bring on the wind!', emoji: '🐝' },
] as const;
