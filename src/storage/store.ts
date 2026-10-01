// Local persistence: gardeners (profiles), leaderboard and settings.
// Everything lives in localStorage and is wrapped so a blocked/full storage
// never breaks the game (it just won't remember).

import { DEFAULT_SKILL, cpsGuessForLevel, type SkillState } from '../engine/adaptive';
import type { FlowerKind } from '../art/flowers';
import type { ModeId } from '../game/round';

const KEY = 'wordsprout.v1';

export interface Profile {
  id: string;
  name: string;
  avatar: string;          // emoji
  color: string;           // card tint
  createdAt: number;
  lastPlayed: number;
  skill: SkillState;
  rounds: number;
  bestWpm: number;
  bestScore: number;
  totalFlowers: number;
  discovered: FlowerKind[];
  preferredMode: ModeId;
  /** Little Words: only 2-4 letter lowercase words. */
  littleWords?: boolean;
  /** No capitals: every word and sentence is lowercase, in any game. */
  noCaps?: boolean;
}

export interface ScoreEntry {
  profileId: string;
  name: string;
  avatar: string;
  mode: ModeId;
  score: number;
  wpm: number;
  accuracy: number;
  flowers: number;
  level: number;
  bestCombo: number;
  little?: boolean;
  noCaps?: boolean;
  date: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  volume: number;
  keyboard: 'auto' | 'on' | 'off';
  reducedMotion: boolean;
}

interface Data {
  profiles: Profile[];
  scores: ScoreEntry[];
  settings: Settings;
  currentProfile: string | null;
}

const DEFAULT_SETTINGS: Settings = { sound: true, music: true, volume: 0.8, keyboard: 'auto', reducedMotion: false };

function load(): Data {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<Data>;
      return {
        profiles: Array.isArray(d.profiles) ? d.profiles.filter((p) => p && typeof p === 'object' && typeof p.id === 'string').map(fixProfile) : [],
        scores: Array.isArray(d.scores) ? d.scores.filter((s) => s && typeof s.score === 'number' && typeof s.mode === 'string') : [],
        settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) },
        currentProfile: d.currentProfile ?? null,
      };
    }
  } catch { /* corrupted or blocked */ }
  return { profiles: [], scores: [], settings: { ...DEFAULT_SETTINGS }, currentProfile: null };
}

function fixProfile(p: Profile): Profile {
  return { ...p, skill: { ...DEFAULT_SKILL, ...(p.skill ?? {}), keys: { ...(p.skill?.keys ?? {}) } }, discovered: p.discovered ?? [] };
}

let data: Data = load();

function save(): void {
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export const AVATARS = ['🐰', '🦊', '🐻', '🐼', '🐸', '🦉', '🐱', '🐶', '🦄', '🐢', '🐞', '🦔'];
export const CARD_COLORS = ['#ffd6d6', '#ffe9b8', '#e3d9ff', '#ffd9ec', '#d2f5e9', '#ffe2c7', '#d6ecff'];

export const store = {
  get profiles(): Profile[] { return data.profiles; },
  get settings(): Settings { return data.settings; },
  get current(): Profile | null { return data.profiles.find((p) => p.id === data.currentProfile) ?? null; },

  setCurrent(id: string | null) { data.currentProfile = id; save(); },

  updateSettings(s: Partial<Settings>) { data.settings = { ...data.settings, ...s }; save(); },

  createProfile(name: string, avatar: string, level: number): Profile {
    const p: Profile = {
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim().slice(0, 16) || 'Gardener',
      avatar,
      color: CARD_COLORS[data.profiles.length % CARD_COLORS.length],
      createdAt: Date.now(),
      lastPlayed: Date.now(),
      skill: { ...DEFAULT_SKILL, level, cps: cpsGuessForLevel(level), keys: {} },
      rounds: 0, bestWpm: 0, bestScore: 0, totalFlowers: 0, discovered: [],
      preferredMode: level <= 11 ? 'ten' : 'stroll',
      noCaps: level <= 11,
    };
    data.profiles.push(p);
    data.currentProfile = p.id;
    save();
    return p;
  },

  deleteProfile(id: string) {
    data.profiles = data.profiles.filter((p) => p.id !== id);
    data.scores = data.scores.filter((s) => s.profileId !== id);
    if (data.currentProfile === id) data.currentProfile = null;
    save();
  },

  updateProfile(p: Profile) {
    const i = data.profiles.findIndex((x) => x.id === p.id);
    if (i >= 0) data.profiles[i] = p;
    save();
  },

  /** Adds a score; returns its 1-based rank within the mode (or 0 if not in top 50). */
  addScore(e: ScoreEntry): number {
    data.scores.push(e);
    const ranked = this.leaderboard(e.mode, 'score', 1000);
    // Keep the board tidy: top 50 per mode.
    const keep = new Set<ScoreEntry>();
    for (const m of ['ten', 'stroll', 'sunny', 'summer'] as ModeId[]) {
      for (const s of this.leaderboard(m, 'score', 50)) keep.add(s);
      for (const s of this.leaderboard(m, 'wpm', 50)) keep.add(s);
    }
    data.scores = data.scores.filter((s) => keep.has(s));
    save();
    const r = ranked.indexOf(e);
    return r >= 0 && r < 50 ? r + 1 : 0;
  },

  leaderboard(mode: ModeId, by: 'score' | 'wpm', limit = 10): ScoreEntry[] {
    return data.scores
      .filter((s) => s.mode === mode)
      .sort((a, b) => (by === 'score' ? b.score - a.score || b.wpm - a.wpm : b.wpm - a.wpm || b.accuracy - a.accuracy) || a.date - b.date)
      .slice(0, limit);
  },

  /** Testing hook. */
  _reset() { data = { profiles: [], scores: [], settings: { ...DEFAULT_SETTINGS }, currentProfile: null }; save(); },
  _reload() { data = load(); },
};
