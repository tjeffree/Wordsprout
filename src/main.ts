import './ui/styles.css';
import { Renderer } from './game/renderer';
import { Round, MODES, getMode, type Mode, type ModeId, type RoundEvent, type SpellingResult } from './game/round';
import { Bot } from './game/bot';
import { sound } from './audio/sound';
import { speech, SPELLING_WORDS } from './audio/speech';
import { THIS_WEEK } from './engine/spelling';
import { createKeyboard, FINGER_NAME, FINGER_OF } from './ui/keyboard';
import { store, AVATARS, type Profile } from './storage/store';
import { littleName } from './engine/content';
import { getLevel, PLACEMENTS, type Level } from './engine/levels';
import { DEFAULT_SKILL } from './engine/adaptive';
import { drawFlower, FLOWER_KINDS, FLOWER_NAMES, FLOWER_RARITY, TIER_NAMES, type FlowerKind } from './art/flowers';
import { drawBee, drawPuff, type PuffStyle } from './art/characters';
import type { HatId, ExtraId } from './art/outfits';
import { ITEMS, itemsFor, progressOf, isUnlocked, unlockedIds, howToUnlock, nextUnlock, key, type Item, type Slot } from './engine/unlocks';
import { h, icon, fmtTime, timeAgo } from './ui/dom';

// ------------------------------------------------------------------ setup --
const app = document.getElementById('app')!;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const ui = document.getElementById('ui')!;
const kbLayer = document.getElementById('kb-layer')!;
const typeInput = document.getElementById('type-input') as HTMLInputElement;
const live = document.getElementById('sr-live')!;

const renderer = new Renderer(canvas);
const keyboard = createKeyboard(kbLayer);
keyboard.setVisible(false);

type Screen = 'title' | 'profiles' | 'new' | 'modes' | 'play' | 'results' | 'board' | 'settings' | 'wardrobe';
let screen: Screen = 'title';
let round: Round | null = null;
let attract: { round: Round; bot: Bot } | null = null;
let paused = false;
// Phones and tablets: the on-screen keyboard only opens when the hidden input is focused.
const touchDevice = matchMedia('(pointer: coarse)').matches;
// No hardware keyboard seen yet: hide key hints and the keyboard helper.
let touchOnly = touchDevice;
let lastKeyAt = performance.now();
let hint: HTMLElement | null = null;

applySettings();

function applySettings() {
  const s = store.settings;
  sound.muted = !s.sound;
  sound.musicEnabled = s.music;
  sound.setVolume(s.volume);
  speech.volume = s.volume; // the spelling voice ignores "Sound effects": the game needs it
  const rm = s.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.reducedMotion = rm;
  document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
}

