// A live showcase of the winter term's new treasures: each hat, extra, puff and
// flower big and animated, beside its real wardrobe-size thumbnail. Ones not drawn
// yet show as "being drawn" (vite reloads the page as the art files change).

import { drawBee, drawPuff, PUFF_STYLES, type BeeMood, type PuffStyle } from '../src/art/characters';
import { HATS, EXTRAS, type HatId, type ExtraId } from '../src/art/outfits';
import { drawFlower, FLOWER_KINDS, FLOWER_NAMES, FLOWER_RARITY, TIER_NAMES, type FlowerKind } from '../src/art/flowers';
import { ITEMS, howToUnlock, type Item } from '../src/engine/unlocks';

const NEW_FLOWERS = ['crocus', 'sweetpea', 'bluejazz', 'cosmos', 'allium', 'summerspangle', 'lilyofthevalley', 'poinsettia', 'fairyrose', 'torchflower', 'aurorabloom'];

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
const live: { c: HTMLCanvasElement; draw: Draw }[] = [];
const dpr = Math.min(2, window.devicePixelRatio || 1);

function canvas(cls: string, w?: number, h?: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = cls;
  if (w && h) { c.style.width = `${w}px`; c.style.height = `${h}px`; }
  return c;
}

/** Draws once at a fixed size (the thumbnails, exactly as the game makes them). */
function still(w: number, h: number, draw: Draw): HTMLCanvasElement {
  const c = canvas('thumb', w, h);
  c.width = w * dpr; c.height = h * dpr;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  try { draw(g, w, h, 0.4); } catch { /* not drawn yet */ }
  return c;
}

function card(title: string, sub: string, ready: boolean, big: Draw, thumb: HTMLCanvasElement | null): HTMLElement {
  const el = document.createElement('div');
  el.className = ready ? 'card' : 'card pending';
  const b = canvas('big');
  if (ready) live.push({ c: b, draw: big });
  const row = document.createElement('div');
  row.className = 'row';
  if (thumb && ready) row.append(thumb);
  const txt = document.createElement('div');
  txt.innerHTML = `<b></b><small></small><span class="tag">${ready ? 'drawn' : 'being drawn…'}</span>`;
  txt.querySelector('b')!.textContent = title;
  txt.querySelector('small')!.textContent = sub;
  row.append(txt);
  el.append(b, row);
  return el;
}

function section(title: string, cards: HTMLElement[]) {
  const s = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(...cards);
  s.append(h, grid);
  document.getElementById('root')!.append(s);
}

const winter = (slot: Item['slot']) => ITEMS.filter((i) => i.slot === slot && i.flowers > 1000);
// Cycle the moods and facings so every angle gets a look.
const MOODS: BeeMood[] = ['idle', 'cheer', 'happy', 'sleepy', 'oops'];
const moodAt = (t: number) => MOODS[Math.floor(t / 3) % MOODS.length];
const facingAt = (t: number): 1 | -1 => (Math.floor(t / 7.5) % 2 ? -1 : 1);

function beeBig(hat: HatId, extra: ExtraId): Draw {
  return (g, w, h, t) => {
    const size = Math.min(w * 0.3, h * 0.36);
    drawBee(g, { x: w / 2, y: h * 0.6 + Math.sin(t * 1.6) * 4, size, time: t, mood: moodAt(t), facing: facingAt(t), tilt: Math.cos(t * 0.8) * 0.06, hat, extra });
    g.fillStyle = 'rgba(61,44,78,0.55)'; g.font = '600 11px system-ui'; g.textAlign = 'left';
    g.fillText(`${moodAt(t)} · ${facingAt(t) > 0 ? 'right' : 'left'}`, 8, h - 8);
  };
}
// The real thumbnails, as in src/main.ts (beeThumb / puffThumb / flowerThumb).
const beeThumb = (hat: HatId, extra: ExtraId) => still(96, 78, (g, w, h, t) => {
  const size = Math.min(w * 0.56, h * 0.6);
  drawBee(g, { x: w / 2 + size * 0.1, y: h * 0.62, size, time: t, mood: 'idle', facing: 1, hat, extra });
});

section('🎩 Hats', winter('hat').map((i) => card(i.name, howToUnlock(i), (HATS as readonly string[]).includes(i.id), beeBig(i.id as HatId, 'none'), beeThumb(i.id as HatId, 'none'))));
section('🎀 Extras', winter('extra').map((i) => card(i.name, howToUnlock(i), (EXTRAS as readonly string[]).includes(i.id), beeBig('none', i.id as ExtraId), beeThumb('none', i.id as ExtraId))));
section('🌬️ Puffs', winter('puff').map((i) => {
  const style = i.id as PuffStyle;
  const big: Draw = (g, w, h, t) => {
    // Three puffs: calm, a second seed, and one getting urgent (as it nears the edge).
    const r = Math.min(h * 0.2, w * 0.13);
    [[0.2, 0, 3], [0.5, 0, 11], [0.8, Math.min(1, (t % 6) / 5), 27]].forEach(([fx, urg, seed]) => {
      const x = w * fx, y = h * 0.42 + Math.sin(t * 1.3 + seed) * 5;
      drawPuff(g, { x, y, radius: r, time: t, seed, style, urgency: urg });
      g.font = '700 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const word = ['snow', 'merry', 'star'][[3, 11, 27].indexOf(seed)];
      const tw = g.measureText(word).width + 14;
      g.fillStyle = 'rgba(255,250,240,0.95)'; g.beginPath(); g.roundRect(x - tw / 2, y + r * 1.05, tw, 22, 11); g.fill();
      g.strokeStyle = 'rgba(185,156,210,0.7)'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#3d2c4e'; g.fillText(word, x, y + r * 1.05 + 11);
    });
  };
  const thumb = still(96, 78, (g, w, h, t) => drawPuff(g, { x: w / 2, y: h * 0.44, radius: Math.min(w, h) * 0.3, time: t, seed: 5, style }));
  return card(i.name, howToUnlock(i), (PUFF_STYLES as readonly string[]).includes(i.id), big, thumb);
}));
section('🌸 Flowers', NEW_FLOWERS.map((k) => {
  const ready = (FLOWER_KINDS as readonly string[]).includes(k);
  const kind = k as FlowerKind;
  const big: Draw = (g, w, h, t) => {
    // Left: growing from seed over and over. Right: fully grown.
    const grow = Math.min(1, (t % 6) / 3);
    drawFlower(g, { kind, x: w * 0.28, y: h - 10, size: h * 0.62, growth: grow, time: t, seed: 3 });
    drawFlower(g, { kind, x: w * 0.68, y: h - 10, size: h * 0.82, growth: 1, time: t, seed: 7 });
  };
  const thumb = still(56, 66, (g, w, h) => drawFlower(g, { kind, x: w / 2, y: h - 4, size: h * 0.86, growth: 1, time: 0, seed: 3 }));
  const tier = ready ? TIER_NAMES[FLOWER_RARITY[kind]] : '';
  return card(ready ? FLOWER_NAMES[kind] : k, tier, ready, big, thumb);
}));

function frame(now: number) {
  const t = now / 1000;
  for (const { c, draw } of live) {
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    try { draw(g, w, h, t); } catch (e) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#c23a4c'; g.font = '12px system-ui'; g.fillText(String(e).slice(0, 60), 8, 18); }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