// --------------------------------------------------------------- viewport --
function fit() {
  const vv = window.visualViewport;
  const w = Math.round(vv?.width ?? window.innerWidth);
  const hgt = Math.round(vv?.height ?? window.innerHeight);
  app.style.height = hgt + 'px';
  app.style.width = w + 'px';
  if (vv) app.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px)`;
  // visualViewport scroll fires often on mobile; only rebuild when the size changes.
  const dpr = window.devicePixelRatio || 1;
  if (w === lastFit.w && hgt === lastFit.h && dpr === lastFit.dpr) return;
  lastFit = { w, h: hgt, dpr };
  renderer.resize(w, hgt);
}
let lastFit = { w: 0, h: 0, dpr: 0 };
document.fonts?.ready.then(() => renderer.invalidateLabels());
fit();
window.addEventListener('resize', fit);
window.visualViewport?.addEventListener('resize', fit);
window.visualViewport?.addEventListener('scroll', fit);

// -------------------------------------------------------------- the loop --
let last = performance.now();
let fpsAcc = 0, fpsN = 0;
(window as any).__fps = 0;
function frame(now: number) {
  const fStart = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) { (window as any).__fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }

  let active: Round | null = null;
  if (screen === 'play' && hudBottom > 0) renderer.setBandTop(hudBottom + 10);
  else if (screen !== 'title') renderer.setBandTop(null);
  if (screen === 'play' && round) {
    active = round;
    round.laneCap = renderer.laneCapacity;
    if (!paused) {
      round.update(dt);
      handleEvents(round.drainEvents());
    }
    updateHud();
    updateGuide();
  } else if (screen === 'results' && round) {
    active = round;
  } else if (attract && screen === 'title') {
    active = attract.round;
    const act = current?.querySelector('.press-hint');
    if (act) {
      const top = act.getBoundingClientRect().bottom + 16;
      renderer.setBandTop(top);
      // Short screens: no room for the demo puffs under the buttons.
      if (top > renderer.layout.groundY - 110) active = null;
    }
    attract.bot.update(dt);
    attract.round.update(dt);
    const evs = attract.round.drainEvents();
    if (active) renderer.handle(evs, attract.round);
  }
  const day = screen === 'play' || screen === 'results' ? (round?.day ?? 0) : 0.18;
  renderer.interactive = screen === 'title';
  // Keep the sun's face visible beside the title logo rather than behind it.
  const logoStart = screen === 'title' ? current?.querySelector('.logo > span') : null;
  renderer.setSunClearOf(logoStart ? logoStart.getBoundingClientRect().left : null);
  renderer.render(paused ? 0 : dt, active, { day, combo: active?.stats.combo ?? 0 });
  const cursor = renderer.hot ? 'pointer' : '';
  if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  const P = (window as any).__prof;
  if (P) { const d = performance.now() - fStart; (P.hist ??= [0, 0, 0, 0])[d < 4 ? 0 : d < 6 ? 1 : d < 8 ? 2 : 3]++; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- events --
function handleEvents(events: RoundEvent[]) {
  if (!round) return;
  renderer.handle(events, round);
  for (const e of events) {
    switch (e.type) {
      case 'key': sound.key(e.index, round.stats.combo); keyboard.press(e.ch, true); break;
      case 'wrong': sound.wrong(); if (e.expected) keyboard.press(e.ch, false); break;
      case 'complete':
        sound.wordComplete(e.combo, e.puff.text.length);
        if (e.puff.golden) { sound.streak(10); cheer(pick(['Golden!', 'Shiny!', 'Ooh, sparkly!', 'Treasure!'])); }
        live.textContent = `${e.puff.text}. ${round.stats.flowers.length} flowers.`;
        break;
      case 'escape': sound.escape(); break;
      case 'hint':
        // Stuck: say the word again as its next letter starts to fade in.
        speech.say(e.puff.text);
        cheer(pick(['Here’s a clue! ✨', 'A little clue! ✨', 'Look closely! ✨']));
        break;
      case 'streak':
        sound.streak(e.combo);
        cheer(e.combo >= 20 ? pick(['Unbeelievable!', 'Bee-autiful!', 'You’re a legend!']) : pick(['Buzz-tastic!', 'Wonderful!', 'Keep going!', 'Hooray!', 'So good!']));
        break;
      case 'level':
        if (e.dir > 0) sound.levelUp(); else sound.levelDown();
        levelToast(e.level, e.dir, e.newKeys);
        break;
      case 'ending': sound.roundEnd(); break;
      case 'end': finishRound(); break;
      case 'spawn':
        if (e.puff.hidden) {
          if (e.puff.retry && round.spellingRetries.done === 0) cheer('Let’s try the tricky ones again!');
          const word = e.puff.text;
          // Read it out as the puff floats in (and fetch the next one's clips).
          setTimeout(() => { if (round?.puffs.some((p) => p.text === word && p.state === 'fly') && !paused) speech.say(word, true); }, 500);
          const next = round.spelling?.queue[0];
          if (next) speech.preload(next.word);
        }
        break;
    }
  }
}
renderer.onSprout = () => { if (screen === 'play') sound.sprout(); };

// ----------------------------------------------------------------- input --
function onChar(ch: string) {
  lastKeyAt = performance.now();
  clearHint();
  if (screen === 'play' && round && !paused) round.handleKey(ch);
}

window.addEventListener('keydown', (e) => {
  sound.unlock(); speech.unlock();
  const key = typeof e.key === 'string' ? e.key : '';
  // iOS on-screen keyboards send real keys too, so only count keys typed while it's closed.
  if (key.length === 1 && touchOnly && !softKeyboardUp()) touchOnly = false; // a hardware keyboard exists
  const target = e.target as HTMLElement | null;
  const onButton = !!target?.closest?.('button:not(.mode)'); // a selected game card + Enter = start
  if (screen === 'play') {
    if (key === 'Escape') { e.preventDefault(); togglePause(); return; }
    // While paused, a focused button activates natively; otherwise Enter/Space resume.
    if (paused) { if ((key === 'Enter' || key === ' ') && !onButton) { e.preventDefault(); togglePause(); } return; }
    if (key === 'Backspace') { e.preventDefault(); round?.release(); return; }
    if (key === 'Enter' && round?.spelling) { e.preventDefault(); sayAgain(); return; }
    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing) {
      e.preventDefault();
      if (e.repeat) return;
      updateCaps(e);
      onChar(key);
    }
    return;
  }
  // Text fields handle their own keys; focused buttons activate natively.
  if (target?.closest?.('input, textarea')) return;
  if (onButton && (key === 'Enter' || key === ' ')) return;
  menuKey(e);
});

// Touch keyboards: read text from the hidden input (keydown is often "Unidentified").
// Android keyboards hold letters in a "composition" until the word is done, so take each
// new letter as it appears and only clear the field once the composition has finished.
let composing = false;
let consumed = '';
const takeInput = (e?: Event) => {
  const v = typeInput.value;
  const type = (e as InputEvent | undefined)?.inputType ?? '';
  if (type.startsWith('delete')) {
    if (screen === 'play' && !paused) round?.release();
  } else if (v.startsWith(consumed)) {
    for (const ch of v.slice(consumed.length)) onChar(ch);
  }
  consumed = v;
  if (!composing) { typeInput.value = ''; consumed = ''; }
};
typeInput.addEventListener('compositionstart', () => { composing = true; });
typeInput.addEventListener('compositionend', () => { composing = false; takeInput(); });
typeInput.addEventListener('input', takeInput);

canvas.addEventListener('pointerdown', () => {
  sound.unlock();
  if (screen === 'play') focusTyping();
  if (screen === 'play' && !paused) sayAgain();
});
// iOS only opens its keyboard reliably from a click, so focus again once the tap ends.
window.addEventListener('click', (e) => {
  if (screen !== 'play' || paused || !touchDevice) return;
  if ((e.target as HTMLElement | null)?.closest?.('button, input, a')) return;
  focusTyping();
});

/** Spelling Bee: hear the current word again (Enter, the 🔊 button, or a tap on the sky). */
function sayAgain() {
  const p = round?.spelling ? round.puffs.find((q) => q.hidden && q.state === 'fly') : null;
  if (p) speech.say(p.text);
}
window.addEventListener('pointerdown', () => { sound.unlock(); speech.unlock(); }, { capture: true });

// Title-screen play-along: the scene reacts to the pointer (see Renderer).
const scenePoint = (e: PointerEvent) => {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};
window.addEventListener('pointermove', (e) => { const p = scenePoint(e); renderer.pointerMove(p.x, p.y); });
window.addEventListener('pointerdown', (e) => {
  if ((e.target as HTMLElement | null)?.closest?.('button, input, a, .card')) return;
  const p = scenePoint(e);
  renderer.poke(p.x, p.y);
});
const pointerGone = (e: PointerEvent) => { if (e.pointerType !== 'mouse') renderer.pointerLeave(); };
window.addEventListener('pointerup', pointerGone);
window.addEventListener('pointercancel', () => renderer.pointerLeave());
document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) renderer.pointerLeave(); }); // left the window
renderer.onFun = (what) => {
  if (what === 'bee') sound.buzz();
  else if (what === 'sun') sound.sunHello();
  else if (what === 'giggle') sound.giggle();
  else sound.rainbow();
};

function focusTyping() {
  typeInput.focus({ preventScroll: true });
}

/** Is a phone or tablet's on-screen keyboard open? It squashes the visible part of the page. */
function softKeyboardUp() {
  if (!touchDevice || document.activeElement !== typeInput) return false;
  const vv = window.visualViewport;
  return !vv || vv.height < window.innerHeight * 0.85 || vv.height < window.screen.availHeight * 0.7;
}

window.addEventListener('blur', () => { if (screen === 'play' && !paused && round?.phase === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'play' && !paused && round?.phase === 'play') togglePause(); });

let capsEl: HTMLElement | null = null;
function updateCaps(e: KeyboardEvent) {
  const on = e.getModifierState?.('CapsLock') && !!round?.level.strictCase && !round?.noCaps;
  if (on && !capsEl) { capsEl = h('div', { class: 'caps pop-in' }, '⇪ Caps Lock is on'); ui.append(capsEl); }
  else if (!on && capsEl) { capsEl.remove(); capsEl = null; }
}

// ----------------------------------------------------------- screen mgmt --
let current: HTMLElement | null = null;
let menuKey: (e: KeyboardEvent) => void = () => {};

function show(el: HTMLElement, name: Screen, onKey: (e: KeyboardEvent) => void = () => {}) {
  const old = current;
  if (old) { old.classList.add('leaving'); setTimeout(() => old.remove(), 220); }
  current = el;
  screen = name;
  menuKey = onKey;
  applyOutfit();
  ui.append(el);
  const first = el.querySelector<HTMLElement>('[data-autofocus]');
  if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
}

/** Dress Bumble and the puffs in the current gardener's wardrobe choices. */
function applyOutfit(p = store.current) {
  renderer.outfit = { hat: p?.hat ?? 'none', extra: p?.extra ?? 'none', puff: p?.puff ?? 'dandelion' };
}

function startAttract() {
  // Menus always sit over a pretty garden (yours, if you just played).
  if (renderer.flowerCount < 4) renderer.seedGarden(16);
  if (attract) return;
  const mode: Mode = { id: 'stroll', name: 'demo', detail: '', duration: null, flowerGoal: null, emoji: '' };
  const r = new Round({ ...DEFAULT_SKILL, level: 14, cps: 3.4, slack: 2.6 }, mode);
  attract = { round: r, bot: new Bot(r, 42) };
}
function stopAttract() { attract = null; }

function btn(label: string | Node, cls: string, onClick: () => void, extra: Record<string, string | boolean> = {}) {
  return h('button', { class: `btn ${cls}`, type: 'button', ...extra, onclick: () => { sound.uiClick(); onClick(); } }, label);
}

function iconBtn(name: Parameters<typeof icon>[0], label: string, onClick: () => void) {
  return h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, title: label, onclick: () => { sound.uiClick(); onClick(); } }, icon(name));
}

function soundToggle(): HTMLButtonElement {
  const b = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Sound on/off', title: 'Sound on/off' }) as HTMLButtonElement;
  const paint = () => { b.innerHTML = ''; b.append(icon(store.settings.sound ? 'sound' : 'mute')); };
  paint();
  b.onclick = () => { sound.unlock(); store.updateSettings({ sound: !store.settings.sound }); applySettings(); paint(); sound.uiClick(); };
  return b;
}

// ----------------------------------------------------------------- title --
function showTitle() {
  startAttract();
  keyboard.setVisible(false);
  renderer.setBottomInset(0);
  const word = 'Wordsprout';
  const colors = [['#ff7a7a', '#c4525a'], ['#ffa45c', '#cc6f2a'], ['#ffd45c', '#c99a22'], ['#7ee0c3', '#3fa487'], ['#8fd0ff', '#4f93c9'], ['#b99cff', '#7d62c9'], ['#ff9ec7', '#cf5f92']];
  const logo = h('h1', { class: 'logo', 'aria-label': word }, ...[...word].map((c, i) => h('span', { style: `--i:${i};--c:${colors[i % colors.length][0]};--d:${colors[i % colors.length][1]}`, 'aria-hidden': 'true' }, c)));
  const go = () => { sound.unlock(); store.profiles.length ? showProfiles() : showNewProfile(); };
  const el = h('div', { class: 'screen title-screen fade-in' },
    logo,
    h('p', { class: 'tagline' }, 'Every word you type grows a flower 🌷'),
    h('div', { class: 'title-actions' },
      btn('Let’s play!', 'big', go, { 'data-autofocus': true }),
      btn(h('span', {}, '🏆 Leaderboard'), 'ghost small', () => showBoard('title')),
    ),
    h('div', { class: 'press-hint' }, touchOnly ? 'Tap to begin' : h('span', {}, 'Press ', h('kbd', {}, 'Enter'), ' to begin')),
    h('div', { class: 'corner' }, soundToggle(), iconBtn('gear', 'Settings', () => showSettings('title'))),
  );
  show(el, 'title', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
}

// -------------------------------------------------------------- profiles --
function showProfiles() {
  startAttract();
  const grid = h('div', { class: 'profiles rise-in' });
  const sorted = [...store.profiles].sort((a, b) => b.lastPlayed - a.lastPlayed);
  sorted.forEach((p, i) => {
    let confirmDel = false;
    const del = h('button', { class: 'del', type: 'button', 'aria-label': `Remove ${p.name}`, title: 'Remove gardener' }, '✕') as HTMLButtonElement;
    del.onclick = (ev) => {
      ev.stopPropagation();
      if (!confirmDel) { confirmDel = true; del.textContent = 'Sure?'; del.style.width = 'auto'; del.style.padding = '0 8px'; del.style.borderRadius = '14px'; del.style.opacity = '1'; return; }
      store.deleteProfile(p.id); sound.uiClick(); showProfiles();
    };
    grid.append(h('button', { class: 'pcard', type: 'button', style: `--bg:${p.color}`, 'data-autofocus': i === 0, onclick: () => { sound.uiClick(); store.setCurrent(p.id); showModes(); } },
      del,
      h('span', { class: 'av' }, p.avatar),
      h('span', { class: 'nm' }, p.name),
      h('span', { class: 'lv' }, `Level ${p.skill.level} · ${getLevel(p.skill.level).name}`),
    ));
  });
  grid.append(h('button', { class: 'pcard new', type: 'button', onclick: () => { sound.uiClick(); showNewProfile(); } },
    h('span', { class: 'av' }, '+'), h('span', { class: 'nm' }, 'New gardener'), h('span', { class: 'lv' }, 'Start a new garden')));
  const el = h('div', { class: 'screen' }, h('div', { class: 'card pop-in' },
    h('div', { class: 'back' }, iconBtn('back', 'Back', showTitle)),
    h('h2', {}, 'Who’s gardening?'),
    h('p', { class: 'sub' }, 'Pick your garden: each gardener has their own level and flowers.'),
    grid,
  ));
  show(el, 'profiles', (e) => { if (e.key === 'Escape') showTitle(); });
}

function showNewProfile() {
  startAttract();
  let avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  let placement: (typeof PLACEMENTS)[number] = PLACEMENTS[0];
  const name = h('input', { class: 'text-in', maxlength: 16, placeholder: 'Your name', 'aria-label': 'Your name', autocomplete: 'off', 'data-autofocus': !touchOnly }) as HTMLInputElement;
  const avs = h('div', { class: 'avatars', role: 'group', 'aria-label': 'Pick a buddy' });
  const paintAv = () => avs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === avatar)));
  for (const a of AVATARS) avs.append(h('button', { type: 'button', 'aria-label': a, onclick: () => { avatar = a; paintAv(); sound.uiHover(); } }, a));
  paintAv();
  const pls = h('div', { class: 'placements', role: 'group', 'aria-label': 'How do you type?' });
  const paintPl = () => pls.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === placement.id)));
  for (const p of PLACEMENTS) pls.append(h('button', { type: 'button', 'data-id': p.id, onclick: () => { placement = p; paintPl(); sound.uiHover(); } },
    h('span', { class: 'e' }, p.emoji), h('span', {}, h('b', {}, p.title), h('small', {}, p.detail))));
  paintPl();
  const create = () => {
    const p = store.createProfile(name.value, avatar, placement.level);
    void p;
    showModes();
  };
  const el = h('div', { class: 'screen' }, h('div', { class: 'card pop-in' },
    h('div', { class: 'back' }, iconBtn('back', 'Back', () => (store.profiles.length ? showProfiles() : showTitle()))),
    h('h2', {}, 'A new gardener!'),
    h('p', { class: 'sub' }, 'Don’t worry about picking the perfect level. The garden learns how you type and adjusts as you play.'),
    h('div', { class: 'field' }, h('label', {}, 'What’s your name?'), name),
    h('div', { class: 'field' }, h('label', {}, 'Pick a buddy'), avs),
    h('div', { class: 'field' }, h('label', {}, 'How do you type?'), pls),
    h('div', { class: 'row' }, btn('Plant my garden 🌱', 'mint big', create)),
  ));
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } });
  show(el, 'new', (e) => { if (e.key === 'Escape') store.profiles.length ? showProfiles() : showTitle(); });
}

// ----------------------------------------------------------------- modes --
function showModes() {
  startAttract();
  const p = store.current;
  if (!p) return showProfiles();
  // This week's Spelling Bee comes first and is picked to start with, so it's the first thing to play.
  const games = [...MODES].sort((a, b) => +(b.id === 'spelling') - +(a.id === 'spelling'))
    .filter((m) => m.id !== 'spelling' || SPELLING_WORDS.length);
  let mode: ModeId = games[0].id === 'spelling' ? 'spelling' : p.preferredMode;
  if (!games.some((m) => m.id === mode)) mode = games[0].id;
  const lv = getLevel(p.skill.level);
  const grid = h('div', { class: 'modes' });
  const modes = h('div', { class: 'rise-in', role: 'group', 'aria-label': 'Choose a game' });
  const toggles = gardenerToggles(p);
  const paint = () => {
    modes.querySelectorAll<HTMLButtonElement>('.mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === mode)));
    toggles.setSpelling(mode === 'spelling');
  };
  for (const m of games) {
    const best = store.leaderboard(m.id, 'score', 1000).find((s) => s.profileId === p.id);
    const spell = m.id === 'spelling';
    const detail = spell ? `${THIS_WEEK?.name ?? 'This week'}: listen to the ${SPELLING_WORDS.length} words and spell them.` : m.detail;
    const text = [h('b', {}, m.name), h('small', {}, detail), best ? h('span', { class: 'best' }, `Best: ${best.score.toLocaleString()}`) : null];
    const b = h('button', { class: spell ? 'mode spell' : 'mode', type: 'button', 'data-id': m.id, onclick: () => { mode = m.id; paint(); sound.uiHover(); }, ondblclick: () => go() },
      h('span', { class: 'e' }, m.emoji), spell ? h('span', { class: 'txt' }, ...text) : text);
    (spell ? modes : grid).append(b);
  }
  modes.append(grid);
  paint();
  const go = () => { p.preferredMode = mode; store.updateProfile(p); startRound(getMode(mode)); };
  const fresh = newItems(p).length;
  const treasures = ITEMS.filter((i) => i.flowers > 0);
  const owned = treasures.filter((i) => isUnlocked(i, progressOf(p))).length;
  const wardrobe = h('button', { class: 'wardrobe-btn', type: 'button', onclick: () => { sound.uiClick(); showWardrobe(); } },
    beeThumb(p.hat ?? 'none', p.extra ?? 'none', 64, 56),
    h('span', { class: 'txt' },
      h('b', {}, 'Bumble’s Wardrobe'),
      h('small', {}, `🌸 ${p.discovered.length} of ${FLOWER_KINDS.length} flowers · 🎁 ${owned} of ${treasures.length} treasures`)),
    fresh ? h('span', { class: 'new-pill' }, `${fresh} new!`) : null);
  const el = h('div', { class: 'screen' }, h('div', { class: 'card pop-in' },
    h('div', { class: 'back' }, iconBtn('back', 'Switch gardener', showProfiles)),
    h('div', { class: 'who' },
      h('span', { class: 'av' }, p.avatar),
      h('div', { class: 'meta' }, h('b', {}, p.name), h('span', {}, `Level ${lv.id} · ${lv.name}${p.bestWpm ? ` · best ${Math.round(p.bestWpm)} WPM` : ''}`)),
    ),
    wardrobe,
    modes,
    toggles.el,
    h('div', { class: 'row modes-actions', style: 'flex-wrap:nowrap' },
      btn('Start! 🌱', 'big', go, { 'data-autofocus': true }),
      btn('🏆', 'ghost', () => showBoard('modes'), { 'aria-label': 'Leaderboard', title: 'Leaderboard' }),
      btn('⚙️', 'ghost', () => showSettings('modes'), { 'aria-label': 'Settings', title: 'Settings' }),
    ),
    h('p', { class: 'keytip' }, touchDevice ? 'Tip: tap the sky to bring up your keyboard.' : h('span', {}, 'Press ', h('kbd', {}, 'Enter'), ' to start · ', h('kbd', {}, 'Esc'), ' pauses during play')),
  ));
  show(el, 'modes', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); go(); }
    else if (e.key === 'Escape') showProfiles();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const i = games.findIndex((m) => m.id === mode);
      mode = games[(i + (e.key === 'ArrowRight' ? 1 : games.length - 1)) % games.length].id; paint(); sound.uiHover();
    }
  });
}

/**
 * Per-gardener options: Little Words (2-4 letter lowercase words), No capitals (any game) and
 * Slow & Steady (one word waits in the middle). None of them apply to the Spelling Bee.
 */
function gardenerToggles(p: Profile): { el: HTMLElement; setSpelling: (on: boolean) => void } {
  const card = (cls: string, emoji: string, title: string, detail: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = h('button', { class: `little-toggle ${cls}`, type: 'button', role: 'switch' },
      h('span', { class: 'e' }, emoji),
      h('span', { class: 'txt' }, h('b', {}, title), h('small', {}, detail)),
      h('span', { class: 'switch', 'aria-hidden': 'true' })) as HTMLButtonElement;
    const paint = () => {
      b.setAttribute('aria-checked', String(get()));
      b.querySelector('.switch')!.setAttribute('aria-checked', String(get()));
    };
    b.onclick = () => { set(!get()); store.updateProfile(p); paintAll(); sound.uiClick(); };
    return { b, paint };
  };
  const little = card('t-little', '🐣', 'Little Words', '2, 3 and 4 letter words only', () => !!p.littleWords, (v) => { p.littleWords = v; });
  const caps = card('t-caps', '🔡', 'No capitals', 'Everything in lowercase, no Shift needed', () => !!p.noCaps || !!p.littleWords, (v) => { p.noCaps = v; if (!v) p.littleWords = false; });
  const steady = card('t-steady', '🐢', 'Slow & Steady', 'One word at a time waits in the middle', () => !!p.steady, (v) => { p.steady = v; });
  const all = [little, caps, steady];
  const paintAll = () => all.forEach((t) => t.paint());
  paintAll();
  const el = h('div', { class: 'gardener-toggles' }, ...all.map((t) => t.b));
  const setSpelling = (on: boolean) => all.forEach(({ b }) => {
    b.disabled = on;
    b.title = on ? 'Not used in the Spelling Bee' : '';
  });
  return { el, setSpelling };
}

function littleOpts(p: Profile) {
  if (!p.littleWords) return null;
  const own = littleName(p.name);
  return { names: [...new Set(['nova', ...(own ? [own] : [])])] };
}

function flowerThumb(kind: FlowerKind, w: number, hgt: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr; c.height = hgt * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  drawFlower(g, { kind, x: w / 2, y: hgt - 4, size: hgt * 0.86, growth: 1, time: 0, seed: 3 });
  return c;
}

function thumbCanvas(w: number, hgt: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = w * dpr; c.height = hgt * dpr;
  c.style.width = `${w}px`; c.style.height = `${hgt}px`;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  return { c, g };
}

/** Bumble in an outfit, looking at you (t = 0.4 is between blinks). */
function beeThumb(hat: HatId, extra: ExtraId, w: number, hgt: number): HTMLCanvasElement {
  const { c, g } = thumbCanvas(w, hgt);
  // Leave room above for a tall hat and to the left for a cape.
  const size = Math.min(w * 0.56, hgt * 0.6);
  drawBee(g, { x: w / 2 + size * 0.1, y: hgt * 0.62, size, time: 0.4, mood: 'idle', facing: 1, hat, extra });
  return c;
}

function puffThumb(style: PuffStyle, w: number, hgt: number): HTMLCanvasElement {
  const { c, g } = thumbCanvas(w, hgt);
  drawPuff(g, { x: w / 2, y: hgt * 0.44, radius: Math.min(w, hgt) * 0.3, time: 0.4, seed: 5, style });
  return c;
}

function itemThumb(i: Item, w: number, hgt: number): HTMLCanvasElement {
  if (i.slot === 'puff') return puffThumb(i.id as PuffStyle, w, hgt);
  return i.slot === 'hat' ? beeThumb(i.id as HatId, 'none', w, hgt) : beeThumb('none', i.id as ExtraId, w, hgt);
}

/** Wardrobe items unlocked since the gardener last looked. */
function newItems(p: Profile): Item[] {
  const pr = progressOf(p);
  const seen = new Set(p.seenItems ?? []);
  return ITEMS.filter((i) => i.flowers > 0 && isUnlocked(i, pr) && !seen.has(key(i)));
}

// -------------------------------------------------------------- wardrobe --
type WardrobeTab = Slot | 'flowers';
const WARDROBE_TABS: { id: WardrobeTab; label: string }[] = [
  { id: 'hat', label: '🎩 Hats' }, { id: 'extra', label: '🎀 Extras' }, { id: 'puff', label: '🌬️ Puffs' }, { id: 'flowers', label: '🌸 Flowers' },
];

/** Bumble's Wardrobe: dress Bumble, pick what carries the words, and see the flower collection. */
function showWardrobe(from: 'modes' | 'results' = 'modes') {
  if (from !== 'results') startAttract();
  const p = store.current;
  if (!p) return showProfiles();
  const pr = progressOf(p);
  const fresh = new Set(newItems(p).map(key));
  // They've seen them now: next time they're not new.
  p.seenItems = [...unlockedIds(pr)];
  store.updateProfile(p);
  const chosen = (slot: Slot) => (slot === 'hat' ? p.hat ?? 'none' : slot === 'extra' ? p.extra ?? 'none' : p.puff ?? 'dandelion');
  let tab: WardrobeTab = WARDROBE_TABS.find((t) => t.id !== 'flowers' && ITEMS.some((i) => i.slot === t.id && fresh.has(key(i))))?.id ?? 'hat';
  let cheerUntil = 0;

  const stage = h('canvas', { class: 'wardrobe-stage', 'aria-hidden': 'true' }) as HTMLCanvasElement;
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', { class: 'wardrobe-body' });
  const paint = () => {
    tabs.innerHTML = '';
    for (const t of WARDROBE_TABS) {
      const dot = t.id !== 'flowers' && ITEMS.some((i) => i.slot === t.id && fresh.has(key(i)));
      tabs.append(h('button', { class: 'tab', role: 'tab', 'aria-selected': String(t.id === tab), onclick: () => { tab = t.id; sound.uiHover(); paint(); } }, t.label, dot ? h('span', { class: 'dot', 'aria-label': 'new' }) : null));
    }
    body.innerHTML = '';
    body.append(tab === 'flowers' ? flowerCollection(p) : itemGrid(tab));
  };
  const itemGrid = (slot: Slot) => {
    const grid = h('div', { class: 'items rise-in' });
    for (const i of itemsFor(slot)) {
      const open = isUnlocked(i, pr);
      const name = h('b', {}, i.name);
      if (!open) {
        const pct = Math.min(100, Math.round((pr.flowers / i.flowers) * 100));
        grid.append(h('div', { class: 'item locked', title: howToUnlock(i) },
          itemThumb(i, 96, 78), name,
          h('small', {}, `🔒 ${howToUnlock(i)}`),
          h('span', { class: 'meter', 'aria-label': `${pr.flowers} of ${i.flowers} flowers` }, h('span', { style: `width:${pct}%` }))));
        continue;
      }
      grid.append(h('button', {
        class: 'item', type: 'button', 'aria-pressed': String(chosen(slot) === i.id),
        onclick: () => {
          if (slot === 'hat') p.hat = i.id as HatId; else if (slot === 'extra') p.extra = i.id as ExtraId; else p.puff = i.id as PuffStyle;
          store.updateProfile(p); applyOutfit(p); sound.uiClick();
          cheerUntil = performance.now() + 1200;
          paint();
        },
      }, itemThumb(i, 96, 78), name, fresh.has(key(i)) ? h('span', { class: 'new-pill' }, 'New!') : null));
    }
    return grid;
  };

  const back = () => showModes();
  const el = h('div', { class: 'screen' }, h('div', { class: 'card pop-in wardrobe', style: 'max-width:820px' },
    h('div', { class: 'back' }, iconBtn('back', 'Back', back)),
    h('h2', {}, '🎀 Bumble’s Wardrobe'),
    h('p', { class: 'sub' }, 'Every flower you grow brings new treasures!'),
    stage, tabs, body));
  paint();
  show(el, 'wardrobe', (e) => {
    if (e.key === 'Escape') back();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = WARDROBE_TABS.findIndex((t) => t.id === tab);
      tab = WARDROBE_TABS[(n + (e.key === 'ArrowRight' ? 1 : WARDROBE_TABS.length - 1)) % WARDROBE_TABS.length].id;
      sound.uiHover(); paint();
    }
  });

  // The preview: Bumble in the chosen outfit beside a puff carrying the gardener's name.
  const g = stage.getContext('2d')!;
  const drawStage = (now: number) => {
    if (current !== el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = stage.clientWidth, hgt = stage.clientHeight;
    if (stage.width !== Math.round(w * dpr) || stage.height !== Math.round(hgt * dpr)) { stage.width = Math.round(w * dpr); stage.height = Math.round(hgt * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    const t = now / 1000;
    const size = Math.min(hgt * 0.5, w * 0.2);
    const bx = w * 0.32 + Math.sin(t * 0.8) * w * 0.03, by = hgt * 0.56 + Math.sin(t * 1.6) * hgt * 0.04;
    drawBee(g, { x: bx, y: by, size, time: t, mood: now < cheerUntil ? 'cheer' : 'idle', facing: 1, tilt: Math.cos(t * 0.8) * 0.06, hat: p.hat ?? 'none', extra: p.extra ?? 'none' });
    const r = Math.min(hgt * 0.2, 40), px = w * 0.68, py = hgt * 0.34;
    drawPuff(g, { x: px, y: py, radius: r, time: t, seed: 9, style: p.puff ?? 'dandelion' });
    stageTag(g, p.name, px, py + r * 1.02, Math.max(15, Math.min(24, hgt * 0.12)));
    requestAnimationFrame(drawStage);
  };
  requestAnimationFrame(drawStage);
}

/** The word tag that hangs under a puff (a simple version of the in-game one). */
function stageTag(g: CanvasRenderingContext2D, text: string, cx: number, top: number, font: number) {
  g.font = `700 ${font}px 'Andika', 'Fredoka', system-ui, sans-serif`;
  const w = g.measureText(text).width + font * 0.84, hgt = font * 1.5;
  g.strokeStyle = 'rgba(122, 96, 140, 0.45)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx, top - font * 0.35); g.lineTo(cx, top + 2); g.stroke();
  g.beginPath(); g.roundRect(cx - w / 2, top, w, hgt, hgt / 2);
  g.fillStyle = 'rgba(255, 250, 240, 0.95)'; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(185, 156, 210, 0.7)'; g.stroke();
  g.fillStyle = '#3d2c4e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cx, top + hgt / 2 + font * 0.04);
}

/** Every flower, by rarity: the ones not found yet are shadows with a "?". */
function flowerCollection(p: Profile): HTMLElement {
  const wrap = h('div', { class: 'tiers rise-in' });
  TIER_NAMES.forEach((tierName, tier) => {
    const kinds = FLOWER_KINDS.filter((k) => FLOWER_RARITY[k] === tier);
    const found = kinds.filter((k) => p.discovered.includes(k));
    wrap.append(h('section', { class: `tier tier-${tier}` },
      h('div', { class: 'tier-head' }, h('b', {}, tierName), h('small', {}, `${found.length} of ${kinds.length}`)),
      h('div', { class: 'tier-grid' }, ...kinds.map((k) => {
        const has = p.discovered.includes(k);
        const c = flowerThumb(k, 56, 66);
        if (!has) c.classList.add('locked');
        return h('div', { class: `flower${has ? '' : ' locked'}`, title: has ? FLOWER_NAMES[k] : 'Not found yet' }, h('span', { class: 'pic' }, c), h('span', {}, has ? FLOWER_NAMES[k] : '?'));
      }))));
  });
  return wrap;
}

// ------------------------------------------------------------------ play --
let hud: { root: HTMLElement; lvl: HTMLElement; fill: HTMLElement; sun: HTMLElement; dayLabel: HTMLElement; score: HTMLElement; wpm: HTMLElement; acc: HTMLElement; streak: HTMLElement; streakN: HTMLElement } | null = null;
const hudCache: Record<string, string> = {};
let hudObserver: ResizeObserver | null = null;
let hudBottom = 0;

function startRound(mode: Mode) {
  const p = store.current;
  if (!p) return;
  stopAttract();
  sound.unlock(); speech.unlock();
  if (touchDevice) focusTyping();
  renderer.clearGarden();
  // The gardener toggles don't apply to the Spelling Bee (it's always lowercase, one word at a time).
  const typing = mode.id !== 'spelling';
  round = new Round(p.skill, mode, Math.random, { little: typing ? littleOpts(p) : null, noCaps: typing && !!p.noCaps, steady: typing && !!p.steady, spelling: SPELLING_WORDS });
  if (round.spelling) speech.preload(round.spelling.queue[0].word);
  paused = false;
  lastKeyAt = performance.now();
  for (const k in hudCache) delete hudCache[k];

  const lvl = h('div', { class: 'pill lvl' });
  const fill = h('div', { class: 'fill' });
  const sun = h('div', { class: 'sun' });
  const dayLabel = h('div', { class: 'pill daylabel' });
  const score = h('b', {}, '0'), wpm = h('b', {}, '0'), acc = h('b', {}, '100%');
  const streakN = h('span', { class: 'n' }, '0');
  const streak = h('div', { class: 'pill streak' }, '🌸 ', streakN, ' in a row!');
  const root = h('div', { class: 'hud fade-in' },
    h('div', { class: 'hud-top' },
      h('div', { class: 'hud-left' }, h('div', { class: 'pill who-pill' }, h('span', { class: 'av' }, p.avatar), h('span', { class: 'nm' }, p.name)), lvl),
      // Endless rounds have no day to get through, so no day bar.
      h('div', { class: 'hud-center' }, mode.id === 'endless' ? null : h('div', { class: 'daybar', 'aria-hidden': 'true' }, fill, sun), h('div', { class: 'hud-sub' }, dayLabel, streak)),
      h('div', { class: 'hud-right' },
        h('div', { class: 'pill stats' },
          h('div', { class: 'stat score' }, score, h('small', {}, 'score')),
          h('div', { class: 'stat' }, wpm, h('small', {}, 'wpm')),
          h('div', { class: 'stat acc' }, acc, h('small', {}, 'accuracy'))),
        round.spelling ? iconBtn('sound', 'Hear the word again (Enter)', sayAgain) : null,
        touchDevice ? iconBtn('keyboard', 'Show the keyboard', focusTyping) : null,
        iconBtn('pause', 'Pause', togglePause)),
    ),
  );
  root.classList.add('passthrough');
  // Keep puffs clear of the HUD, whatever its height on this screen.
  const top = root.querySelector('.hud-top')!;
  hudObserver?.disconnect();
  hudObserver = new ResizeObserver(() => { hudBottom = top.getBoundingClientRect().bottom; });
  hudObserver.observe(top);
  hud = { root, lvl, fill, sun, dayLabel, score, wpm, acc, streak, streakN };
  show(root, 'play');
  sound.roundStart();
  // Spelling Bee: no music, so the words are easy to hear.
  if (!round.spelling) sound.startMusic();
  updateGuide(true);
}

function updateHud() {
  if (!hud || !round) return;
  const r = round;
  set('lvl', r.spelling ? '🐝<span class="lvn"> Spelling Bee</span>' : `Lv <b>${r.level.id}</b><span class="lvn"> · ${r.little ? '🐣 Little Words' : r.level.name}</span>`, (v) => (hud!.lvl.innerHTML = v));
  const day = r.day;
  set('day', day.toFixed(3), () => {
    const pct = (day * 100).toFixed(1);
    hud!.fill.style.width = `calc(${pct}% - ${day * 6}px)`;
    hud!.sun.style.left = `calc(${pct}% + ${15 - day * 30}px)`;
  });
  const n = r.stats.flowers.length;
  const tricky = r.spelling && r.spellingDone >= r.spelling.total ? r.spellingRetries : null;
  const label = tricky?.total ? `🐝 Tricky words: ${Math.min(tricky.done + 1, tricky.total)} of ${tricky.total}`
    : r.spelling ? `🐝 ${r.spellingDone} of ${r.spelling.total} words`
    : r.mode.flowerGoal ? `🌼 ${Math.min(n, r.mode.flowerGoal)} of ${r.mode.flowerGoal} flowers`
    : r.mode.duration ? `${fmtTime(Math.ceil(r.timeLeft ?? 0))} left`
      : `🌈 ${n} flower${n === 1 ? '' : 's'} · ${fmtTime(Math.floor(r.time))}`;
  set('daylabel', label, (v) => (hud!.dayLabel.textContent = v));
  set('score', r.stats.score.toLocaleString(), (v) => (hud!.score.textContent = v));
  set('wpm', String(Math.round(r.wpm)), (v) => (hud!.wpm.textContent = v));
  set('acc', `${Math.round(r.accuracy * 100)}%`, (v) => (hud!.acc.textContent = v));
  const c = r.stats.combo;
  set('combo', String(c), () => {
    hud!.streak.classList.toggle('on', c >= 3);
    hud!.streakN.textContent = String(c);
    hud!.streak.classList.remove('bump');
    void hud!.streak.offsetWidth;
    if (c >= 3) hud!.streak.classList.add('bump');
  });
}

function set(key: string, v: string, apply: (v: string) => void) {
  if (hudCache[key] === v) return;
  hudCache[key] = v;
  apply(v);
}

let guideShown = false;
let lastHighlight: string | null | undefined;
function updateGuide(force = false) {
  if (!round) return;
  const s = store.settings.keyboard;
  // Never alongside the device's own keyboard, and in "auto" only when the sky has room for it.
  const room = s === 'on' || renderer.layout.h >= 560;
  const want = !touchOnly && !softKeyboardUp() && room && (s === 'on' || (s === 'auto' && round.level.guide)) && round.phase === 'play';
  if (want !== guideShown || force) {
    guideShown = want;
    keyboard.setVisible(want);
    lastHighlight = undefined;
  }
  keyboard.setHandsVisible(want && !!hint);
  const board = keyboard.el.querySelector('.kb-board') ?? keyboard.el;
  const kr = board.getBoundingClientRect();
  renderer.setBottomInset(want ? renderer.layout.h - kr.top + 4 : 0);
  renderer.setAvoid(want ? [kr.left - 30, kr.right + 30] : null);
  if (want) {
    // Spelling Bee: the keyboard only lights the key once the hint has mostly faded in.
    const sp = round.spelling ? round.puffs.find((q) => q.hidden && q.state === 'fly') : null;
    const ch = !round.spelling ? round.nextChar : sp && (sp.hint ?? 0) >= 0.6 ? sp.text[sp.typed] : null;
    if (ch !== lastHighlight) { keyboard.highlight(ch); lastHighlight = ch; }
  }
  // Gentle nudge for little learners who are stuck.
  if ((round.level.patient || round.steady) && !round.spelling && !hint && !paused && performance.now() - lastKeyAt > 8000 && round.nextChar) {
    const ch = round.nextChar;
    const finger = FINGER_OF[ch.toLowerCase()];
    showHint(ch === ' ' ? 'Press the long space bar!' : `Find the <kbd>${ch.toUpperCase()}</kbd> key${finger ? ` (${FINGER_NAME[finger]})` : ''}!`);
  }
  for (const el of [hint, cheerEl]) {
    if (!el) continue;
    const b = renderer.beePos;
    const half = el.offsetWidth / 2 + 8;
    el.style.left = `${Math.max(half, Math.min(renderer.layout.w - half, b.x))}px`;
    el.style.top = `${Math.max(b.y - 40, hudBottom + 56)}px`;
  }
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** Bumble says something nice for a moment (never over a hint). */
let cheerEl: HTMLElement | null = null;
let cheerTimer = 0;
function cheer(text: string) {
  if (hint) return;
  cheerEl?.remove();
  cheerEl = h('div', { class: 'bubble cheer' }, text);
  ui.append(cheerEl);
  clearTimeout(cheerTimer);
  cheerTimer = window.setTimeout(() => { cheerEl?.remove(); cheerEl = null; }, 1500);
}

function showHint(html: string) {
  clearHint();
  hint = h('div', { class: 'bubble', html });
  ui.append(hint);
}
function clearHint() { if (hint) { hint.remove(); hint = null; lastKeyAt = performance.now(); } }

function levelToast(level: Level, dir: 1 | -1, newKeys: string[]) {
  const keys = newKeys.map((k) => `<kbd>${k.toUpperCase()}</kbd>`).join(' ');
  const little = !!round?.little;
  const prev = getLevel(level.id - 1);
  const littleBlurb = level.patient ? 'You’re getting so good at this! 🌟'
    : level.maxActive > prev.maxActive ? `${level.maxActive} puffs at once!`
      : prev.patient ? 'Words start to drift. Catch them!' : 'The breeze picks up a little!';
  const noCapsBlurb = round?.noCaps && level.strictCase ? level.blurb.replace(/Capital letters.*$/, 'Names of friends and places!') : level.blurb;
  const t3 = dir > 0 ? (little ? littleBlurb : round?.noCaps && level.strictCase && newKeys.length === 0 ? noCapsBlurb : newKeys.length && level.letterStage < 99 ? `New keys: ${keys}` : level.blurb) : 'No rush. You’re doing great! 🍃';
  const el = h('div', { class: `toast${dir < 0 ? ' down' : ''}`, role: 'status' },
    h('div', { class: 'inner' },
      h('div', { class: 't1' }, dir > 0 ? `Level up! ⭐ Level ${level.id}` : `Let’s take it gently · Level ${level.id}`),
      h('div', { class: 't2' }, little ? 'Little Words' : level.name),
      h('div', { class: 't3', html: t3 })));
  ui.append(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

function togglePause() {
  if (screen !== 'play' || !round) return;
  paused = !paused;
  if (paused) {
    clearHint();
    sound.stopMusic();
    speech.stop();
    const el = h('div', { class: 'screen dim fade-in', id: 'pause' }, h('div', { class: 'card pop-in', style: 'max-width:440px' },
      h('h2', {}, 'Paused'),
      h('p', { class: 'sub' }, 'Bumble is having a little rest 🐝'),
      h('div', { class: 'row', style: 'flex-direction:column' },
        btn('Keep going', 'mint big', togglePause, { 'data-autofocus': true }),
        round.mode.id === 'endless' && round.stats.items > 0 ? btn('All done! 🌷', 'big', finishEndless) : null,
        btn('Leave the garden', 'ghost small', () => { paused = false; typeInput.blur(); document.getElementById('pause')?.remove(); keyboard.setVisible(false); guideShown = false; round = null; capsEl?.remove(); capsEl = null; cheerEl?.remove(); cheerEl = null; showModes(); }),
      )));
    ui.append(el);
    setTimeout(() => el.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 30);
  } else {
    document.getElementById('pause')?.remove();
    if (round.spelling) sayAgain(); else sound.startMusic();
    if (touchDevice) focusTyping();
    lastKeyAt = performance.now();
  }
}

function finishEndless() {
  if (!round) return;
  togglePause();
  round.finish();
}

// --------------------------------------------------------------- results --
function finishRound() {
  if (!round) return;
  const p = store.current;
  const r = round;
  keyboard.setVisible(false);
  guideShown = false;
  renderer.setBottomInset(0);
  clearHint();
  cheerEl?.remove(); cheerEl = null;
  typeInput.blur();
  if (capsEl) { capsEl.remove(); capsEl = null; }
  sound.stopMusic();
  speech.stop();
  if (!p) return showTitle();

  const s = r.stats;
  const wpm = r.wpm;
  const accuracy = r.accuracy;
  const pbWpm = s.wpmChars >= 25 && wpm > p.bestWpm;
  const modeBest = Math.max(0, ...store.leaderboard(r.mode.id, 'score', 1000).filter((x) => x.profileId === p.id).map((x) => x.score));
  const pbScore = s.score > modeBest;
  const firstInMode = modeBest === 0;
  const newKinds = [...new Set(s.flowers)].filter((k) => !p.discovered.includes(k));
  const levelEnd = r.skill.state.level;
  const hadBefore = unlockedIds(progressOf(p));
  p.skill = r.snapshot();
  p.rounds++;
  p.lastPlayed = Date.now();
  if (pbWpm) p.bestWpm = wpm;
  if (s.score > p.bestScore) p.bestScore = s.score;
  p.totalFlowers += s.flowers.length;
  p.discovered = [...p.discovered, ...newKinds];
  // Progress towards Bumble's Wardrobe. Personal bests count as the results card shows them.
  p.maxLevel = Math.max(p.maxLevel ?? 0, s.levelPeak, levelEnd);
  p.pbs = (p.pbs ?? 0) + (pbScore && !firstInMode ? 1 : 0) + (pbWpm && p.rounds > 1 ? 1 : 0);
  p.bestStreak = Math.max(p.bestStreak ?? 0, s.bestCombo);
  p.spelled = (p.spelled ?? 0) + (r.spelling?.results.length ?? 0);
  const progress = progressOf(p);
  const unlocked = ITEMS.filter((i) => !hadBefore.has(key(i)) && isUnlocked(i, progress));
  const next = nextUnlock(progress);
  store.updateProfile(p);
  const rank = s.items > 0 ? store.addScore({ profileId: p.id, name: p.name, avatar: p.avatar, mode: r.mode.id, score: s.score, wpm, accuracy, flowers: s.flowers.length, level: levelEnd, bestCombo: s.bestCombo, little: !!r.little, noCaps: r.noCaps && !r.little && !r.spelling, steady: r.steady, date: Date.now() }) : 0;

  const stars = s.items === 0 ? 0 : 1 + (accuracy >= 0.9 ? 1 : 0) + (accuracy >= 0.96 && s.escapes <= 1 ? 1 : 0);
  const titles = [['A garden begins!', 'Every gardener starts somewhere 🌱'], ['Lovely garden!', 'Look at all those flowers!'], ['Blooming marvellous!', 'Bumble is doing happy loops!'], ['A perfect meadow!', 'Simply splendid typing ✨']];
  const [title, sub] = titles[stars];
  const lvlBadge = levelEnd > s.levelStart
    ? h('span', { class: 'badge mint' }, `⬆️ Level ${s.levelStart} → ${levelEnd}: ${getLevel(levelEnd).name}`)
    : levelEnd < s.levelStart ? h('span', { class: 'badge' }, `🍃 Level ${levelEnd}: ${getLevel(levelEnd).name}`)
      : h('span', { class: 'badge' }, `🌿 Level ${levelEnd}: ${getLevel(levelEnd).name}`);
  const badges = h('div', { class: 'badges rise-in' },
    r.spelling ? null : lvlBadge, // spelling doesn't move the typing level
    rank > 0 && rank <= 10 ? h('span', { class: 'badge butter' }, `🏆 #${rank} on ${r.mode.name}`) : null,
    newKinds.length === 1 ? h('span', { class: `badge butter tier-${FLOWER_RARITY[newKinds[0]]}` }, flowerThumb(newKinds[0], 26, 32), `New ${FLOWER_RARITY[newKinds[0]] >= 2 ? TIER_NAMES[FLOWER_RARITY[newKinds[0]]] + ' ' : ''}flower: ${FLOWER_NAMES[newKinds[0]]}!`) : null,
    newKinds.length > 1 ? h('span', { class: 'badge butter', title: newKinds.map((k) => FLOWER_NAMES[k]).join(', ') }, ...newKinds.slice(0, 8).map((k) => flowerThumb(k, 22, 28)), `${newKinds.length} new flowers!`) : null,
    unlocked.length === 1 ? h('span', { class: 'badge lilac' }, itemThumb(unlocked[0], 30, 28), `New for Bumble: ${unlocked[0].name}!`) : null,
    unlocked.length > 1 ? h('span', { class: 'badge lilac', title: unlocked.map((i) => i.name).join(', ') }, ...unlocked.slice(0, 5).map((i) => itemThumb(i, 30, 28)), `${unlocked.length} new treasures for Bumble!`) : null,
  );
  // What's next: a little goal to keep growing towards.
  const nextLine = !unlocked.length && next ? h('p', { class: 'next-unlock' }, itemThumb(next.item, 30, 28), `${next.more} more flower${next.more === 1 ? '' : 's'} until the ${next.item.name} 🎁`) : null;
  const num = (label: string, value: string, opts: { hl?: boolean; pb?: boolean } = {}) =>
    h('div', { class: `bignum${opts.hl ? ' hl' : ''}` }, h('b', {}, value), h('small', {}, label), opts.pb ? h('div', {}, h('span', { class: 'pb' }, 'PERSONAL BEST')) : null);
  const again = () => startRound(r.mode);
  const el = h('div', { class: 'screen results' }, h('div', { class: 'card pop-in' },
    h('div', { class: 'stars', 'aria-label': `${stars} of 3 stars` }, ...[0, 1, 2].map((i) => h('span', { class: i < stars ? 'on' : '' }, '⭐'))),
    h('h2', {}, title),
    h('p', { class: 'sub' }, `${sub} You grew ${s.flowers.length} flower${s.flowers.length === 1 ? '' : 's'}.`),
    h('div', { class: 'bignums rise-in' },
      num('score', s.score.toLocaleString(), { hl: true, pb: pbScore && !firstInMode }),
      num('words / min', wpm >= 10 ? String(Math.round(wpm)) : wpm.toFixed(1), { pb: pbWpm && p.rounds > 1 }),
      num('accuracy', `${Math.round(accuracy * 100)}%`),
      num('best streak', String(s.bestCombo)),
    ),
    badges,
    nextLine,
    r.spelling ? spellingReport(r.spelling.results) : null,
    h('div', { class: 'row' },
      btn('Play again', 'big', again, { 'data-autofocus': true }),
      unlocked.length ? btn('🎀 Try it on!', 'butter small', () => showWardrobe('results')) : null,
      btn('Change game', 'ghost small', showModes),
      btn('🏆 Leaderboard', 'ghost small', () => showBoard('results')),
    ),
    h('p', { class: 'keytip' }, touchOnly ? '' : h('span', {}, h('kbd', {}, 'Enter'), ' play again · ', h('kbd', {}, 'Esc'), ' menu')),
  ));
  // Let the sunset and the last flowers settle before the card appears.
  screen = 'results';
  setTimeout(() => {
    if (screen !== 'results') return;
    // Fast typists keep typing after the clock runs out: ignore keys briefly so
    // a stray Space/Enter doesn't restart the round before they see the card.
    const buttons = [...el.querySelectorAll('button')];
    buttons.forEach((b) => (b.disabled = true));
    let armed = false;
    setTimeout(() => {
      armed = true;
      buttons.forEach((b) => (b.disabled = false));
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    }, 900);
    show(el, 'results', (e) => {
      if (!armed) { e.preventDefault(); return; }
      if (e.key === 'Enter') { e.preventDefault(); again(); } else if (e.key === 'Escape') showModes();
    });
  }, 900);
}

/** Spelling Bee results: each word, starred if it was spelled first time with no help. */
function spellingReport(results: SpellingResult[]): HTMLElement {
  const words = [...new Set(results.map((x) => x.word))];
  const easy = (w: string) => results.some((x) => x.word === w && !x.retry && !x.hinted && x.wrong === 0);
  const practise = words.filter((w) => !easy(w));
  return h('div', { class: 'spelling-report rise-in' },
    h('div', { class: 'spell-words' }, ...words.map((w) => h('span', { class: `spell-word${easy(w) ? ' easy' : ''}`, title: easy(w) ? 'Spelled first time!' : 'Worth another practice' }, easy(w) ? '⭐ ' : '🌱 ', w))),
    h('p', { class: 'keytip' }, practise.length ? `Worth another practice: ${practise.join(', ')}` : 'Every word spelled first time! 🎉'));
}

// ----------------------------------------------------------- leaderboard --
function showBoard(from: 'title' | 'modes' | 'results') {
  if (from !== 'results') startAttract();
  let mode: ModeId = store.current?.preferredMode ?? 'stroll';
  let by: 'score' | 'wpm' = 'score';
  const meId = store.current?.id;
  const latest = Math.max(0, ...store.leaderboard(mode, 'score', 1000).map((s) => s.date));
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const sortTabs = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div', {});
  const paint = () => {
    tabs.innerHTML = '';
    for (const m of MODES) tabs.append(h('button', { class: 'tab', role: 'tab', 'aria-selected': String(m.id === mode), onclick: () => { mode = m.id; sound.uiHover(); paint(); } }, `${m.emoji} ${m.name}`));
    sortTabs.innerHTML = '';
    sortTabs.append(
      h('button', { class: 'tab', role: 'tab', 'aria-selected': String(by === 'score'), onclick: () => { by = 'score'; paint(); } }, 'Top scores'),
      h('button', { class: 'tab', role: 'tab', 'aria-selected': String(by === 'wpm'), onclick: () => { by = 'wpm'; paint(); } }, 'Fastest typing'));
    const rows = store.leaderboard(mode, by, 10);
    body.innerHTML = '';
    if (!rows.length) {
      body.append(h('div', { class: 'empty' }, h('span', { class: 'e' }, '🌱'), 'No flowers here yet. Play a round to be the first!'));
      return;
    }
    const medal = (i: number) => (i < 3 ? h('span', { class: 'medal' }, ['🥇', '🥈', '🥉'][i]) : String(i + 1));
    body.append(h('table', { class: 'board' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Gardener'), h('th', {}, 'Score'), h('th', {}, 'WPM'), h('th', { class: 'hide-sm' }, 'Acc.'), h('th', { class: 'hide-sm' }, 'Level'), h('th', { class: 'hide-sm' }, 'When'))),
      h('tbody', {}, ...rows.map((s, i) => h('tr', { class: `${s.profileId === meId ? 'me' : ''} ${from === 'results' && s.date === latest ? 'fresh' : ''}` },
        h('td', {}, medal(i)),
        h('td', { class: 'name' }, `${s.avatar} ${s.name}`, s.little ? h('span', { title: 'Little Words' }, ' 🐣') : null, s.noCaps ? h('span', { title: 'No capitals' }, ' 🔡') : null, s.steady ? h('span', { title: 'Slow & Steady' }, ' 🐢') : null),
        h('td', {}, s.score.toLocaleString()),
        h('td', {}, s.wpm >= 10 ? String(Math.round(s.wpm)) : s.wpm.toFixed(1)),
        h('td', { class: 'hide-sm' }, `${Math.round(s.accuracy * 100)}%`),
        h('td', { class: 'hide-sm' }, String(s.level)),
        h('td', { class: 'hide-sm' }, timeAgo(s.date)),
      )))));
  };
  paint();
  const back = () => (from === 'title' ? showTitle() : from === 'modes' ? showModes() : finishBack());
  const finishBack = () => showModes();
  const el = h('div', { class: 'screen' }, h('div', { class: 'card pop-in', style: 'max-width:820px' },
    h('div', { class: 'back' }, iconBtn('back', 'Back', back)),
    h('h2', {}, '🏆 Garden of Fame'),
    h('p', { class: 'sub' }, 'The finest gardens grown on this computer'),
    tabs, sortTabs, body));
  show(el, 'board', (e) => { if (e.key === 'Escape') back(); });
}

// -------------------------------------------------------------- settings --
function showSettings(from: 'title' | 'modes') {
  startAttract();
  const sw = (label: string, get: () => boolean, setv: (v: boolean) => void) => {
    const b = h('button', { class: 'switch', role: 'switch', type: 'button', 'aria-checked': String(get()), 'aria-label': label }) as HTMLButtonElement;
    b.onclick = () => { setv(!get()); b.setAttribute('aria-checked', String(get())); applySettings(); sound.uiClick(); };
    return h('div', { class: 'setting' }, h('span', {}, label), b);
  };
  const seg = h('div', { class: 'seg' });
  const paintSeg = () => {
    seg.innerHTML = '';
    for (const [v, l] of [['auto', 'Auto'], ['on', 'Always'], ['off', 'Never']] as const) {
      seg.append(h('button', { type: 'button', 'aria-pressed': String(store.settings.keyboard === v), onclick: () => { store.updateSettings({ keyboard: v }); paintSeg(); sound.uiClick(); } }, l));
    }
  };
  paintSeg();
  const back = () => (from === 'title' ? showTitle() : showModes());
  const el = h('div', { class: 'screen' }, h('div', { class: 'card pop-in', style: 'max-width:520px' },
    h('div', { class: 'back' }, iconBtn('back', 'Back', back)),
    h('h2', {}, 'Settings'),
    h('p', { class: 'sub' }, 'Make the garden just right'),
    h('div', { class: 'settings-list' },
      sw('Sound effects', () => store.settings.sound, (v) => store.updateSettings({ sound: v })),
      sw('Music', () => store.settings.music, (v) => store.updateSettings({ music: v })),
      h('div', { class: 'setting' }, h('span', {}, 'Keyboard helper'), seg),
      sw('Calmer motion', () => store.settings.reducedMotion, (v) => store.updateSettings({ reducedMotion: v })),
    ),
    h('p', { class: 'keytip' }, '“Auto” shows the glowing keyboard while you’re learning letters.'),
  ));
  show(el, 'settings', (e) => { if (e.key === 'Escape') back(); });
}

// ------------------------------------------------------------------ boot --
renderer.seedGarden(16);
showTitle();

// Debug/test hooks (used by the Playwright suite).
(window as any).__game = {
  get screen() { return screen; },
  get round() { return round; },
  get renderer() { return renderer; },
  store,
  startRound: (id: ModeId) => startRound(getMode(id)),
  showModes,
  showBoard,
  showWardrobe,
  showResults: finishRound,
};
