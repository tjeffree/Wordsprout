// Procedural storybook flowers. Everything is drawn in local coordinates with the
// origin at the stem base; heads are drawn in a unit space (scaled by their radius)
// so that CanvasGradients can be cached per colour and reused at any size.

import { PETALS, STEM, LEAF, SOIL, SOIL_DARK, clamp01, lerp, easeOutBack, easeOutCubic } from './palette';

export type FlowerKind =
  | 'sprout' | 'daisy' | 'clover' | 'buttercup' | 'dandelion' | 'peacebloom' | 'crocus' | 'sweetpea'
  | 'tulip' | 'poppy' | 'bluebell' | 'forgetmenot' | 'cornflower' | 'snowdrop' | 'bluejazz' | 'cosmos' | 'allium'
  | 'lavender' | 'sunflower' | 'pansy' | 'rose' | 'dahlia' | 'tigerlily' | 'heartblossom'
  | 'summerspangle' | 'lilyofthevalley' | 'poinsettia'
  | 'starbloom' | 'goldenlotus' | 'frostlotus' | 'jadevine' | 'moonflower' | 'fairyrose' | 'torchflower'
  | 'rainbowbloom' | 'phoenixbloom' | 'aurorabloom';

/** Rarity tier 0..4 (0 Common, 1 Uncommon, 2 Rare, 3 Legendary, 4 Mythic). Keys are in display order. */
export const FLOWER_RARITY: Record<FlowerKind, number> = {
  sprout: 0, daisy: 0, clover: 0, buttercup: 0, dandelion: 0, peacebloom: 0, crocus: 0, sweetpea: 0,
  tulip: 1, poppy: 1, bluebell: 1, forgetmenot: 1, cornflower: 1, snowdrop: 1, bluejazz: 1, cosmos: 1, allium: 1,
  lavender: 2, sunflower: 2, pansy: 2, rose: 2, dahlia: 2, tigerlily: 2, heartblossom: 2,
  summerspangle: 2, lilyofthevalley: 2, poinsettia: 2,
  starbloom: 3, goldenlotus: 3, frostlotus: 3, jadevine: 3, moonflower: 3, fairyrose: 3, torchflower: 3,
  rainbowbloom: 4, phoenixbloom: 4, aurorabloom: 4,
};

/** Every kind, in display order (by tier). */
export const FLOWER_KINDS: readonly FlowerKind[] = [
  'sprout', 'daisy', 'clover', 'buttercup', 'dandelion', 'peacebloom', 'crocus', 'sweetpea',
  'tulip', 'poppy', 'bluebell', 'forgetmenot', 'cornflower', 'snowdrop', 'bluejazz', 'cosmos', 'allium',
  'lavender', 'sunflower', 'pansy', 'rose', 'dahlia', 'tigerlily', 'heartblossom',
  'summerspangle', 'lilyofthevalley', 'poinsettia',
  'starbloom', 'goldenlotus', 'frostlotus', 'jadevine', 'moonflower', 'fairyrose', 'torchflower',
  'rainbowbloom', 'phoenixbloom', 'aurorabloom',
];

export const FLOWER_NAMES: Record<FlowerKind, string> = {
  sprout: 'Sprout', daisy: 'Daisy', clover: 'Clover', buttercup: 'Buttercup', dandelion: 'Dandelion', peacebloom: 'Peacebloom',
  crocus: 'Crocus', sweetpea: 'Sweet Pea',
  tulip: 'Tulip', poppy: 'Poppy', bluebell: 'Bluebell', forgetmenot: 'Forget-me-not', cornflower: 'Cornflower', snowdrop: 'Snowdrop',
  bluejazz: 'Blue Jazz', cosmos: 'Cosmos', allium: 'Allium',
  lavender: 'Lavender', sunflower: 'Sunflower', pansy: 'Pansy', rose: 'Rose', dahlia: 'Dahlia', tigerlily: 'Tiger Lily', heartblossom: 'Heartblossom',
  summerspangle: 'Summer Spangle', lilyofthevalley: 'Lily of the Valley', poinsettia: 'Poinsettia',
  starbloom: 'Starbloom', goldenlotus: 'Golden Lotus', frostlotus: 'Frost Lotus', jadevine: 'Jade Vine', moonflower: 'Moonflower',
  fairyrose: 'Fairy Rose', torchflower: 'Torchflower',
  rainbowbloom: 'Rainbow Bloom', phoenixbloom: 'Phoenix Bloom', aurorabloom: 'Aurora Bloom',
};

export const TIER_NAMES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'] as const;

/** True for kinds whose fully grown look changes over time (the rest can be cached as still bitmaps). */
export function flowerAnimated(kind: FlowerKind): boolean {
  return kind === 'starbloom' || kind === 'rainbowbloom' || kind === 'goldenlotus' || kind === 'frostlotus'
    || kind === 'moonflower' || kind === 'phoenixbloom' || kind === 'fairyrose' || kind === 'torchflower'
    || kind === 'aurorabloom';
}

/** Size multiplier the renderer applies to each kind. */
export function flowerSizeScale(kind: FlowerKind): number {
  if (kind === 'sprout') return 0.55;
  if (kind === 'sunflower' || kind === 'rainbowbloom' || kind === 'phoenixbloom' || kind === 'aurorabloom') return 1.18;
  return 1;
}

export interface FlowerOpts {
  kind: FlowerKind;
  x: number;
  y: number;
  size: number;
  growth: number;
  time: number;
  seed: number;
  sway?: number;
  /** Draw upright, ignoring idle sway (for sprite caching; rotate by flowerSwayAngle instead). */
  still?: boolean;
}

type C = CanvasRenderingContext2D;
interface Col { readonly fill: string; readonly stroke: string }

// ---------------------------------------------------------------- colours
const RED: Col = { fill: '#ff5d62', stroke: '#c23a4c' };
const VIOLET: Col = { fill: '#a98af0', stroke: '#6c4cb8' };
const PERI: Col = { fill: '#8aa8ff', stroke: '#4c69c9' };
const RASP: Col = { fill: '#f5628a', stroke: '#b8325a' };
const DANDY: Col = { fill: '#ffd83a', stroke: '#c98d12' };
const DANDY_IN: Col = { fill: '#ffbb2a', stroke: '#c47a12' };
const DANDY_CORE: Col = { fill: '#ff9f1c', stroke: '#bd6410' };
const PEACE: Col = { fill: '#fffaf7', stroke: '#cf9fb3' };
const CORN: Col = { fill: '#4d7cff', stroke: '#2a46ad' };
const CORN_IN: Col = { fill: '#7a5ae0', stroke: '#47309a' };
const SNOW: Col = { fill: '#fbfdf8', stroke: '#93aa9b' };
const SAGE: Col = { fill: '#9cc79e', stroke: '#55856a' };
const TIGER: Col = { fill: '#ff8a2e', stroke: '#c4521a' };
const HEART: Col = { fill: '#ff86b6', stroke: '#c23d6e' };
const GOLD: Col = { fill: '#ffc53d', stroke: '#b8741a' };
const FROST: Col = { fill: '#b8deff', stroke: '#5b8fc4' };
const JADE: Col = { fill: '#5fe0c8', stroke: '#23877a' };
const MOON: Col = { fill: '#fdfbff', stroke: '#a597d6' };
const MOONGLOW: Col = { fill: '#c9b4ff', stroke: '#8a6fd0' };
const FIRE: Col = { fill: '#ff7a2a', stroke: '#b8321e' };

function hx(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number): string {
  const A = hx(a), B = hx(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t);
  const g = Math.round(A[1] + (B[1] - A[1]) * t);
  const bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
function rgba(a: string, al: number): string {
  const A = hx(a);
  return `rgba(${A[0]},${A[1]},${A[2]},${al})`;
}

interface Style {
  fill: string; stroke: string; light: string; dark: string; deep: string; pale: string;
  pg?: CanvasGradient; // dark(base) -> fill -> light(tip), along -y, unit length
  dg?: CanvasGradient; // deep -> dark -> fill, along -y (back petals)
  rg?: CanvasGradient; // radial from origin
  vg?: CanvasGradient; // light -> fill -> dark along +y (hanging bells)
  hg?: CanvasGradient; // glow halo
}
const styles = new WeakMap<Col, Style>();
function sty(c: Col): Style {
  let s = styles.get(c);
  if (!s) {
    s = {
      fill: c.fill, stroke: c.stroke,
      light: mix(c.fill, '#ffffff', 0.45),
      dark: mix(c.fill, c.stroke, 0.45),
      deep: mix(c.fill, c.stroke, 0.85),
      pale: mix(c.fill, '#ffffff', 0.78),
    };
    styles.set(c, s);
  }
  return s;
}
function gPg(ctx: C, s: Style): CanvasGradient {
  if (!s.pg) {
    const g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, s.dark); g.addColorStop(0.5, s.fill); g.addColorStop(1, s.light);
    s.pg = g;
  }
  return s.pg;
}
function gDg(ctx: C, s: Style): CanvasGradient {
  if (!s.dg) {
    const g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, s.deep); g.addColorStop(0.55, s.dark); g.addColorStop(1, s.fill);
    s.dg = g;
  }
  return s.dg;
}
function gRg(ctx: C, s: Style): CanvasGradient {
  if (!s.rg) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.05);
    g.addColorStop(0, s.deep); g.addColorStop(0.3, s.dark); g.addColorStop(0.7, s.fill); g.addColorStop(1, s.light);
    s.rg = g;
  }
  return s.rg;
}
function gVg(ctx: C, s: Style): CanvasGradient {
  if (!s.vg) {
    const g = ctx.createLinearGradient(0, 0, 0, 1);
    g.addColorStop(0, s.light); g.addColorStop(0.45, s.fill); g.addColorStop(1, s.dark);
    s.vg = g;
  }
  return s.vg;
}
function gHalo(ctx: C, s: Style): CanvasGradient {
  if (!s.hg) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(s.light, 0.7)); g.addColorStop(0.4, rgba(s.fill, 0.28)); g.addColorStop(1, rgba(s.fill, 0));
    s.hg = g;
  }
  return s.hg;
}

// ---------------------------------------------------------------- random
function hr(seed: number, k: number): number {
  let x = Math.imul((seed | 0) ^ Math.imul(k + 1, 0x9e3779b1), 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[], seed: number, k: number): T {
  return arr[Math.floor(hr(seed, k) * arr.length) % arr.length];
}

// ---------------------------------------------------------------- module state (avoids allocations)
const TAU = Math.PI * 2;
let CT = 0, PH = 0, LW = 0.02, OW = 1;
const SX = new Float64Array(4), SY = new Float64Array(4);
const QX = new Float64Array(4), QY = new Float64Array(4);
let PX = 0, PY = 0, PA = 0;

function stemAt(t: number): void {
  const m = 1 - t;
  const a = m * m * m, b = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
  PX = a * SX[0] + b * SX[1] + c * SX[2] + d * SX[3];
  PY = a * SY[0] + b * SY[1] + c * SY[2] + d * SY[3];
  const dx = 3 * m * m * (SX[1] - SX[0]) + 6 * m * t * (SX[2] - SX[1]) + 3 * t * t * (SX[3] - SX[2]);
  const dy = 3 * m * m * (SY[1] - SY[0]) + 6 * m * t * (SY[2] - SY[1]) + 3 * t * t * (SY[3] - SY[2]);
  PA = Math.atan2(dx, -dy);
}

// ---------------------------------------------------------------- shared shapes
function petalPath(ctx: C, len: number, wid: number, pt: number): void {
  const cy = -len * (0.97 - 0.2 * pt);
  const cx = wid * (1.22 - 0.7 * pt);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-wid * 1.0, -len * 0.18, -cx, cy, 0, -len);
  ctx.bezierCurveTo(cx, cy, wid * 1.0, -len * 0.18, 0, 0);
  ctx.closePath();
}

/** An ellipse as its own sub-path, so several can share one path without being joined up. */
function oval(ctx: C, x: number, y: number, rx: number, ry: number, rot: number): void {
  ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function sparkle(ctx: C, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
}

let LST: Style | null = null;
/** Half-width profile and bend offset of the jagged (dandelion) leaf at fraction y along it. */
function jw(wid: number, y: number): number { return Math.sin(Math.PI * Math.min(0.97, 0.08 + y * 0.92)) * wid * 1.15; }
function jb(bend: number, y: number): number { return bend * Math.sin(Math.PI * y) * 0.9; }
function leaf(ctx: C, len: number, wid: number, bend: number, ow: number = OW, lst: Style | null = null, jag = false): void {
  if (len < 0.5) return;
  const st = lst || LST || (LST = sty(LEAF));
  ctx.save();
  ctx.scale(len, len);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  if (jag) {
    // dandelion-style leaf: teeth that point back towards the base ("dent de lion")
    ctx.lineTo(jw(wid, 0.1) * 0.5 + jb(bend, 0.1), -0.1);
    for (let k = 0; k < 4; k++) {
      const y0 = 0.1 + k * 0.2, y1 = y0 + 0.2;
      ctx.quadraticCurveTo(jw(wid, y0) * 0.95 + jb(bend, y0), -y0 - 0.03, jw(wid, y1) * 1.12 + jb(bend, y1), -y1 + 0.07);
      ctx.lineTo(jw(wid, y1) * 0.5 + jb(bend, y1), -y1);
    }
    ctx.quadraticCurveTo(wid * 0.25 + jb(bend, 0.95), -0.97, jb(bend, 1), -1.03);
    ctx.quadraticCurveTo(-wid * 0.25 + jb(bend, 0.95), -0.97, -jw(wid, 0.9) * 0.5 + jb(bend, 0.9), -0.9);
    for (let k = 3; k >= 0; k--) {
      const y0 = 0.1 + k * 0.2, y1 = y0 + 0.2;
      ctx.lineTo(-jw(wid, y1) * 1.12 + jb(bend, y1), -y1 + 0.07);
      ctx.quadraticCurveTo(-jw(wid, y0) * 0.95 + jb(bend, y0), -y0 - 0.03, -jw(wid, y0) * 0.5 + jb(bend, y0), -y0);
    }
  } else {
    ctx.bezierCurveTo(wid * 1.15 + bend, -0.22, wid * 0.95 + bend, -0.72, bend * 0.1, -1);
    ctx.bezierCurveTo(-wid * 0.9 + bend, -0.72, -wid * 1.15 + bend, -0.22, 0, 0);
  }
  ctx.closePath();
  ctx.fillStyle = gPg(ctx, st);
  ctx.fill();
  ctx.lineWidth = ow / len;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = st.stroke;
  ctx.stroke();
  // midrib + highlight
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = ow * 0.6 / len;
  ctx.beginPath();
  ctx.moveTo(0, -0.05);
  ctx.quadraticCurveTo(bend * 0.9, -0.5, bend * 0.1, -0.88);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = ow * 1.1 / len;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-wid * 0.45 + bend * 0.5, -0.25);
  ctx.quadraticCurveTo(-wid * 0.5 + bend, -0.5, -wid * 0.25 + bend * 0.7, -0.7);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- heads (unit space, origin = stem tip)
function headDaisy(ctx: C, st: Style, n: number): void {
  const step = TAU / n;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.save();
  ctx.rotate(step * 0.5);
  ctx.fillStyle = gDg(ctx, st);
  for (let i = 0; i < n; i++) { ctx.rotate(step); petalPath(ctx, 0.93, 0.17, 0); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = gPg(ctx, st);
  for (let i = 0; i < n; i++) { ctx.rotate(step); petalPath(ctx, 1, 0.175, 0); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // petal highlights + crease lines
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n; i++) { ctx.rotate(step); oval(ctx, -0.05, -0.74, 0.03, 0.12, 0.08); }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n; i++) { ctx.rotate(step); ctx.moveTo(0, -0.34); ctx.lineTo(0, -0.62); }
  ctx.globalAlpha = 0.25; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.6; ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
  centreDisc(ctx, 0.31, '#fff3a8', '#ffd45c', '#e3a62c', '#c99a22', 7);
}

let gDisc: { [k: string]: CanvasGradient } = {};
function centreDisc(ctx: C, r: number, c0: string, c1: string, c2: string, line: string, dots: number): void {
  const key = c0 + c2;
  let g = gDisc[key];
  if (!g) {
    g = ctx.createRadialGradient(-0.3, -0.35, 0.02, 0, 0, 1.05);
    g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
    gDisc[key] = g;
  }
  ctx.save();
  ctx.scale(r, r);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = LW / r; ctx.strokeStyle = line; ctx.stroke();
  if (dots > 0) {
    ctx.beginPath();
    for (let i = 0; i < dots; i++) {
      const a = i * 2.4 + 0.5, d = 0.25 + 0.5 * ((i * 0.618) % 1);
      const px = Math.cos(a) * d, py = Math.sin(a) * d;
      ctx.moveTo(px + 0.09, py); ctx.arc(px, py, 0.09, 0, TAU);
    }
    ctx.fillStyle = rgba(line, 0.5); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(-0.35, -0.4, 0.22, 0.13, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  ctx.restore();
}

function headTulip(ctx: C, st: Style, b: number): void {
  const open = 0.55 + 0.45 * clamp01(b);
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  // back petals
  ctx.fillStyle = gDg(ctx, st);
  ctx.save(); ctx.rotate(-0.34 * open); petalPathT(ctx, 1.0, 0.44); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.rotate(0.34 * open); petalPathT(ctx, 1.0, 0.44); ctx.fill(); ctx.stroke(); ctx.restore();
  // front petal
  ctx.fillStyle = gPg(ctx, st);
  ctx.save(); ctx.scale(1, 0.94); petalPathT(ctx, 1.0, 0.5); ctx.fill(); ctx.stroke();
  // folds + highlight
  ctx.globalAlpha = 0.28; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.17, -0.2); ctx.quadraticCurveTo(-0.2, -0.55, -0.12, -0.86);
  ctx.moveTo(0.19, -0.22); ctx.quadraticCurveTo(0.22, -0.55, 0.13, -0.84);
  ctx.stroke();
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-0.27, -0.55, 0.05, 0.2, 0.18, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-0.2, -0.84, 0.028, 0, TAU); ctx.fill();
  ctx.restore();
}
function petalPathT(ctx: C, len: number, wid: number): void {
  // cup-shaped petal with a soft rounded point
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-wid * 1.05, -len * 0.12, -wid * 1.1, -len * 0.7, -wid * 0.15, -len);
  ctx.quadraticCurveTo(0, -len * 1.04, wid * 0.15, -len);
  ctx.bezierCurveTo(wid * 1.1, -len * 0.7, wid * 1.05, -len * 0.12, 0, 0);
  ctx.closePath();
}

function ruffPetal(ctx: C, w: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-0.55 * w, -0.12, -0.8 * w, -0.7, -0.52 * w, -0.9);
  ctx.quadraticCurveTo(-0.42 * w, -1.05, -0.27 * w, -0.96);
  ctx.quadraticCurveTo(-0.14 * w, -1.07, 0, -0.97);
  ctx.quadraticCurveTo(0.14 * w, -1.07, 0.27 * w, -0.96);
  ctx.quadraticCurveTo(0.42 * w, -1.05, 0.52 * w, -0.9);
  ctx.bezierCurveTo(0.8 * w, -0.7, 0.55 * w, -0.12, 0, 0);
  ctx.closePath();
}
function headPoppy(ctx: C, st: Style, n: number, b: number): void {
  const step = TAU / n;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.fillStyle = gRg(ctx, st);
  ctx.save(); ctx.rotate(step * 0.5 + 0.2);
  ctx.scale(0.95, 0.95);
  for (let i = 0; i < n; i++) { ctx.rotate(step); ruffPetal(ctx, 1.15); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.rotate(0.1);
  for (let i = 0; i < n; i++) { ctx.rotate(step); ruffPetal(ctx, 1.12); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // fold lines
  ctx.save();
  ctx.rotate(0.1);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    ctx.rotate(step);
    ctx.moveTo(-0.12, -0.38); ctx.quadraticCurveTo(-0.2, -0.65, -0.16, -0.88);
    ctx.moveTo(0.12, -0.38); ctx.quadraticCurveTo(0.2, -0.65, 0.16, -0.88);
  }
  ctx.globalAlpha = 0.28; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.6; ctx.lineCap = 'round'; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let i = 0; i < n; i++) { ctx.rotate(step); oval(ctx, -0.3, -0.72, 0.045, 0.14, 0.4); }
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  ctx.restore();
  // stamens + dark centre
  const sc = 0.2 + 0.0 * b;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = i * TAU / 14, ca = Math.cos(a), sa = Math.sin(a);
    ctx.moveTo(ca * sc, sa * sc); ctx.lineTo(ca * 0.37, sa * 0.37);
  }
  ctx.strokeStyle = '#6b4a7e'; ctx.lineWidth = 0.03; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = i * TAU / 14;
    ctx.moveTo(Math.cos(a) * 0.37 + 0.034, Math.sin(a) * 0.37); ctx.arc(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0.034, 0, TAU);
  }
  ctx.fillStyle = '#8e66a6'; ctx.fill();
  ctx.restore();
  centreDisc(ctx, 0.22, '#9a72b2', '#6b4a7e', '#47305a', '#47305a', 0);
}

function bell(ctx: C, st: Style): void {
  ctx.beginPath();
  ctx.moveTo(-0.1, 0);
  ctx.bezierCurveTo(-0.34, 0.06, -0.38, 0.5, -0.52, 0.86);
  ctx.quadraticCurveTo(-0.5, 1.12, -0.17, 0.92);
  ctx.quadraticCurveTo(0, 1.14, 0.17, 0.92);
  ctx.quadraticCurveTo(0.5, 1.12, 0.52, 0.86);
  ctx.bezierCurveTo(0.38, 0.5, 0.34, 0.06, 0.1, 0);
  ctx.closePath();
  ctx.fillStyle = gVg(ctx, st); ctx.fill();
  ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.strokeStyle = st.stroke; ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.3; ctx.lineWidth = LW * 0.7; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.12, 0.2); ctx.quadraticCurveTo(-0.15, 0.6, -0.2, 0.9);
  ctx.moveTo(0.12, 0.2); ctx.quadraticCurveTo(0.15, 0.6, 0.2, 0.9);
  ctx.stroke();
  ctx.globalAlpha = 0.75; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-0.2, 0.34, 0.05, 0.17, 0.25, 0, TAU); ctx.fill();
  ctx.restore();
}

function headClover(ctx: C, st: Style): void {
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  // outer, mid, inner rings of little round florets
  const rings = [[9, 0.64, 0.3, 0], [7, 0.36, 0.3, 0.4], [3, 0.1, 0.3, 1]];
  for (let r = 0; r < 3; r++) {
    const [n, rad, fr, off] = rings[r];
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + off + r * 0.3;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad * 0.95 - 0.04;
      ctx.moveTo(px + fr, py); ctx.arc(px, py, fr, 0, TAU);
    }
    ctx.stroke();
    ctx.fillStyle = r === 0 ? st.dark : r === 1 ? st.fill : st.light;
    ctx.fill();
  }
  // glints
  ctx.beginPath();
  ctx.moveTo(-0.22, -0.52); ctx.arc(-0.27, -0.52, 0.05, 0, TAU);
  ctx.moveTo(-0.5, -0.2); ctx.arc(-0.52, -0.2, 0.04, 0, TAU);
  ctx.moveTo(0.05, -0.72); ctx.arc(0.0, -0.72, 0.045, 0, TAU);
  ctx.moveTo(-0.28, -0.1); ctx.arc(-0.31, -0.1, 0.045, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  ctx.globalAlpha = 0.4; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + 0.3, d = 0.1 + (i % 3) * 0.22;
    ctx.moveTo(Math.cos(a) * d + 0.03, Math.sin(a) * d + 0.1); ctx.lineTo(Math.cos(a) * (d + 0.1), Math.sin(a) * (d + 0.1) + 0.1);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// sunflower seed layout
const SUN_DOTS: number[] = [];
for (let i = 0; i < 46; i++) {
  const a = i * 2.39996, r = Math.sqrt((i + 0.6) / 46) * 0.88;
  SUN_DOTS.push(Math.cos(a) * r, Math.sin(a) * r);
}
let gSun: CanvasGradient | null = null;
function headSunflower(ctx: C, st: Style, n: number): void {
  const step = TAU / n;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.save(); ctx.rotate(step * 0.5);
  ctx.fillStyle = gDg(ctx, st);
  for (let i = 0; i < n; i++) { ctx.rotate(step); petalPath(ctx, 0.97, 0.16, 0.7); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = gPg(ctx, st);
  for (let i = 0; i < n; i++) { ctx.rotate(step); petalPath(ctx, 1, 0.17, 0.7); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n; i++) { ctx.rotate(step); oval(ctx, -0.045, -0.72, 0.028, 0.13, 0.08); }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.restore();
  // seed disc
  if (!gSun) {
    gSun = ctx.createRadialGradient(-0.2, -0.22, 0.02, 0, 0, 0.62);
    gSun.addColorStop(0, '#c08a55'); gSun.addColorStop(0.5, '#8d5b3a'); gSun.addColorStop(1, '#5e3b2a');
  }
  ctx.beginPath(); ctx.arc(0, 0, 0.5, 0, TAU);
  ctx.fillStyle = gSun; ctx.fill();
  ctx.strokeStyle = '#4a2e22'; ctx.lineWidth = LW * 1.1; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 0.455, 0, TAU);
  ctx.strokeStyle = 'rgba(224,160,80,0.55)'; ctx.lineWidth = 0.03; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < SUN_DOTS.length; i += 2) {
    const dx = SUN_DOTS[i] * 0.5, dy = SUN_DOTS[i + 1] * 0.5, r = 0.022 + 0.012 * (1 - Math.hypot(dx, dy) * 2);
    ctx.moveTo(dx + r, dy); ctx.arc(dx, dy, r, 0, TAU);
  }
  ctx.fillStyle = '#3f271d'; ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < SUN_DOTS.length; i += 2) {
    const dx = SUN_DOTS[i] * 0.5 - 0.012, dy = SUN_DOTS[i + 1] * 0.5 - 0.014;
    ctx.moveTo(dx + 0.009, dy); ctx.arc(dx, dy, 0.009, 0, TAU);
  }
  ctx.fillStyle = 'rgba(240,190,120,0.85)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-0.22, -0.26, 0.12, 0.06, -0.7, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
}

const ROSE_SP: number[] = [];
for (let i = 0; i <= 40; i++) {
  const a = (i / 40) * 5.2 * Math.PI, r = 0.3 * (1 - i / 44);
  ROSE_SP.push(Math.cos(a) * r, Math.sin(a) * r);
}
function headRose(ctx: C, st: Style): void {
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  const step = TAU / 5;
  // sepals
  ctx.save();
  ctx.rotate(0.3);
  for (let i = 0; i < 5; i++) { ctx.rotate(step); leaf(ctx, 1.12, 0.12, 0.0, LW); }
  ctx.restore();
  ctx.fillStyle = gRg(ctx, st);
  // outer petals
  ctx.save();
  for (let i = 0; i < 5; i++) {
    ctx.rotate(step); ctx.beginPath(); ctx.ellipse(0, -0.5, 0.55, 0.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // middle layer
  ctx.save(); ctx.rotate(0.5);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(TAU / 4); ctx.beginPath(); ctx.ellipse(0, -0.3, 0.38, 0.34, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // core + spiral
  ctx.beginPath(); ctx.arc(0, 0, 0.33, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.lineCap = 'round'; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.9;
  ctx.beginPath();
  ctx.moveTo(ROSE_SP[0], ROSE_SP[1]);
  for (let i = 2; i < ROSE_SP.length; i += 2) ctx.lineTo(ROSE_SP[i], ROSE_SP[i + 1]);
  ctx.stroke();
  ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.arc(0.03, 0.02, 0.4, 3.6, 5.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.06, -0.1, 0.55, 0.3, 1.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(0.0, 0.0, 0.8, 4.0, 4.9); ctx.stroke();
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-0.32, -0.38, 0.15, 0.08, -0.7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-0.6, -0.1, 0.06, 0.1, -0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0.1, -0.55, 0.04, 0, TAU); ctx.fill();
  ctx.restore();
}

const STAR_PTS: number[] = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 === 0 ? 1 : 0.5;
  STAR_PTS.push(Math.cos(a) * r, Math.sin(a) * r);
}
let gStar: CanvasGradient | null = null;
function starPath(ctx: C, s: number): void {
  ctx.beginPath();
  ctx.moveTo(STAR_PTS[0] * s, STAR_PTS[1] * s);
  for (let i = 2; i < 20; i += 2) ctx.lineTo(STAR_PTS[i] * s, STAR_PTS[i + 1] * s);
  ctx.closePath();
}
function headStar(ctx: C, st: Style): void {
  const pulse = 0.5 + 0.5 * Math.sin(CT * 2.6 + PH);
  // soft halo
  ctx.save();
  ctx.scale(2.3, 2.3);
  ctx.globalAlpha = 0.55 + 0.45 * pulse;
  ctx.fillStyle = gHalo(ctx, st);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.rotate(Math.sin(CT * 0.9 + PH) * 0.06);
  starPath(ctx, 0.9);
  ctx.strokeStyle = st.stroke; ctx.lineWidth = 0.2 + LW * 2; ctx.stroke();
  ctx.strokeStyle = st.fill; ctx.lineWidth = 0.2; ctx.stroke();
  if (!gStar) {
    gStar = ctx.createRadialGradient(-0.15, -0.2, 0.02, 0, 0, 0.95);
    gStar.addColorStop(0, '#ffffff'); gStar.addColorStop(0.35, '#fff6c9'); gStar.addColorStop(1, '#ffffff');
  }
  ctx.fillStyle = st.fill; ctx.fill();
  // lit inner star (gradient tint from colour to pale)
  starPath(ctx, 0.62);
  ctx.fillStyle = st.light; ctx.fill();
  starPath(ctx, 0.4);
  ctx.globalAlpha = 0.65 + 0.35 * pulse; ctx.fillStyle = st.pale; ctx.fill();
  ctx.globalAlpha = 1;
  // rim light
  ctx.beginPath(); ctx.ellipse(-0.3, -0.45, 0.07, 0.17, 0.5, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 0.1 + 0.03 * pulse, 0, TAU);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
  // twinkles
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const tw = Math.max(0, Math.sin(CT * 2.2 + PH + i * 2.1));
    if (tw < 0.05) continue;
    const a = i * 2.1 + 0.8 + PH;
    ctx.globalAlpha = tw;
    sparkle(ctx, Math.cos(a) * 1.35, Math.sin(a) * 1.35 - 0.1, 0.12 + 0.2 * tw);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

const RAINBOW = ['#b99cff', '#8fd0ff', '#7ee0c3', '#ffe27a', '#ffa45c', '#ff7a9a'];
let gRainbow: CanvasGradient | null = null;
const RB_STROKE = '#9a6fb8';
function headRainbow(ctx: C, n: number): void {
  if (!gRainbow) {
    const g = ctx.createLinearGradient(0, 0, 0, -1);
    const bw = 1 / 6;
    for (let i = 0; i < 6; i++) {
      const a = Math.max(0, i * bw + (i === 0 ? 0 : 0.035)), b = Math.min(1, (i + 1) * bw - (i === 5 ? 0 : 0.035));
      g.addColorStop(a, RAINBOW[i]); g.addColorStop(b, RAINBOW[i]);
    }
    gRainbow = g;
  }
  const step = TAU / n;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = RB_STROKE;
  ctx.fillStyle = gRainbow;
  ctx.save(); ctx.rotate(step * 0.5);
  for (let i = 0; i < n; i++) { ctx.rotate(step); petalPath(ctx, 1, 0.27, 0); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.scale(0.62, 0.62); ctx.lineWidth = LW / 0.62;
  for (let i = 0; i < n; i++) { ctx.rotate(step); petalPath(ctx, 1, 0.3, 0); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // shimmer sweep
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.rotate(step);
    const s = Math.max(0, Math.sin(CT * 2.4 - i * 0.9 + PH));
    ctx.globalAlpha = 0.2 + 0.55 * s * s;
    ctx.beginPath(); ctx.ellipse(-0.08, -0.7 + 0.08 * s, 0.045, 0.14, 0.15, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  ctx.restore();
  // centre
  centreDisc(ctx, 0.2, '#ffffff', '#fff4fa', '#ffc2da', '#d98ab0', 0);
  for (let i = 0; i < 2; i++) {
    const tw = Math.max(0, Math.sin(CT * 3.1 + PH + i * 3.3));
    if (tw < 0.05) continue;
    ctx.globalAlpha = tw; ctx.fillStyle = '#ffffff';
    const a = i * 3.3 + 0.6 + PH;
    sparkle(ctx, Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.1 + 0.16 * tw);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundPetal(ctx: C, len: number, wid: number): void {
  // broad petal with a fully rounded tip
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-wid * 0.9, -len * 0.15, -wid * 1.1, -len * 0.95, 0, -len);
  ctx.bezierCurveTo(wid * 1.1, -len * 0.95, wid * 0.9, -len * 0.15, 0, 0);
  ctx.closePath();
}

function headButtercup(ctx: C, st: Style): void {
  const step = TAU / 5;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.save();
  ctx.fillStyle = gPg(ctx, st);
  for (let i = 0; i < 5; i++) { ctx.rotate(step); roundPetal(ctx, 1, 0.56); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // the famous buttercup shine
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { ctx.rotate(step); oval(ctx, -0.14, -0.62, 0.09, 0.2, 0.2); }
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  ctx.restore();
  // stamen ring
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12, px = Math.cos(a) * 0.36, py = Math.sin(a) * 0.36;
    ctx.moveTo(px + 0.06, py); ctx.arc(px, py, 0.06, 0, TAU);
  }
  ctx.fillStyle = '#e3a62c'; ctx.fill();
  centreDisc(ctx, 0.27, '#f4ffb0', '#c9e06a', '#8fb83a', '#6e9a2a', 0);
}

// forget-me-not cluster: [x, y, radius] of each little flower, back to front
const FMN = [[-0.25, -0.55, 0.34], [0.32, -0.55, 0.33], [-0.6, 0.15, 0.36], [0.58, 0.1, 0.37], [0, 0, 0.42]];
function headForgetMeNot(ctx: C, st: Style): void {
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  // pink buds, as on the real thing
  const bud = sty(PETALS.pink);
  ctx.beginPath();
  ctx.moveTo(-0.72, -0.42); ctx.arc(-0.84, -0.42, 0.12, 0, TAU);
  ctx.moveTo(0.92, -0.48); ctx.arc(0.8, -0.48, 0.11, 0, TAU);
  ctx.moveTo(0.1, -0.98); ctx.arc(0, -0.98, 0.1, 0, TAU);
  ctx.fillStyle = bud.fill; ctx.fill();
  ctx.strokeStyle = bud.stroke; ctx.stroke();
  ctx.strokeStyle = st.stroke;
  for (let f = 0; f < FMN.length; f++) {
    const [fx, fy, r] = FMN[f];
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(f * 0.7);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5, px = Math.cos(a) * r * 0.52, py = Math.sin(a) * r * 0.52;
      ctx.moveTo(px + r * 0.46, py); ctx.arc(px, py, r * 0.46, 0, TAU);
    }
    ctx.fillStyle = st.fill; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = i * TAU / 5, px = Math.cos(a) * r * 0.6 - r * 0.08, py = Math.sin(a) * r * 0.6 - r * 0.1;
      ctx.moveTo(px + r * 0.13, py); ctx.arc(px, py, r * 0.13, 0, TAU);
    }
    ctx.fillStyle = rgba(st.pale, 0.85); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.24, 0, TAU);
    ctx.fillStyle = '#ffe27a'; ctx.fill();
    ctx.lineWidth = LW * 0.8; ctx.strokeStyle = '#e3a62c'; ctx.stroke();
    ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.restore();
  }
}

// pansy colourways: [upper petals, lower "face" petals]
const PANSY: readonly (readonly [Col, Col])[] = [
  [VIOLET, PETALS.butter], [VIOLET, PETALS.white], [RASP, PETALS.butter], [PETALS.lilac, PETALS.white], [PERI, PETALS.butter],
];
const PANSY_BLOTCH = '#47305a';
function headPansy(ctx: C, seed: number): void {
  const [upCol, loCol] = pick(PANSY, seed, 6);
  const up = sty(upCol), lo = sty(loCol);
  ctx.lineJoin = 'round'; ctx.lineWidth = LW;
  // two big upper petals at the back
  ctx.fillStyle = gDg(ctx, up); ctx.strokeStyle = up.stroke;
  for (const a of [-0.45, 0.45]) { ctx.save(); ctx.rotate(a); roundPetal(ctx, 1, 0.62); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // two side petals and the wide bottom petal make the face
  ctx.fillStyle = gPg(ctx, lo); ctx.strokeStyle = lo.stroke;
  for (const [a, len, wid] of [[-1.45, 0.84, 0.52], [1.45, 0.84, 0.52], [Math.PI, 0.9, 0.72]]) {
    ctx.save(); ctx.rotate(a); roundPetal(ctx, len, wid); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // dark blotch and whiskers on each face petal
  ctx.save();
  ctx.fillStyle = rgba(PANSY_BLOTCH, 0.85); ctx.strokeStyle = PANSY_BLOTCH;
  ctx.lineWidth = LW * 0.8; ctx.lineCap = 'round';
  for (const [a, k] of [[-1.45, 0.8], [1.45, 0.8], [Math.PI, 1]]) {
    ctx.save(); ctx.rotate(a); ctx.scale(k, k);
    ctx.beginPath(); ctx.ellipse(0, -0.26, 0.2, 0.26, 0, 0, TAU); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -0.1); ctx.lineTo(0, -0.62);
    ctx.moveTo(0, -0.1); ctx.lineTo(-0.15, -0.56);
    ctx.moveTo(0, -0.1); ctx.lineTo(0.15, -0.56);
    ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
  // glints on the upper petals
  ctx.beginPath();
  oval(ctx, -0.5, -0.66, 0.07, 0.17, -0.5);
  oval(ctx, 0.32, -0.8, 0.06, 0.13, 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  // little yellow eye
  ctx.beginPath(); ctx.arc(0, 0, 0.11, 0, TAU);
  ctx.fillStyle = '#ffe27a'; ctx.fill();
  ctx.strokeStyle = '#c99a22'; ctx.lineWidth = LW * 0.8; ctx.stroke();
}

function headDahlia(ctx: C, st: Style): void {
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  // rings of pointed petals, each smaller, lighter and offset from the last
  const rings = [[14, 1, 0.15, 0], [12, 0.76, 0.17, 0.5], [10, 0.54, 0.19, 0.2], [8, 0.34, 0.22, 0.6]];
  for (let r = 0; r < rings.length; r++) {
    const [n, sc, wid, off] = rings[r];
    const step = TAU / n;
    ctx.save();
    ctx.scale(sc, sc);
    ctx.lineWidth = LW / sc;
    ctx.rotate(off);
    ctx.fillStyle = r === 0 ? gDg(ctx, st) : gPg(ctx, st);
    for (let i = 0; i < n; i++) { ctx.rotate(step); petalPath(ctx, 1, wid, 0.9); ctx.fill(); ctx.stroke(); }
    // centre crease on each petal
    ctx.beginPath();
    for (let i = 0; i < n; i++) { ctx.rotate(step); ctx.moveTo(0, -0.3); ctx.lineTo(0, -0.8); }
    ctx.globalAlpha = 0.3; ctx.lineWidth = LW * 0.6 / sc; ctx.lineCap = 'round'; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  centreDisc(ctx, 0.12, '#fff3a8', '#ffd45c', '#e3a62c', '#c99a22', 0);
  // glints
  ctx.beginPath();
  oval(ctx, -0.36, -0.62, 0.05, 0.15, -0.5);
  oval(ctx, -0.22, -0.4, 0.04, 0.1, -0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
}

// ---------------------------------------------------------------- new heads
function strap(ctx: C, len: number, w: number): void {
  // thin ray floret with a little toothed, squared-off tip
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, 0);
  ctx.lineTo(-w, -len * 0.9);
  ctx.lineTo(-w * 0.55, -len);
  ctx.lineTo(0, -len * 0.95);
  ctx.lineTo(w * 0.55, -len);
  ctx.lineTo(w, -len * 0.9);
  ctx.lineTo(w * 0.4, 0);
  ctx.closePath();
}
// dandelion layers: [count, length, half-width, rotation offset]
const DANDY_RINGS = [[26, 1, 0.085, 0], [22, 0.8, 0.085, 0.13], [18, 0.6, 0.09, 0.05], [13, 0.4, 0.095, 0.2]];
function headDandelion(ctx: C, st: Style): void {
  ctx.lineJoin = 'round';
  for (let r = 0; r < DANDY_RINGS.length; r++) {
    const [n, len, w, off] = DANDY_RINGS[r];
    const step = TAU / n;
    const rs = r < 2 ? st : sty(r === 2 ? DANDY_IN : DANDY_CORE);
    ctx.save();
    ctx.rotate(off);
    ctx.fillStyle = r === 0 ? gDg(ctx, rs) : gPg(ctx, rs);
    ctx.strokeStyle = rs.stroke; ctx.lineWidth = LW * 0.8;
    for (let i = 0; i < n; i++) { ctx.rotate(step); strap(ctx, len, w); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }
  // a tight orange heart of unopened florets
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4, d = i === 0 ? 0 : 0.1 + 0.04 * (i % 3);
    const px = Math.cos(a) * d, py = Math.sin(a) * d;
    ctx.moveTo(px + 0.055, py); ctx.arc(px, py, 0.055, 0, TAU);
  }
  ctx.fillStyle = '#f08a12'; ctx.fill();
  ctx.strokeStyle = '#bd6410'; ctx.lineWidth = LW * 0.6; ctx.stroke();
  // glints
  ctx.beginPath();
  oval(ctx, -0.42, -0.55, 0.05, 0.16, -0.65);
  oval(ctx, -0.6, -0.12, 0.035, 0.1, -1.2);
  oval(ctx, -0.2, -0.36, 0.035, 0.09, -0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
}

let gPeace: CanvasGradient | null = null;
function notchPetal(ctx: C, w: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 0.9, -0.12, -w * 1.2, -0.78, -w * 0.52, -0.97);
  ctx.quadraticCurveTo(-w * 0.18, -1.04, 0, -0.9);
  ctx.quadraticCurveTo(w * 0.18, -1.04, w * 0.52, -0.97);
  ctx.bezierCurveTo(w * 1.2, -0.78, w * 0.9, -0.12, 0, 0);
  ctx.closePath();
}
function headPeace(ctx: C, st: Style): void {
  if (!gPeace) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, '#ff7fb4'); g.addColorStop(0.2, '#ffb3d2'); g.addColorStop(0.45, '#ffeaf2'); g.addColorStop(0.75, '#fffbfc'); g.addColorStop(1, '#ffffff');
    gPeace = g;
  }
  const step = TAU / 6;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.fillStyle = gPeace;
  ctx.save();
  for (let i = 0; i < 6; i++) { ctx.rotate(step); notchPetal(ctx, 0.56); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // soft pink veins
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.rotate(step);
    ctx.moveTo(0, -0.25); ctx.lineTo(0, -0.62);
    ctx.moveTo(-0.09, -0.27); ctx.quadraticCurveTo(-0.17, -0.45, -0.2, -0.56);
    ctx.moveTo(0.09, -0.27); ctx.quadraticCurveTo(0.17, -0.45, 0.2, -0.56);
  }
  ctx.globalAlpha = 0.35; ctx.strokeStyle = '#e07aa6'; ctx.lineWidth = LW * 0.6; ctx.lineCap = 'round'; ctx.stroke();
  ctx.restore();
  // stamen ring + green-gold centre
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10, px = Math.cos(a) * 0.25, py = Math.sin(a) * 0.25;
    ctx.moveTo(px + 0.045, py); ctx.arc(px, py, 0.045, 0, TAU);
  }
  ctx.fillStyle = '#f2c53a'; ctx.fill();
  centreDisc(ctx, 0.19, '#f6ffc0', '#d6e46c', '#9fb534', '#7a9228', 0);
}

function trumpet(ctx: C, r0: number, len: number, w: number): void {
  // a cornflower floret: thin tube flaring into a toothed fan
  ctx.beginPath();
  ctx.moveTo(-w * 0.16, -r0);
  ctx.quadraticCurveTo(-w * 0.2, -len * 0.62, -w, -len * 0.9);
  for (let k = 0; k < 5; k++) {
    const x = -w * 0.8 + k * w * 0.4;
    ctx.lineTo(x, -len * (1.0 - 0.05 * (x / w) * (x / w)));
    if (k < 4) ctx.lineTo(x + w * 0.2, -len * 0.89);
  }
  ctx.lineTo(w, -len * 0.9);
  ctx.quadraticCurveTo(w * 0.2, -len * 0.62, w * 0.16, -r0);
  ctx.closePath();
}
function headCornflower(ctx: C, st: Style): void {
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.save();
  ctx.fillStyle = gDg(ctx, st);
  ctx.rotate(0.3);
  for (let i = 0; i < 9; i++) { ctx.rotate(TAU / 9); trumpet(ctx, 0.15, 1, 0.27); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = gPg(ctx, st);
  for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); trumpet(ctx, 0.15, 0.84, 0.25); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // glints on the frilly fans
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); oval(ctx, -0.1, -0.68, 0.035, 0.1, 0.35); }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
  ctx.restore();
  // little violet inner florets
  const vi = sty(CORN_IN);
  ctx.save();
  ctx.rotate(0.2);
  ctx.fillStyle = gPg(ctx, vi); ctx.strokeStyle = vi.stroke;
  for (let i = 0; i < 9; i++) { ctx.rotate(TAU / 9); trumpet(ctx, 0.05, 0.42, 0.1); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // dark violet centre with pale stamen tips
  ctx.beginPath(); ctx.arc(0, 0, 0.17, 0, TAU);
  ctx.fillStyle = '#4a2f8a'; ctx.fill();
  ctx.strokeStyle = '#2f1d5e'; ctx.lineWidth = LW * 0.8; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4 + 0.3, d = 0.04 + 0.08 * ((i * 0.618) % 1);
    const px = Math.cos(a) * d, py = Math.sin(a) * d;
    ctx.moveTo(px + 0.028, py); ctx.arc(px, py, 0.028, 0, TAU);
  }
  ctx.fillStyle = '#c9b8ff'; ctx.fill();
}

// tiger lily: spots on each petal [x, y, r]
const LILY_SPOTS = [-0.05, -0.26, 0.034, 0.07, -0.33, 0.03, -0.08, -0.43, 0.03, 0.05, -0.5, 0.034, -0.03, -0.6, 0.026, 0.1, -0.6, 0.024, -0.09, -0.68, 0.022];
function lilyPetal(ctx: C, len: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 1.25, -len * 0.2, -w * 1.1, -len * 0.76, 0, -len);
  ctx.bezierCurveTo(w * 1.1, -len * 0.76, w * 1.25, -len * 0.2, 0, 0);
  ctx.closePath();
}
function tigerPetal(ctx: C, st: Style, len: number, w: number): void {
  lilyPetal(ctx, len, w);
  ctx.fill(); ctx.stroke();
  // the tip rolls backwards: show its darker underside, with a light rim along the fold
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-w, -len * 0.74);
  ctx.quadraticCurveTo(0, -len * 0.86, w, -len * 0.74);
  ctx.lineTo(w, -len * 1.1); ctx.lineTo(-w, -len * 1.1);
  ctx.closePath();
  ctx.fillStyle = st.deep; ctx.globalAlpha = 0.75; ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(-w, -len * 0.74); ctx.quadraticCurveTo(0, -len * 0.86, w, -len * 0.74);
  ctx.strokeStyle = st.light; ctx.lineWidth = LW * 1.4; ctx.stroke();
  ctx.restore();
  // midline groove
  ctx.save();
  ctx.globalAlpha = 0.4; ctx.strokeStyle = '#fff1b0'; ctx.lineWidth = LW * 1.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -len * 0.12); ctx.lineTo(0, -len * 0.7); ctx.stroke();
  ctx.restore();
  // spots
  ctx.beginPath();
  for (let i = 0; i < LILY_SPOTS.length; i += 3) {
    const x = LILY_SPOTS[i] * len, y = LILY_SPOTS[i + 1] * len, r = LILY_SPOTS[i + 2] * len;
    ctx.moveTo(x + r, y); ctx.ellipse(x, y, r, r * 1.3, 0, 0, TAU);
  }
  ctx.fillStyle = 'rgba(122,36,24,0.85)'; ctx.fill();
  // glint
  ctx.beginPath(); ctx.ellipse(-w * 0.45, -len * 0.42, w * 0.13, len * 0.13, 0.15, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
}
function headTigerLily(ctx: C, st: Style): void {
  const step = TAU / 3;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.save();
  ctx.rotate(step / 2);
  ctx.fillStyle = gDg(ctx, st);
  for (let i = 0; i < 3; i++) { ctx.rotate(step); tigerPetal(ctx, st, 1, 0.3); ctx.strokeStyle = st.stroke; ctx.fillStyle = gDg(ctx, st); }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = gPg(ctx, st);
  for (let i = 0; i < 3; i++) { ctx.rotate(step); tigerPetal(ctx, st, 0.96, 0.32); ctx.strokeStyle = st.stroke; ctx.fillStyle = gPg(ctx, st); }
  ctx.restore();
  // throat
  ctx.beginPath(); ctx.arc(0, 0, 0.13, 0, TAU);
  ctx.fillStyle = '#ffcf5a'; ctx.fill();
  // long stamens with dark red anthers, plus the green pistil
  ctx.save();
  ctx.lineCap = 'round';
  ctx.rotate(0.35);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(TAU / 6);
    const bend = i % 2 ? 0.12 : -0.12, len = i % 2 ? 0.98 : 0.9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(bend, -len * 0.55, bend * 0.4, -len);
    ctx.strokeStyle = '#c4521a'; ctx.lineWidth = 0.05; ctx.stroke();
    ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 0.025; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(bend * 0.4, -len - 0.02, 0.1, 0.045, 0.15, 0, TAU);
    ctx.fillStyle = '#8a1e2a'; ctx.fill();
    ctx.strokeStyle = '#5e1420'; ctx.lineWidth = LW * 0.6; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(bend * 0.4 - 0.04, -len - 0.035, 0.035, 0.014, 0.15, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-0.08, -0.4, 0.04, -0.72);
  ctx.strokeStyle = '#4a8a37'; ctx.lineWidth = 0.065; ctx.stroke();
  ctx.strokeStyle = '#9ed36e'; ctx.lineWidth = 0.035; ctx.stroke();
  ctx.beginPath(); ctx.arc(0.04, -0.74, 0.05, 0, TAU);
  ctx.fillStyle = '#9ed36e'; ctx.fill(); ctx.strokeStyle = '#4a8a37'; ctx.lineWidth = LW * 0.6; ctx.stroke();
  ctx.restore();
}

function heartPetal(ctx: C): void {
  ctx.beginPath();
  ctx.moveTo(0, -0.06);
  ctx.bezierCurveTo(-0.28, -0.2, -0.6, -0.46, -0.52, -0.8);
  ctx.bezierCurveTo(-0.44, -1.06, -0.1, -1.06, 0, -0.84);
  ctx.bezierCurveTo(0.1, -1.06, 0.44, -1.06, 0.52, -0.8);
  ctx.bezierCurveTo(0.6, -0.46, 0.28, -0.2, 0, -0.06);
  ctx.closePath();
}
function headHeart(ctx: C, st: Style): void {
  const step = TAU / 5;
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.fillStyle = gRg(ctx, st);
  ctx.save();
  ctx.rotate(-step / 2);
  for (let i = 0; i < 5; i++) { ctx.rotate(step); heartPetal(ctx); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // a crease into each heart's dip, and shiny glints on the lobes
  ctx.save();
  ctx.rotate(-step / 2);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) { ctx.rotate(step); ctx.moveTo(0, -0.84); ctx.quadraticCurveTo(0.02, -0.74, 0, -0.66); }
  ctx.globalAlpha = 0.4; ctx.lineWidth = LW * 0.8; ctx.lineCap = 'round'; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.rotate(step);
    oval(ctx, -0.3, -0.8, 0.055, 0.11, -0.6);
    ctx.moveTo(0.33, -0.89); ctx.arc(0.3, -0.89, 0.03, 0, TAU);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  ctx.restore();
  centreDisc(ctx, 0.2, '#fff3a8', '#ffd45c', '#eca82c', '#c99a22', 6);
}

// lotus (side view): petals [angle, length, width, row]; row 0 = low outer, 1 = back fan, 2 = front
const LOTUS = [
  -1.62, 0.6, 0.27, 0, 1.62, 0.6, 0.27, 0,
  -1.12, 0.84, 0.3, 1, 1.12, 0.84, 0.3, 1, -0.58, 1.0, 0.31, 1, 0.58, 1.0, 0.31, 1, 0, 1.08, 0.31, 1,
  -0.82, 0.8, 0.33, 2, 0.82, 0.8, 0.33, 2, -0.32, 0.9, 0.34, 2, 0.32, 0.9, 0.34, 2,
];
function lotusPetal(ctx: C, len: number, w: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 1.15, -len * 0.12, -w * 1.15, -len * 0.62, 0, -len);
  ctx.bezierCurveTo(w * 1.15, -len * 0.62, w * 1.15, -len * 0.12, 0, 0);
  ctx.closePath();
}
function snowflake(ctx: C, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + 0.26, c = Math.cos(a) * r, s = Math.sin(a) * r;
    ctx.moveTo(x - c, y - s); ctx.lineTo(x + c, y + s);
  }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, TAU); ctx.fill();
}
function headLotus(ctx: C, st: Style, frost: boolean): void {
  const pulse = 0.5 + 0.5 * Math.sin(CT * 1.8 + PH);
  // glow halo
  ctx.save();
  ctx.translate(0, -0.5);
  ctx.scale(1.75, 1.6);
  ctx.globalAlpha = 0.45 + 0.35 * pulse;
  ctx.fillStyle = gHalo(ctx, st);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  for (let i = 0; i < LOTUS.length; i += 4) {
    const a = LOTUS[i], len = LOTUS[i + 1], w = LOTUS[i + 2], row = LOTUS[i + 3];
    ctx.save();
    ctx.translate(Math.sin(a) * 0.1, row === 2 ? 0.02 : 0);
    ctx.rotate(a);
    lotusPetal(ctx, len, w);
    ctx.fillStyle = row === 2 ? gPg(ctx, st) : gDg(ctx, st);
    ctx.fill(); ctx.stroke();
    ctx.lineCap = 'round';
    if (frost) {
      // crystalline facets
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.08); ctx.lineTo(0, -len * 0.92);
      ctx.moveTo(-w * 0.75, -len * 0.3); ctx.lineTo(0, -len * 0.5); ctx.lineTo(w * 0.75, -len * 0.3);
      ctx.moveTo(-w * 0.55, -len * 0.62); ctx.lineTo(0, -len * 0.78); ctx.lineTo(w * 0.55, -len * 0.62);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = LW * 1.1; ctx.stroke();
      ctx.globalAlpha = 0.3; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.5; ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.12); ctx.lineTo(0, -len * 0.8);
      ctx.moveTo(-w * 0.35, -len * 0.18); ctx.quadraticCurveTo(-w * 0.55, -len * 0.5, -w * 0.25, -len * 0.75);
      ctx.moveTo(w * 0.35, -len * 0.18); ctx.quadraticCurveTo(w * 0.55, -len * 0.5, w * 0.25, -len * 0.75);
      ctx.globalAlpha = 0.25; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.6; ctx.stroke();
    }
    // shimmer: a glint that sweeps across the petals
    const s = Math.max(0, Math.sin(CT * 2.2 - i * 0.22 + PH));
    ctx.globalAlpha = (row === 0 ? 0.2 : 0.35) + 0.55 * s * s;
    ctx.beginPath(); ctx.ellipse(-w * 0.42, -len * (0.5 + 0.1 * s), w * 0.12, len * 0.17, 0.12, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = st.stroke; ctx.lineWidth = LW;
    ctx.restore();
  }
  // twinkles (snowflakes for frost, sparkles for gold)
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const tw = Math.max(0, Math.sin(CT * 2.3 + PH + i * 2.1));
    if (tw < 0.05) continue;
    const x = (i - 1) * 0.95 + Math.sin(PH + i) * 0.1, y = -1.05 - (i === 1 ? 0.2 : 0) + (i === 1 ? 0 : 0.25);
    ctx.globalAlpha = tw;
    if (frost) { ctx.lineWidth = 0.045; snowflake(ctx, x, y, 0.1 + 0.08 * tw); }
    else { sparkle(ctx, x, y, 0.1 + 0.14 * tw); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

let gMoon: CanvasGradient | null = null;
function headMoon(ctx: C, st: Style): void {
  const pulse = 0.5 + 0.5 * Math.sin(CT * 1.6 + PH);
  // lilac night glow
  ctx.save();
  ctx.scale(1.95, 1.95);
  ctx.globalAlpha = 0.4 + 0.45 * pulse;
  ctx.fillStyle = gHalo(ctx, sty(MOONGLOW));
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  if (!gMoon) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, '#cdb8ff'); g.addColorStop(0.3, '#ece4ff'); g.addColorStop(0.62, '#fdfbff'); g.addColorStop(1, '#ffffff');
    gMoon = g;
  }
  // star-shaped trumpet face: five points joined by gently scalloped edges
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2, am = a + Math.PI / 5, an = a + TAU / 5;
    if (i === 0) ctx.moveTo(Math.cos(a), Math.sin(a));
    ctx.quadraticCurveTo(Math.cos(am) * 0.66, Math.sin(am) * 0.66, Math.cos(an), Math.sin(an));
  }
  ctx.closePath();
  ctx.fillStyle = gMoon; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke; ctx.stroke();
  // pale star pattern and ribs
  ctx.save();
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#b9a2ff';
  starPath(ctx, 0.92); ctx.fill();
  ctx.globalAlpha = 0.5; ctx.strokeStyle = '#b6a4ec'; ctx.lineWidth = LW * 0.8; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    ctx.moveTo(Math.cos(a) * 0.2, Math.sin(a) * 0.2); ctx.lineTo(Math.cos(a) * 0.93, Math.sin(a) * 0.93);
  }
  ctx.stroke();
  ctx.restore();
  // throat + creamy stamens
  centreDisc(ctx, 0.15, '#fffbe6', '#f6efb8', '#dccf80', '#b8aa5c', 0);
  // tiny crescent moon
  const tw = 0.7 + 0.3 * pulse;
  ctx.save();
  ctx.translate(0.78, -0.86);
  ctx.globalAlpha = tw;
  ctx.beginPath();
  ctx.arc(0, 0, 0.2, 0.9, 0.9 + 4.6);
  ctx.arc(0.08, -0.06, 0.16, 0.9 + 4.15, 1.4, true);
  ctx.closePath();
  ctx.fillStyle = '#fff1a8'; ctx.fill();
  ctx.strokeStyle = '#d9b84a'; ctx.lineWidth = LW * 0.8; ctx.stroke();
  ctx.fillStyle = '#ffffff';
  const t2 = Math.max(0, Math.sin(CT * 2.4 + PH + 1));
  sparkle(ctx, 0.3, 0.12, 0.05 + 0.08 * t2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

let gFireOut: CanvasGradient | null = null, gFireIn: CanvasGradient | null = null;
function flamePetal(ctx: C, w: number, k: number): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 1.25, -0.14, -w * 1.25, -0.56, -w * 0.45 + k * 0.4, -0.76);
  ctx.quadraticCurveTo(-w * 0.1 + k * 0.9, -0.88, k * 1.6 - w * 0.12, -1.05);
  ctx.quadraticCurveTo(w * 0.42 + k, -0.86, w * 0.62 + k * 0.4, -0.7);
  ctx.bezierCurveTo(w * 1.25, -0.5, w * 1.15, -0.14, 0, 0);
  ctx.closePath();
}
function headPhoenix(ctx: C): void {
  if (!gFireOut) {
    let g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, '#c81e3c'); g.addColorStop(0.4, '#ff4a2a'); g.addColorStop(0.75, '#ff9a2a'); g.addColorStop(1, '#ffd85a');
    gFireOut = g;
    g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, '#ff6a1a'); g.addColorStop(0.5, '#ffb52e'); g.addColorStop(1, '#fff2a0');
    gFireIn = g;
  }
  const fs = sty(FIRE);
  const pulse = 0.5 + 0.5 * Math.sin(CT * 3.1 + PH);
  // warm glow
  ctx.save();
  ctx.translate(0, -0.3);
  ctx.scale(1.9, 1.9);
  ctx.globalAlpha = 0.45 + 0.3 * pulse;
  ctx.fillStyle = gHalo(ctx, fs);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.lineJoin = 'round';
  // outer crown of flames: longest at the top, swept upwards
  ctx.fillStyle = gFireOut; ctx.strokeStyle = '#a3202e'; ctx.lineWidth = LW;
  for (let i = 0; i < 11; i++) {
    const a0 = (i / 11) * TAU + Math.PI / 11 - Math.PI;
    const a = a0 * 0.92;
    const len = 0.6 + 0.48 * (0.5 + 0.5 * Math.cos(a0));
    const k = Math.sin(CT * 5.2 + i * 1.7 + PH) * 0.06 + Math.sin(CT * 8.3 + i) * 0.025 - Math.sin(a) * 0.08;
    ctx.save(); ctx.rotate(a); ctx.scale(len, len); ctx.lineWidth = LW / len;
    flamePetal(ctx, 0.25, k); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // inner flames
  ctx.fillStyle = gFireIn!; ctx.strokeStyle = '#d0661a';
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * TAU + Math.PI / 8 - Math.PI;
    const a = a0 * 0.9;
    const len = 0.5 + 0.22 * (0.5 + 0.5 * Math.cos(a0));
    const k = Math.sin(CT * 6.1 + i * 2.3 + PH) * 0.07 - Math.sin(a) * 0.06;
    ctx.save(); ctx.rotate(a); ctx.scale(len, len); ctx.lineWidth = LW / len;
    flamePetal(ctx, 0.3, k); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.beginPath(); ctx.ellipse(-0.1 + k * 0.5, -0.55, 0.05, 0.16, 0.15, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = gFireIn!; ctx.globalAlpha = 1;
    ctx.restore();
  }
  // golden centre
  centreDisc(ctx, 0.2, '#fffbe0', '#ffd84a', '#f0a020', '#c27a14', 5);
  // embers drifting up
  for (let i = 0; i < 6; i++) {
    const p = (CT * 0.42 + i / 6 + PH * 0.05) % 1;
    const x = Math.sin(i * 2.3 + PH) * 0.75 + Math.sin(CT * 2.1 + i * 1.3) * 0.08 * p;
    const y = -0.5 - p * 1.25;
    const r = 0.06 * (1 - p) + 0.02;
    ctx.globalAlpha = Math.sin(p * Math.PI);
    ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, TAU);
    ctx.fillStyle = 'rgba(255,160,60,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = '#ffe48a'; ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- winter-term heads
const CROCUS: Col = { fill: '#a679f2', stroke: '#6440b2' };
const SWEETPEA_MAG: Col = { fill: '#ec6fcf', stroke: '#a3358c' };
const JAZZ: Col = { fill: '#7fb0ff', stroke: '#3f6fc9' };
const COSMOS_PINK: Col = { fill: '#ff92c6', stroke: '#c9508c' };
const COSMOS_MAG: Col = { fill: '#e8559e', stroke: '#a22a66' };
const COSMOS_PALE: Col = { fill: '#ffd0e6', stroke: '#c25a8c' };
const ALLIUM: Col = { fill: '#b47ae8', stroke: '#6b3fae' };
const SPANGLE: Col = { fill: '#ffd83a', stroke: '#1d8b96' };
const POINS: Col = { fill: '#e8333d', stroke: '#9a1828' };
const POINS_IN: Col = { fill: '#ff5048', stroke: '#a81c28' };
const POINS_LEAF: Col = { fill: '#4fa54a', stroke: '#2c6a30' };
const FAIRY: Col = { fill: '#e6c8fa', stroke: '#9070c8' };
const FAIRYGLOW: Col = { fill: '#e6b8ff', stroke: '#a77ad6' };
const TORCH: Col = { fill: '#ff6a2a', stroke: '#9e2a1c' };
const AURORA: Col = { fill: '#5fe6a8', stroke: '#2a7f78' };
const FROSTLEAF: Col = { fill: '#8fd4b8', stroke: '#3f8a7a' };
const LILYW: Col = { fill: '#fdfefb', stroke: '#4f7a5e' };

function crocusPetal(ctx: C, len: number, w: number): void {
  // slender goblet petal: narrow at the base, widest near the top, softly pointed
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 0.55, -len * 0.08, -w * 1.25, -len * 0.5, -w * 0.82, -len * 0.86);
  ctx.quadraticCurveTo(-w * 0.45, -len * 1.0, 0, -len * 1.04);
  ctx.quadraticCurveTo(w * 0.45, -len * 1.0, w * 0.82, -len * 0.86);
  ctx.bezierCurveTo(w * 1.25, -len * 0.5, w * 0.55, -len * 0.08, 0, 0);
  ctx.closePath();
}
function headCrocus(ctx: C, st: Style, b: number): void {
  const open = 0.6 + 0.4 * clamp01(b);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  // three inner petals at the back of the goblet
  ctx.fillStyle = gDg(ctx, st);
  for (const a of [-0.26, 0.26, 0]) {
    ctx.save(); ctx.rotate(a * open); crocusPetal(ctx, a ? 0.96 : 1.04, 0.27); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // golden stamens and the bright orange, frilly stigma rising out of the cup
  ctx.beginPath();
  ctx.moveTo(-0.04, -0.2); ctx.lineTo(-0.19, -0.7);
  ctx.moveTo(0.04, -0.2); ctx.lineTo(0.19, -0.7);
  ctx.strokeStyle = '#d99a1c'; ctx.lineWidth = 0.04; ctx.stroke();
  ctx.beginPath();
  oval(ctx, -0.2, -0.74, 0.05, 0.11, -0.3);
  oval(ctx, 0.2, -0.74, 0.05, 0.11, 0.3);
  ctx.fillStyle = '#ffe04a'; ctx.fill();
  ctx.strokeStyle = '#c99a22'; ctx.lineWidth = LW * 0.6; ctx.stroke();
  ctx.beginPath();
  for (const x of [-0.11, 0, 0.11]) { ctx.moveTo(0, -0.2); ctx.quadraticCurveTo(x * 0.4, -0.6, x, -0.84); }
  ctx.strokeStyle = '#e8600e'; ctx.lineWidth = 0.06; ctx.stroke();
  ctx.beginPath();
  for (const x of [-0.11, 0, 0.11]) {
    // each stigma ends in a little frilly fan
    ctx.moveTo(x - 0.025, -0.8);
    ctx.quadraticCurveTo(x * 1.7 - 0.11, -0.93, x * 1.6 - 0.08, -0.99);
    ctx.quadraticCurveTo(x * 1.6, -0.95, x * 1.6 + 0.08, -0.99);
    ctx.quadraticCurveTo(x * 1.7 + 0.11, -0.93, x + 0.025, -0.8);
    ctx.closePath();
  }
  ctx.fillStyle = '#ff8a1c'; ctx.fill();
  ctx.strokeStyle = '#c4520e'; ctx.lineWidth = LW * 0.7; ctx.stroke();
  // three outer petals in front, shorter so the stigma shows
  ctx.fillStyle = gPg(ctx, st); ctx.strokeStyle = st.stroke; ctx.lineWidth = LW;
  for (const a of [-0.15, 0.15]) {
    ctx.save(); ctx.rotate(a * open); crocusPetal(ctx, 0.76, 0.27); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  ctx.save();
  crocusPetal(ctx, 0.66, 0.28); ctx.fill(); ctx.stroke();
  // dark feathered stripes at the base and a glint
  ctx.beginPath();
  ctx.moveTo(0, -0.06); ctx.lineTo(0, -0.36);
  ctx.moveTo(-0.06, -0.08); ctx.quadraticCurveTo(-0.13, -0.2, -0.13, -0.3);
  ctx.moveTo(0.06, -0.08); ctx.quadraticCurveTo(0.13, -0.2, 0.13, -0.3);
  ctx.globalAlpha = 0.45; ctx.strokeStyle = st.deep; ctx.lineWidth = LW * 0.9; ctx.stroke();
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-0.17, -0.42, 0.045, 0.14, 0.15, 0, TAU); ctx.fill();
  ctx.restore();
}

// sweet pea colourways: [standard petal, wing petals]
const SWEETPEA: readonly (readonly [Col, Col])[] = [
  [PETALS.lilac, VIOLET], [PETALS.pink, SWEETPEA_MAG], [SWEETPEA_MAG, RASP], [PETALS.pink, PETALS.lilac],
];
/** A curly tendril from (x, y): it winds inwards in a tight spiral around (x + dx, y + dy). */
function tendrilPath(ctx: C, x: number, y: number, dx: number, dy: number, dir: number): void {
  const r0 = Math.hypot(dx, dy), a0 = Math.atan2(-dy, -dx);
  ctx.moveTo(x, y);
  for (let k = 1; k <= 30; k++) {
    const t = k / 30, r = r0 * Math.pow(1 - t, 1.5) * 0.92 + r0 * 0.06;
    const a = a0 + dir * t * 2.3 * Math.PI;
    ctx.lineTo(x + dx + Math.cos(a) * r, y + dy + Math.sin(a) * r);
  }
}
function peaFlower(ctx: C, std: Style, wing: Style): void {
  // the big frilly "standard" petal at the back
  ctx.beginPath();
  ctx.moveTo(0, 0.18);
  ctx.bezierCurveTo(-0.62, 0.16, -1.02, -0.22, -0.84, -0.6);
  ctx.quadraticCurveTo(-0.78, -0.92, -0.44, -0.9);
  ctx.quadraticCurveTo(-0.24, -1.06, 0, -0.86);
  ctx.quadraticCurveTo(0.24, -1.06, 0.44, -0.9);
  ctx.quadraticCurveTo(0.78, -0.92, 0.84, -0.6);
  ctx.bezierCurveTo(1.02, -0.22, 0.62, 0.16, 0, 0.18);
  ctx.closePath();
  ctx.fillStyle = gPg(ctx, std); ctx.fill();
  ctx.strokeStyle = std.stroke; ctx.lineWidth = LW; ctx.stroke();
  // fine veins fanning out, and a glint
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) { ctx.moveTo(0, 0.02); ctx.quadraticCurveTo(i * 0.16, -0.3, i * 0.3, -0.72 + Math.abs(i) * 0.06); }
  ctx.globalAlpha = 0.3; ctx.lineWidth = LW * 0.6; ctx.stroke();
  ctx.globalAlpha = 0.65; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-0.52, -0.52, 0.06, 0.17, -0.6, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // two wing petals hugging the little keel
  ctx.fillStyle = gRg(ctx, wing); ctx.strokeStyle = wing.stroke; ctx.lineWidth = LW;
  ctx.beginPath(); ctx.ellipse(-0.22, 0.1, 0.27, 0.34, 0.55, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0.22, 0.1, 0.27, 0.34, -0.55, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0.32, 0.12, 0.16, 0, 0, TAU);
  ctx.fillStyle = wing.pale; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-0.27, 0.02, 0.05, 0.11, 0.55, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
}
// sweet pea sprays: [x, y, scale, rotation], back to front
const PEAS = [[-0.62, 0.0, 0.5, -0.55], [0.64, 0.12, 0.44, 0.6], [0.02, -0.58, 0.64, 0.05]];
function headSweetPea(ctx: C, seed: number): void {
  const [sc, wc] = pick(SWEETPEA, seed, 6);
  const std = sty(sc), wing = sty(wc);
  const lw = LW;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // curly tendrils and the flower stalks
  ctx.beginPath();
  tendrilPath(ctx, -0.1, 0.25, -0.62, 0.36, -1);
  tendrilPath(ctx, 0.12, 0.3, 0.5, 0.42, 1);
  for (const [x, y, s] of PEAS) { ctx.moveTo(0, 0.3); ctx.quadraticCurveTo(x * 0.15, y * 0.3, x, y + s * 0.42); }
  ctx.strokeStyle = STEM.stroke; ctx.lineWidth = 0.075 + lw; ctx.stroke();
  ctx.strokeStyle = STEM.fill; ctx.lineWidth = 0.075; ctx.stroke();
  for (const [x, y, s, a] of PEAS) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    LW = lw / s;
    // little green calyx
    ctx.beginPath(); ctx.ellipse(0, 0.56, 0.13, 0.17, 0, 0, TAU);
    ctx.fillStyle = LEAF.fill; ctx.fill(); ctx.strokeStyle = LEAF.stroke; ctx.lineWidth = LW; ctx.stroke();
    peaFlower(ctx, std, wing);
    ctx.restore();
  }
  LW = lw;
}

/** Sweet pea tendrils curling from the stem, in flower space (pixels). */
function stemTendrils(ctx: C, H: number, g2: number, dir: number): void {
  const e = easeOutCubic(clamp01(g2 * 1.4 - 0.3));
  if (e <= 0) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  stemAt(0.42); tendrilPath(ctx, PX, PY, dir * H * 0.13 * e, -H * 0.03 * e, dir);
  stemAt(0.66); tendrilPath(ctx, PX, PY, -dir * H * 0.11 * e, -H * 0.05 * e, -dir);
  const w = Math.max(1.1, H * 0.01);
  ctx.strokeStyle = STEM.stroke; ctx.lineWidth = w + OW; ctx.stroke();
  ctx.strokeStyle = STEM.fill; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
}

const ballG = new WeakMap<Style, CanvasGradient>();
/** A round ball lit from the top left. */
function ballGrad(ctx: C, st: Style): CanvasGradient {
  let g = ballG.get(st);
  if (!g) {
    g = ctx.createRadialGradient(-0.35, -0.42, 0.04, 0, 0, 1.05);
    g.addColorStop(0, st.pale); g.addColorStop(0.3, st.light); g.addColorStop(0.65, st.fill); g.addColorStop(1, st.dark);
    ballG.set(st, g);
  }
  return g;
}

// blue jazz: rings of little cupped petals [count, radius, size], outside in
const JAZZ_RINGS = [[15, 0.74, 0.34], [12, 0.52, 0.3], [8, 0.3, 0.27], [4, 0.1, 0.22]];
let gJazzShade: CanvasGradient | null = null;
/** One ring of blue jazz's cupped petals, added to the current path. */
function jazzRing(ctx: C, r: number): void {
  const [n, rad, s] = JAZZ_RINGS[r];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r * 0.4;
    ctx.save();
    ctx.translate(Math.cos(a) * rad, Math.sin(a) * rad);
    ctx.rotate(a + Math.PI / 2);
    ctx.moveTo(0, s * 0.5);
    ctx.bezierCurveTo(-s * 0.75, s * 0.4, -s * 0.72, -s * 0.5, 0, -s * 0.52);
    ctx.bezierCurveTo(s * 0.72, -s * 0.5, s * 0.75, s * 0.4, 0, s * 0.5);
    ctx.restore();
  }
}
function headBlueJazz(ctx: C, st: Style): void {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const g = ballGrad(ctx, st);
  // a little green calyx cup holding the ball
  const lf = sty(LEAF);
  ctx.beginPath();
  for (const a of [-0.75, 0, 0.75]) {
    ctx.save(); ctx.translate(0, 0.86); ctx.rotate(a * 1.1);
    ctx.moveTo(0, 0.12); ctx.quadraticCurveTo(-0.22, 0.0, 0, -0.36); ctx.quadraticCurveTo(0.22, 0.0, 0, 0.12);
    ctx.restore();
  }
  ctx.fillStyle = lf.fill; ctx.fill();
  ctx.strokeStyle = lf.stroke; ctx.lineWidth = LW; ctx.stroke();
  for (let r = 0; r < JAZZ_RINGS.length; r++) {
    const [n, rad, s] = JAZZ_RINGS[r];
    // the petals of a ring share one path (lit as one ball), then get a pale inner rim each
    ctx.beginPath();
    jazzRing(ctx, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = st.stroke; ctx.lineWidth = LW; ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r * 0.4;
      ctx.save();
      ctx.translate(Math.cos(a) * rad, Math.sin(a) * rad);
      ctx.rotate(a + Math.PI / 2);
      ctx.moveTo(-s * 0.36, -s * 0.12);
      ctx.quadraticCurveTo(0, -s * 0.42, s * 0.36, -s * 0.12);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = LW * 1.1; ctx.stroke();
  }
  // shade the lower right of the ball so it reads as a sphere
  if (!gJazzShade) {
    gJazzShade = ctx.createLinearGradient(-0.5, -0.6, 0.55, 0.75);
    gJazzShade.addColorStop(0, 'rgba(36,58,140,0)'); gJazzShade.addColorStop(0.5, 'rgba(36,58,140,0)'); gJazzShade.addColorStop(1, 'rgba(36,58,140,0.42)');
  }
  ctx.save();
  ctx.beginPath(); jazzRing(ctx, 0); ctx.moveTo(0.7, 0); ctx.arc(0, 0, 0.7, 0, TAU);
  ctx.clip();
  ctx.fillStyle = gJazzShade; ctx.fillRect(-1.1, -1.1, 2.2, 2.2);
  ctx.restore();
  // a pale heart and a shiny glint
  ctx.beginPath(); ctx.arc(0, 0, 0.09, 0, TAU);
  ctx.fillStyle = '#eaf2ff'; ctx.fill();
  ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.8; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-0.42, -0.5, 0.1, 0.18, -0.7, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
}

function cosmosPetal(ctx: C, w: number): void {
  // a wide wedge with three little teeth across its tip
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 0.4, -0.18, -w * 1.1, -0.62, -w * 1.0, -0.9);
  ctx.quadraticCurveTo(-w * 0.9, -1.01, -w * 0.64, -1.0);
  ctx.lineTo(-w * 0.33, -0.95);
  ctx.quadraticCurveTo(-w * 0.2, -1.04, 0, -1.04);
  ctx.quadraticCurveTo(w * 0.2, -1.04, w * 0.33, -0.95);
  ctx.lineTo(w * 0.64, -1.0);
  ctx.quadraticCurveTo(w * 0.9, -1.01, w * 1.0, -0.9);
  ctx.bezierCurveTo(w * 1.1, -0.62, w * 0.4, -0.18, 0, 0);
  ctx.closePath();
}
const cosG = new WeakMap<Style, CanvasGradient>();
function headCosmos(ctx: C, st: Style): void {
  const step = TAU / 8;
  let g = cosG.get(st);
  if (!g) {
    // a deep crimson ring at the base of each petal, fading to a pale tip
    g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, '#8a1840'); g.addColorStop(0.36, '#b82a62'); g.addColorStop(0.5, mix(st.fill, '#c8306a', 0.35)); g.addColorStop(0.64, st.fill); g.addColorStop(1, st.light);
    cosG.set(st, g);
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.save();
  ctx.rotate(0.2);
  ctx.fillStyle = g;
  for (let i = 0; i < 8; i++) { ctx.rotate(step); cosmosPetal(ctx, 0.32); ctx.fill(); ctx.stroke(); }
  // fine veins and glints
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    ctx.rotate(step);
    ctx.moveTo(0, -0.3); ctx.lineTo(0, -0.86);
    ctx.moveTo(-0.06, -0.34); ctx.quadraticCurveTo(-0.17, -0.6, -0.2, -0.84);
    ctx.moveTo(0.06, -0.34); ctx.quadraticCurveTo(0.17, -0.6, 0.2, -0.84);
  }
  ctx.globalAlpha = 0.3; ctx.lineWidth = LW * 0.6; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { ctx.rotate(step); oval(ctx, -0.17, -0.66, 0.04, 0.13, 0.2); }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.restore();
  // a ring of golden florets around the button centre
  ctx.beginPath();
  for (let i = 0; i < 13; i++) {
    const a = i * TAU / 13, px = Math.cos(a) * 0.25, py = Math.sin(a) * 0.25;
    ctx.moveTo(px + 0.06, py); ctx.arc(px, py, 0.06, 0, TAU);
  }
  ctx.fillStyle = '#ffcf3a'; ctx.fill();
  ctx.strokeStyle = '#c99a22'; ctx.lineWidth = LW * 0.6; ctx.stroke();
  centreDisc(ctx, 0.2, '#fff3a8', '#ffcf3a', '#e09a1c', '#b8801a', 6);
}

/** A thread-like cosmos leaf: a curved rib with fine paired leaflets (flower space, pixels). */
function featherLeaf(ctx: C, len: number, bend: number): void {
  if (len < 0.5) return;
  ctx.save();
  ctx.scale(len, len);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(bend, -0.5, bend * 0.3, -1);
  for (let k = 1; k <= 5; k++) {
    const t = 0.12 + k * 0.155, m = 1 - t;
    const x = 2 * m * t * bend + t * t * bend * 0.3, y = -(2 * m * t * 0.5 + t * t);
    const l = 0.32 * (1 - t * 0.55);
    for (const sd of [-1, 1]) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sd * l * 0.6, y - l * 0.15, x + sd * l * 0.85, y - l * 0.7);
    }
  }
  const w = Math.max(1.2, len * 0.04);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = LEAF.stroke; ctx.lineWidth = (w + OW) / len; ctx.stroke();
  ctx.strokeStyle = LEAF.fill; ctx.lineWidth = w / len; ctx.stroke();
  ctx.restore();
}

// allium florets (sunflower layout), outside in
const ALLI_PTS: number[] = [];
for (let i = 43; i >= 0; i--) {
  const a = i * 2.39996, r = Math.sqrt((i + 0.5) / 44) * 0.8;
  ALLI_PTS.push(Math.cos(a) * r, Math.sin(a) * r);
}
function star6(ctx: C, x: number, y: number, r: number, rot: number): void {
  for (let k = 0; k < 12; k++) {
    const a = rot + (k * Math.PI) / 6, rr = k % 2 ? r * 0.42 : r;
    if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function headAllium(ctx: C, st: Style): void {
  ctx.lineJoin = 'round';
  // a fringe of florets round the rim makes the pom-pom outline starry
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    star6(ctx, Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.17, a);
  }
  ctx.fillStyle = st.dark; ctx.fill();
  ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.8; ctx.stroke();
  // the globe
  ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, TAU);
  ctx.fillStyle = ballGrad(ctx, st); ctx.fill();
  ctx.lineWidth = LW; ctx.stroke();
  // star florets in three shades, lit from the top left
  for (let pass = 0; pass < 3; pass++) {
    ctx.beginPath();
    for (let i = 0; i < ALLI_PTS.length; i += 2) {
      const x = ALLI_PTS[i], y = ALLI_PTS[i + 1];
      const lit = -(x + y) * 0.7;
      if ((lit > 0.22 ? 2 : lit < -0.3 ? 0 : 1) !== pass) continue;
      star6(ctx, x, y, 0.16 * (1 - Math.hypot(x, y) * 0.3), i * 0.7);
    }
    ctx.fillStyle = pass === 0 ? st.dark : pass === 1 ? st.fill : st.light; ctx.fill();
    ctx.strokeStyle = st.stroke; ctx.lineWidth = LW * 0.6; ctx.stroke();
  }
  // pale floret hearts and a glint
  ctx.beginPath();
  for (let i = 0; i < ALLI_PTS.length; i += 2) {
    const x = ALLI_PTS[i], y = ALLI_PTS[i + 1];
    ctx.moveTo(x + 0.03, y); ctx.arc(x, y, 0.03, 0, TAU);
  }
  ctx.fillStyle = rgba(st.pale, 0.9); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-0.38, -0.46, 0.12, 0.2, -0.7, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
}

let gSpBack: CanvasGradient | null = null, gSpFront: CanvasGradient | null = null;
const SPANGLE_DOTS = ['#ff6fae', '#ffffff', '#5fe0cf', '#ffffff', '#ff6fae', '#ffffff'];
function headSpangle(ctx: C): void {
  if (!gSpBack) {
    let g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, '#ffb43a'); g.addColorStop(0.42, '#ffe066'); g.addColorStop(0.72, '#5fe0cf'); g.addColorStop(1, '#1fa6b6');
    gSpBack = g;
    g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, '#ff6a2a'); g.addColorStop(0.3, '#ffaa2e'); g.addColorStop(0.6, '#ffe45a'); g.addColorStop(0.82, '#fff4a0'); g.addColorStop(1, '#5fe6d6');
    gSpFront = g;
  }
  const step = TAU / 6;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = LW;
  // long teal-tipped points behind
  ctx.save();
  ctx.rotate(step / 2);
  ctx.fillStyle = gSpBack; ctx.strokeStyle = '#1d8b96';
  for (let i = 0; i < 6; i++) { ctx.rotate(step); petalPath(ctx, 1, 0.22, 0.85); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // golden petals in front
  ctx.save();
  ctx.fillStyle = gSpFront!; ctx.strokeStyle = '#c0682a';
  for (let i = 0; i < 6; i++) { ctx.rotate(step); petalPath(ctx, 0.76, 0.27, 0.8); ctx.fill(); ctx.stroke(); }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { ctx.rotate(step); oval(ctx, -0.08, -0.5, 0.035, 0.13, 0.15); }
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill();
  ctx.restore();
  // spangles: sparkly sequins on the teal tips and in between
  ctx.save();
  ctx.rotate(step / 2);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(step);
    ctx.fillStyle = '#ffffff';
    sparkle(ctx, 0, -0.84, i % 2 ? 0.09 : 0.13); ctx.fill();
    ctx.save(); ctx.rotate(step / 2);
    ctx.beginPath(); ctx.arc(0, -0.78, 0.05, 0, TAU);
    ctx.fillStyle = SPANGLE_DOTS[i]; ctx.fill();
    ctx.strokeStyle = '#a8486a'; ctx.lineWidth = LW * 0.5; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
  // ring of stamens and a rosy centre
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10, px = Math.cos(a) * 0.22, py = Math.sin(a) * 0.22;
    ctx.moveTo(px + 0.05, py); ctx.arc(px, py, 0.05, 0, TAU);
  }
  ctx.fillStyle = '#fff1a0'; ctx.fill();
  ctx.strokeStyle = '#c99a22'; ctx.lineWidth = LW * 0.6; ctx.stroke();
  centreDisc(ctx, 0.17, '#ffd0d8', '#ff5a72', '#c42848', '#9a1c38', 4);
}

function lilyBellPath(ctx: C): void {
  // a round little bell hanging down (+y), its rim flicked out into three points
  ctx.beginPath();
  ctx.moveTo(-0.14, 0);
  ctx.bezierCurveTo(-0.52, 0.02, -0.62, 0.48, -0.5, 0.78);
  ctx.quadraticCurveTo(-0.56, 0.95, -0.7, 1.0);
  ctx.quadraticCurveTo(-0.46, 1.04, -0.3, 0.9);
  ctx.quadraticCurveTo(-0.16, 1.08, 0, 1.1);
  ctx.quadraticCurveTo(0.16, 1.08, 0.3, 0.9);
  ctx.quadraticCurveTo(0.46, 1.04, 0.7, 1.0);
  ctx.quadraticCurveTo(0.56, 0.95, 0.5, 0.78);
  ctx.bezierCurveTo(0.62, 0.48, 0.52, 0.02, 0.14, 0);
  ctx.closePath();
}
function lilyBell(ctx: C, st: Style): void {
  lilyBellPath(ctx);
  ctx.fillStyle = gVg(ctx, st); ctx.fill();
  // a soft green-grey shadow on the lower right, so the white bell stands out on grass
  ctx.save();
  ctx.clip();
  ctx.beginPath(); ctx.ellipse(0.42, 0.72, 0.42, 0.5, -0.3, 0, TAU);
  ctx.fillStyle = 'rgba(96,130,108,0.28)'; ctx.fill();
  ctx.restore();
  lilyBellPath(ctx);
  ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.strokeStyle = st.stroke; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(-0.24, 0.38, 0.07, 0.2, 0.2, 0, TAU);
  ctx.fillStyle = '#ffffff'; ctx.fill();
}
const LILY_ORDER = [1, 0, 2, 3];
/** Three bells and a bud hanging under the arch; while the leaves grow they are little green beads. */
function lilyBells(ctx: C, st: Style, H: number, g2: number, g3: number, dir: number): void {
  const n = 3, lf = sty(LEAF);
  ctx.lineCap = 'round';
  // the higher middle bell first, so the two lower bells hang in front of it
  for (const i of LILY_ORDER) {
    const bead = easeOutBack(clamp01(g2 * 1.4 - 0.2 - i * 0.12));
    if (bead <= 0) continue;
    const u = clamp01(g3 * 1.7 - i * 0.15);
    const e = u > 0 ? easeOutBack(u) : 0;
    const bud = i === n;
    stemAt(0.5 + i * 0.15);
    const full = H * (bud ? 0.07 : 0.16 - i * 0.02);
    const beadSize = H * 0.045 * bead;
    const size = Math.max(beadSize, full * e);
    // each little stalk reaches out from the arch and the bell hangs clearly below it
    const out = H * (bud ? 0.012 : 0.03), drop = H * (bud ? 0.025 : i % 2 ? 0.035 : 0.075) * Math.min(1, 0.4 + bead * 0.6);
    const px = PX, py = PY, bx = px + dir * out, by = py + drop;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + dir * out * 1.2, py + drop * 0.2, bx, by);
    ctx.strokeStyle = STEM.stroke; ctx.lineWidth = Math.max(1.3, H * 0.011) + OW; ctx.stroke();
    ctx.strokeStyle = STEM.fill; ctx.lineWidth = Math.max(1.3, H * 0.011); ctx.stroke();
    ctx.translate(bx, by);
    ctx.rotate(Math.sin(CT * 1.7 + PH + i * 1.3) * 0.08);
    ctx.scale(size, size);
    LW = OW / Math.max(size, 1);
    if (bud || e < 0.35) {
      // a round bud: green while small, whitening as it opens
      ctx.beginPath(); ctx.ellipse(0, 0.5, 0.48, 0.55, 0, 0, TAU);
      ctx.fillStyle = gVg(ctx, !bud && e > 0.15 ? st : lf); ctx.fill();
      ctx.lineWidth = LW; ctx.strokeStyle = lf.stroke; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-0.16, 0.36, 0.09, 0.16, 0.2, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
    } else lilyBell(ctx, st);
    ctx.restore();
  }
}

function headPoinsettia(ctx: C, st: Style): void {
  const lf = sty(POINS_LEAF), inn = sty(POINS_IN);
  ctx.lineJoin = 'round';
  // dark green leaves peeking out behind
  ctx.save();
  ctx.rotate(0.35);
  for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); leaf(ctx, 1.1, 0.24, 0, LW, lf); }
  ctx.restore();
  // six big red bracts, then six smaller ones in between
  ctx.save();
  for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); leaf(ctx, 1.0, 0.27, i % 2 ? 0.05 : -0.05, LW, st); }
  ctx.restore();
  ctx.save();
  ctx.rotate(TAU / 12 + 0.08);
  for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); leaf(ctx, 0.62, 0.3, 0, LW, inn); }
  ctx.restore();
  // a cluster of little yellow buds with red tips
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, d = i === 0 ? 0 : 0.14;
    const px = Math.cos(a) * d, py = Math.sin(a) * d;
    ctx.moveTo(px + 0.075, py); ctx.arc(px, py, 0.075, 0, TAU);
  }
  ctx.fillStyle = '#e8d84a'; ctx.fill();
  ctx.strokeStyle = '#7a8a1a'; ctx.lineWidth = LW * 0.7; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, d = i === 0 ? 0 : 0.14;
    const px = Math.cos(a) * d, py = Math.sin(a) * d;
    ctx.moveTo(px + 0.028, py - 0.02); ctx.arc(px, py - 0.02, 0.028, 0, TAU);
  }
  ctx.fillStyle = '#d8283a'; ctx.fill();
}

let gFairy: CanvasGradient | null = null;
function fairyPetal(ctx: C, len: number, w: number): void {
  // a broad rounded petal with a tiny pointed, curled tip
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 1.0, -len * 0.1, -w * 1.15, -len * 0.8, -w * 0.32, -len * 0.95);
  ctx.quadraticCurveTo(-w * 0.08, -len * 0.98, 0, -len * 1.07);
  ctx.quadraticCurveTo(w * 0.08, -len * 0.98, w * 0.32, -len * 0.95);
  ctx.bezierCurveTo(w * 1.15, -len * 0.8, w * 1.0, -len * 0.1, 0, 0);
  ctx.closePath();
}
const FAIRY_DUST = ['#ffffff', '#fff2a8', '#ffc8f0', '#ffffff', '#d8c4ff', '#fff2a8', '#ffffff'];
let gWing: CanvasGradient | null = null;
// fairy wings: [angle from straight up, length, flap phase]
const WINGS = [[-1.0, 1.55, 0], [1.0, 1.55, 0], [-2.15, 1.05, 0.6], [2.15, 1.05, 0.6]];
/** See-through, rainbow-tinted fairy wings behind the rose, gently flapping. */
function fairyWings(ctx: C): void {
  if (!gWing) {
    const g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, 'rgba(255,170,224,0.7)'); g.addColorStop(0.35, 'rgba(196,168,255,0.62)');
    g.addColorStop(0.68, 'rgba(140,204,255,0.62)'); g.addColorStop(1, 'rgba(160,250,204,0.7)');
    gWing = g;
  }
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const [a, len, ph] of WINGS) {
    const flap = 0.8 + 0.2 * Math.sin(CT * 3.2 + PH + ph);
    ctx.save();
    ctx.rotate(a);
    ctx.scale(len * (0.75 + 0.25 * flap), len * flap);
    const lw = LW / len;
    ctx.beginPath();
    ctx.moveTo(0, -0.1);
    ctx.bezierCurveTo(-0.5, -0.25, -0.52, -0.95, -0.1, -1.0);
    ctx.quadraticCurveTo(0.05, -1.02, 0.12, -0.92);
    ctx.bezierCurveTo(0.42, -0.6, 0.32, -0.2, 0, -0.1);
    ctx.closePath();
    ctx.fillStyle = gWing; ctx.fill();
    ctx.strokeStyle = 'rgba(128,96,190,0.85)'; ctx.lineWidth = lw * 1.2; ctx.stroke();
    // delicate veins and a pearly rim
    ctx.beginPath();
    ctx.moveTo(0, -0.14); ctx.quadraticCurveTo(-0.12, -0.55, -0.08, -0.9);
    ctx.moveTo(0, -0.14); ctx.quadraticCurveTo(0.12, -0.45, 0.16, -0.72);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = lw * 0.9; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-0.2, -0.62, 0.06, 0.18, 0.15, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function headFairyRose(ctx: C, st: Style): void {
  const pulse = 0.5 + 0.5 * Math.sin(CT * 1.7 + PH);
  // soft lilac shimmer
  ctx.save();
  ctx.scale(1.95, 1.95);
  ctx.globalAlpha = 0.4 + 0.35 * pulse;
  ctx.fillStyle = gHalo(ctx, sty(FAIRYGLOW));
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  if (!gFairy) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1.05);
    g.addColorStop(0, '#ff5aa8'); g.addColorStop(0.28, '#ff9fd2'); g.addColorStop(0.52, '#f2dcff'); g.addColorStop(0.8, '#e2d6ff'); g.addColorStop(1, '#c9bcff');
    gFairy = g;
  }
  fairyWings(ctx);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  ctx.fillStyle = gFairy;
  // outer ring of six petals, curled-back tips catching the light
  ctx.save();
  for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); fairyPetal(ctx, 1, 0.5); ctx.fill(); ctx.stroke(); }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.moveTo(-0.2, -0.86); ctx.quadraticCurveTo(-0.04, -0.97, 0.06, -0.96); }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = LW * 1.3; ctx.stroke();
  ctx.restore();
  // a second ring, offset
  ctx.save();
  ctx.rotate(TAU / 10);
  ctx.strokeStyle = st.stroke; ctx.lineWidth = LW;
  for (let i = 0; i < 5; i++) { ctx.rotate(TAU / 5); fairyPetal(ctx, 0.68, 0.44); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  // the tight swirl at the heart
  ctx.beginPath(); ctx.arc(0, 0, 0.28, 0, TAU);
  ctx.fillStyle = '#ff8cc8'; ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.strokeStyle = '#c0408a'; ctx.lineWidth = LW * 0.85;
  ctx.beginPath();
  ctx.moveTo(ROSE_SP[0] * 0.85, ROSE_SP[1] * 0.85);
  for (let i = 2; i < ROSE_SP.length; i += 2) ctx.lineTo(ROSE_SP[i] * 0.85, ROSE_SP[i + 1] * 0.85);
  ctx.stroke();
  ctx.globalAlpha = 0.5; ctx.strokeStyle = st.stroke;
  ctx.beginPath(); ctx.arc(0.03, 0.02, 0.42, 3.6, 5.0); ctx.stroke();
  ctx.beginPath(); ctx.arc(-0.04, -0.06, 0.5, 0.4, 1.5); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.ellipse(-0.1, -0.12, 0.06, 0.035, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fill();
  ctx.restore();
  // a glint sweeping across the petals
  ctx.save();
  for (let i = 0; i < 6; i++) {
    ctx.rotate(TAU / 6);
    const s = Math.max(0, Math.sin(CT * 2.2 - i * 1.0 + PH));
    ctx.globalAlpha = 0.25 + 0.6 * s * s;
    ctx.beginPath(); ctx.ellipse(-0.24, -0.6 + 0.06 * s, 0.05, 0.14, 0.5, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  ctx.restore();
  // fairy dust: twinkling motes that spiral up around the flower
  for (let i = 0; i < 7; i++) {
    const p = (CT * 0.2 + i / 7 + PH * 0.05) % 1;
    const a = i * 2.3 + PH + CT * 0.6 * (i % 2 ? 1 : -1);
    const rad = 0.95 + 0.4 * p;
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad * 0.75 - p * 0.55;
    const al = Math.sin(p * Math.PI);
    if (al < 0.05) continue;
    ctx.globalAlpha = al * 0.5;
    ctx.beginPath(); ctx.arc(x, y, 0.13, 0, TAU);
    ctx.fillStyle = 'rgba(255,220,250,0.6)'; ctx.fill();
    ctx.globalAlpha = al;
    ctx.fillStyle = FAIRY_DUST[i];
    sparkle(ctx, x, y, 0.08 + 0.07 * al); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

let gTorchBack: CanvasGradient | null = null, gTorchFront: CanvasGradient | null = null;
let gTorchFlame: CanvasGradient | null = null, gTorchMid: CanvasGradient | null = null, gTorchCollar: CanvasGradient | null = null;
function headTorch(ctx: C, st: Style, b: number): void {
  if (!gTorchBack) {
    let g = ctx.createLinearGradient(0, 0, 0, -1.1);
    g.addColorStop(0, '#7a1424'); g.addColorStop(0.5, '#c8282a'); g.addColorStop(1, '#ff8a3a');
    gTorchBack = g;
    g = ctx.createLinearGradient(0, 0, 0, -0.9);
    g.addColorStop(0, '#a81e2a'); g.addColorStop(0.45, '#f04a26'); g.addColorStop(0.8, '#ff9a34'); g.addColorStop(1, '#ffd25a');
    gTorchFront = g;
    g = ctx.createLinearGradient(0, -0.25, 0, -2.2);
    g.addColorStop(0, '#ffd84a'); g.addColorStop(0.45, '#ff9a24'); g.addColorStop(1, '#ff4a1a');
    gTorchFlame = g;
    g = ctx.createLinearGradient(0, -0.3, 0, -1.7);
    g.addColorStop(0, '#fff6c0'); g.addColorStop(0.6, '#ffe04a'); g.addColorStop(1, '#ffb02e');
    gTorchMid = g;
    g = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
    g.addColorStop(0, '#5e7a2a'); g.addColorStop(0.35, '#a8c45a'); g.addColorStop(1, '#4f6a22');
    gTorchCollar = g;
  }
  const open = 0.6 + 0.4 * clamp01(b);
  // the flame flickers quickly, but the big glow breathes slowly so a garden of them doesn't strobe
  const fl = 0.5 + 0.3 * Math.sin(CT * 7.1 + PH) + 0.2 * Math.sin(CT * 12.7 + PH * 2);
  const slow = 0.5 + 0.5 * Math.sin(CT * 2.4 + PH);
  ctx.save();
  ctx.translate(0, -1.0);
  ctx.scale(1.45, 1.9);
  ctx.globalAlpha = 0.4 + 0.3 * slow;
  ctx.fillStyle = gHalo(ctx, st);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  // a ringed collar under the cup, like the handle of a torch
  ctx.beginPath();
  ctx.moveTo(-0.17, -0.06); ctx.lineTo(0.17, -0.06); ctx.lineTo(0.12, 0.36);
  ctx.quadraticCurveTo(0, 0.42, -0.12, 0.36); ctx.closePath();
  ctx.fillStyle = gTorchCollar!; ctx.fill();
  ctx.strokeStyle = '#3f5a1c'; ctx.stroke();
  ctx.beginPath();
  for (const y of [0.05, 0.16, 0.27]) { const w = 0.165 - y * 0.12; ctx.moveTo(-w, y); ctx.quadraticCurveTo(0, y + 0.04, w, y); }
  ctx.lineWidth = LW * 1.4; ctx.stroke();
  ctx.lineWidth = LW; ctx.strokeStyle = st.stroke;
  // back of the tall, narrow cup
  ctx.fillStyle = gTorchBack;
  for (const a of [-0.42, 0.42, -0.17, 0.17]) {
    ctx.save(); ctx.rotate(a * open); lilyPetal(ctx, 1.1, 0.21); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  // the big flame: the torch's main feature
  const k = Math.sin(CT * 5.3 + PH) * 0.08 + Math.sin(CT * 9.1 + PH) * 0.04, fh = 0.94 + 0.08 * fl;
  ctx.beginPath();
  ctx.moveTo(0, -0.25);
  ctx.bezierCurveTo(-0.6, -0.4, -0.46, -1.3, -0.22 + k, -1.6 * fh);
  ctx.quadraticCurveTo(-0.12 + k, -1.45 * fh, -0.08 + k * 1.5, -1.5 * fh);
  ctx.quadraticCurveTo(-0.02 + k * 2, -1.9 * fh, k * 2.2, -2.2 * fh);
  ctx.bezierCurveTo(0.32 + k, -1.6, 0.6, -0.5, 0, -0.25);
  ctx.fillStyle = gTorchFlame!; ctx.fill();
  ctx.strokeStyle = '#d8501a'; ctx.lineWidth = LW * 0.9; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -0.3);
  ctx.bezierCurveTo(-0.36, -0.42, -0.28, -1.1, k * 1.6, -1.7 * fh);
  ctx.bezierCurveTo(0.26, -1.1, 0.36, -0.42, 0, -0.3);
  ctx.fillStyle = gTorchMid!; ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -0.32);
  ctx.bezierCurveTo(-0.17, -0.42, -0.13, -0.85, k, -1.15 * fh);
  ctx.bezierCurveTo(0.13, -0.85, 0.17, -0.42, 0, -0.32);
  ctx.globalAlpha = 0.95; ctx.fillStyle = '#fffbe6'; ctx.fill();
  ctx.globalAlpha = 1;
  // front of the cup, its rim lit by the flame
  ctx.fillStyle = gTorchFront!; ctx.strokeStyle = st.stroke; ctx.lineWidth = LW;
  for (const a of [-0.26, 0.26, 0]) {
    ctx.save(); ctx.rotate(a * open); lilyPetal(ctx, a ? 0.9 : 0.74, a ? 0.22 : 0.25); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.3 + 0.35 * fl;
    ctx.beginPath(); ctx.ellipse(0, a ? -0.6 : -0.5, 0.08, 0.16, 0, 0, TAU);
    ctx.fillStyle = '#ffe27a'; ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = gTorchFront!;
    ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(-0.1, -0.34, 0.035, 0.13, 0.15, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
  // a few sparks off the tip
  for (let i = 0; i < 3; i++) {
    const p = (CT * 0.6 + i / 3 + PH * 0.05) % 1;
    const x = Math.sin(i * 2.1 + PH + CT * 1.7) * 0.25 * p + k * 2;
    const y = -2.0 - p * 0.35;
    ctx.globalAlpha = Math.sin(p * Math.PI);
    ctx.beginPath(); ctx.arc(x, y, 0.045 * (1 - p) + 0.02, 0, TAU);
    ctx.fillStyle = '#ffe48a'; ctx.fill();
  }
  ctx.globalAlpha = 1;
}

let gAurA: CanvasGradient | null = null, gAurB: CanvasGradient | null = null, gAurSky: CanvasGradient | null = null;
const AUR_LINE = '#2a7f78';
/** The bottom edge of the aurora ribbon: an arch behind the head. */
function auroraFoot(x: number): number { return -0.14 - 0.36 * Math.cos(x * 0.95); }
function headAurora(ctx: C, st: Style): void {
  if (!gAurA) {
    let g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, '#2fd08a'); g.addColorStop(0.45, '#46e6a4'); g.addColorStop(0.72, '#b77cf0'); g.addColorStop(1, '#e070e0');
    gAurA = g;
    g = ctx.createLinearGradient(0, 0, 0, -1);
    g.addColorStop(0, '#8a5cf0'); g.addColorStop(0.42, '#e872d8'); g.addColorStop(0.75, '#6ad8f0'); g.addColorStop(1, '#5ff0a0');
    gAurB = g;
    // the ribbon, measured up from its foot: a soft green edge, fading up through violet-pink into the sky
    g = ctx.createLinearGradient(0, 0.05, 0, -0.56);
    g.addColorStop(0, 'rgba(64,232,150,0)'); g.addColorStop(0.14, 'rgba(64,232,150,0.85)'); g.addColorStop(0.45, 'rgba(70,226,190,0.55)');
    g.addColorStop(0.75, 'rgba(196,120,240,0.42)'); g.addColorStop(1, 'rgba(232,120,224,0)');
    gAurSky = g;
  }
  const pulse = 0.5 + 0.5 * Math.sin(CT * 1.3 + PH);
  // a soft glow
  ctx.save();
  ctx.scale(1.8, 1.8);
  ctx.globalAlpha = 0.35 + 0.3 * pulse;
  ctx.fillStyle = gHalo(ctx, st);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  // northern-lights ribbons arching behind the flower, their top edges rippling
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let j = 0; j < 2; j++) {
    const x0 = j ? -1.2 : -1.45, x1 = -x0, N = 22, lift = j * 0.12;
    const top = (u: number, x: number) => Math.sin(Math.PI * u) * (0.42 + 0.08 * Math.sin(x * 5.2 + CT * 1.8 + j * 2 + PH) + 0.04 * Math.sin(x * 9 - CT * 2.3));
    ctx.globalAlpha = j ? 0.5 : 0.8;
    ctx.fillStyle = gAurSky!;
    // drawn as thin slices so the fade follows the arch, with soft edges top and bottom
    for (let q = 0; q < N; q++) {
      const ua = q / N, ub = (q + 1) / N, xa = x0 + (x1 - x0) * ua, xb = x0 + (x1 - x0) * ub;
      const fm = auroraFoot((xa + xb) / 2) - lift;
      const fa = auroraFoot(xa) - lift - fm, fb = auroraFoot(xb) - lift - fm;
      // each slice's height is scaled so the shared gradient reaches its top edge
      const ha = top(ua, xa), hb = top(ub, xb), hm = Math.max(0.05, (ha + hb) / 2);
      ctx.save();
      ctx.translate(0, fm);
      ctx.scale(1, hm / 0.5);
      const k = 0.5 / hm;
      ctx.beginPath();
      ctx.moveTo(xa, fa * k + 0.03); ctx.lineTo(xb + 0.004, fb * k + 0.03);
      ctx.lineTo(xb + 0.004, (fb - hb) * k); ctx.lineTo(xa, (fa - ha) * k);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // light folds in the curtain
    ctx.beginPath();
    for (let q = 1; q < 10; q++) {
      const u = q / 10, x = x0 + (x1 - x0) * u + 0.04 * Math.sin(CT * 1.4 + q);
      const y = auroraFoot(x) - lift, h = Math.sin(Math.PI * u) * 0.32;
      ctx.moveTo(x, y - 0.05); ctx.lineTo(x, y - h);
    }
    ctx.globalAlpha *= 0.35 + 0.25 * Math.sin(CT * 2.1 + j + PH);
    ctx.strokeStyle = '#eafff4'; ctx.lineWidth = 0.035; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const n = 7, step = TAU / n;
  // outer petals end in soft curled ribbon streamers that sway with the curtain
  ctx.save();
  ctx.rotate(step / 2);
  for (let i = 0; i < n; i++) {
    ctx.rotate(step);
    const k = 0.06 * Math.sin(CT * 1.6 - i * 0.9 + PH);
    ctx.beginPath();
    tendrilPath(ctx, 0, -0.74, 0.1 + k, -0.17, 1);
    ctx.strokeStyle = AUR_LINE; ctx.lineWidth = 0.07 + LW * 2; ctx.stroke();
    ctx.strokeStyle = '#e07ae4'; ctx.lineWidth = 0.07; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.025; ctx.stroke();
  }
  ctx.restore();
  // two rings of slender petals; a colour wave ripples green, violet and pink round them
  for (let ring = 0; ring < 2; ring++) {
    const sc = ring ? 0.6 : 1;
    ctx.save();
    ctx.scale(sc, sc);
    ctx.rotate(ring ? 0 : step / 2);
    ctx.lineWidth = LW / sc;
    for (let i = 0; i < n; i++) {
      ctx.rotate(step);
      petalPath(ctx, ring ? 1 : 0.84, ring ? 0.27 : 0.24, 0.6);
      ctx.fillStyle = gAurA; ctx.fill();
      const w = 0.5 + 0.5 * Math.sin(CT * 1.4 - i * 0.9 - ring * 1.6 + PH);
      ctx.globalAlpha = 0.95 * w * w;
      ctx.fillStyle = gAurB!; ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = AUR_LINE; ctx.stroke();
      // a frosty blue midline
      ctx.beginPath(); ctx.moveTo(0, -0.18); ctx.lineTo(0, ring ? -0.8 : -0.68);
      ctx.globalAlpha = 0.6; ctx.strokeStyle = '#d8f4ff'; ctx.lineWidth = LW * 1.2 / sc; ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = LW / sc;
    }
    ctx.restore();
  }
  // a warm pink-white pearl at the heart
  centreDisc(ctx, 0.18, '#ffffff', '#fff0f6', '#f2b4d6', '#c98aae', 0);
  ctx.fillStyle = '#ffffff';
  const tw0 = 0.5 + 0.5 * Math.sin(CT * 2.2 + PH);
  sparkle(ctx, -0.05, -0.06, 0.06 + 0.05 * tw0); ctx.fill();
  // snowflakes drifting down, and a twinkle
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.045; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const p = (CT * 0.16 + i / 4 + PH * 0.05) % 1;
    const x = Math.cos(i * 1.9 + PH) * 1.2 + Math.sin(CT * 1.1 + i * 2) * 0.12;
    const y = -1.05 + p * 1.5;
    ctx.globalAlpha = Math.sin(p * Math.PI);
    snowflake(ctx, x, y, 0.1);
  }
  const tw = Math.max(0, Math.sin(CT * 2.6 + PH));
  if (tw > 0.05) { ctx.globalAlpha = tw; sparkle(ctx, -0.95, -0.85, 0.1 + 0.12 * tw); ctx.fill(); }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- config
interface KC { stem: number; r: number; spin: boolean }
const CFG: Record<FlowerKind, KC> = {
  sprout: { stem: 0.58, r: 0.0, spin: false },
  daisy: { stem: 0.77, r: 0.23, spin: true },
  tulip: { stem: 0.66, r: 0.34, spin: false },
  poppy: { stem: 0.77, r: 0.22, spin: true },
  bluebell: { stem: 1.0, r: 0.12, spin: false },
  clover: { stem: 0.84, r: 0.15, spin: false },
  buttercup: { stem: 0.8, r: 0.17, spin: true },
  forgetmenot: { stem: 0.8, r: 0.23, spin: false },
  pansy: { stem: 0.66, r: 0.25, spin: false },
  dahlia: { stem: 0.78, r: 0.26, spin: true },
  lavender: { stem: 0.97, r: 0.1, spin: false },
  sunflower: { stem: 0.72, r: 0.28, spin: true },
  rose: { stem: 0.78, r: 0.21, spin: true },
  starbloom: { stem: 0.74, r: 0.22, spin: false },
  rainbowbloom: { stem: 0.74, r: 0.27, spin: true },
  dandelion: { stem: 0.64, r: 0.22, spin: true },
  peacebloom: { stem: 0.74, r: 0.24, spin: true },
  cornflower: { stem: 0.8, r: 0.22, spin: true },
  snowdrop: { stem: 1.0, r: 0.2, spin: false },
  tigerlily: { stem: 0.8, r: 0.27, spin: true },
  heartblossom: { stem: 0.72, r: 0.24, spin: true },
  goldenlotus: { stem: 0.62, r: 0.3, spin: false },
  frostlotus: { stem: 0.62, r: 0.3, spin: false },
  jadevine: { stem: 1.0, r: 0.1, spin: false },
  moonflower: { stem: 0.74, r: 0.25, spin: true },
  phoenixbloom: { stem: 0.72, r: 0.27, spin: false },
  crocus: { stem: 0.5, r: 0.34, spin: false },
  sweetpea: { stem: 0.74, r: 0.26, spin: false },
  bluejazz: { stem: 0.76, r: 0.22, spin: true },
  cosmos: { stem: 0.8, r: 0.25, spin: true },
  allium: { stem: 0.8, r: 0.19, spin: true },
  summerspangle: { stem: 0.74, r: 0.27, spin: true },
  lilyofthevalley: { stem: 1.0, r: 0.1, spin: false },
  poinsettia: { stem: 0.64, r: 0.31, spin: true },
  fairyrose: { stem: 0.76, r: 0.24, spin: true },
  torchflower: { stem: 0.52, r: 0.235, spin: false },
  aurorabloom: { stem: 0.74, r: 0.28, spin: true },
};

// leaf specs: [t along stem, side(-1/1), length (fraction of H), half-width, angle from stem, bend]
const LEAVES: Record<FlowerKind, readonly number[][]> = {
  sprout: [],
  daisy: [[0.12, -1, 0.3, 0.14, 1.15, 0.14], [0.3, 1, 0.26, 0.13, 1.0, 0.12]],
  tulip: [[0.02, -1, 0.55, 0.2, 0.38, 0.3], [0.04, 1, 0.5, 0.19, 0.5, 0.3]],
  poppy: [[0.1, -1, 0.28, 0.15, 1.05, 0.14], [0.28, 1, 0.24, 0.14, 0.95, 0.12]],
  bluebell: [[0.01, -1, 0.5, 0.06, 0.35, 0.4], [0.02, 1, 0.44, 0.06, 0.6, 0.4], [0.02, -1, 0.34, 0.06, 0.85, 0.35]],
  clover: [],
  buttercup: [[0.1, -1, 0.26, 0.16, 1.1, 0.14], [0.26, 1, 0.22, 0.15, 1.0, 0.12]],
  forgetmenot: [[0.08, -1, 0.3, 0.11, 0.9, 0.2], [0.22, 1, 0.26, 0.1, 0.85, 0.18], [0.4, -1, 0.18, 0.09, 0.8, 0.14]],
  pansy: [[0.04, -1, 0.3, 0.2, 1.0, 0.16], [0.08, 1, 0.27, 0.19, 0.95, 0.14]],
  dahlia: [[0.16, -1, 0.26, 0.17, 1.05, 0.14], [0.34, 1, 0.24, 0.16, 0.95, 0.12], [0.5, -1, 0.17, 0.14, 0.85, 0.1]],
  lavender: [[0.02, -1, 0.34, 0.06, 0.4, 0.3], [0.03, 1, 0.3, 0.06, 0.55, 0.3], [0.08, -1, 0.22, 0.05, 0.85, 0.25], [0.1, 1, 0.2, 0.05, 0.75, 0.25]],
  sunflower: [[0.18, -1, 0.3, 0.2, 1.1, 0.12], [0.34, 1, 0.28, 0.2, 1.0, 0.1], [0.5, -1, 0.2, 0.17, 0.95, 0.1]],
  rose: [[0.18, -1, 0.2, 0.13, 1.05, 0.14], [0.38, 1, 0.19, 0.13, 0.9, 0.12], [0.55, -1, 0.14, 0.12, 0.8, 0.1]],
  starbloom: [[0.14, -1, 0.24, 0.13, 1.1, 0.14], [0.32, 1, 0.21, 0.12, 0.95, 0.12]],
  rainbowbloom: [[0.14, -1, 0.26, 0.14, 1.1, 0.14], [0.32, 1, 0.22, 0.13, 0.95, 0.12]],
  dandelion: [[0.0, -1, 0.37, 0.17, 1.25, 0.08], [0.0, 1, 0.34, 0.16, 1.2, 0.08], [0.01, -1, 0.3, 0.15, 0.7, 0.1], [0.01, 1, 0.26, 0.14, 0.62, 0.1]],
  peacebloom: [[0.12, -1, 0.28, 0.15, 1.1, 0.14], [0.3, 1, 0.24, 0.14, 0.95, 0.12]],
  cornflower: [[0.14, -1, 0.3, 0.07, 0.8, 0.18], [0.3, 1, 0.27, 0.07, 0.75, 0.16], [0.48, -1, 0.2, 0.06, 0.7, 0.12]],
  snowdrop: [[0.01, -1, 0.52, 0.06, 0.3, 0.06], [0.02, 1, 0.46, 0.06, 0.42, 0.08]],
  tigerlily: [[0.12, -1, 0.24, 0.08, 1.0, 0.14], [0.22, 1, 0.24, 0.08, 0.95, 0.14], [0.34, -1, 0.21, 0.08, 0.9, 0.12], [0.46, 1, 0.19, 0.07, 0.85, 0.12], [0.58, -1, 0.15, 0.07, 0.8, 0.1]],
  heartblossom: [[0.14, -1, 0.24, 0.16, 1.1, 0.14], [0.32, 1, 0.22, 0.15, 0.95, 0.12]],
  goldenlotus: [[0.04, -1, 0.32, 0.24, 1.2, 0.12], [0.08, 1, 0.28, 0.24, 1.1, 0.1]],
  frostlotus: [[0.04, -1, 0.32, 0.24, 1.2, 0.12], [0.08, 1, 0.28, 0.24, 1.1, 0.1]],
  jadevine: [[0.18, -1, 0.24, 0.14, 1.0, 0.14], [0.36, 1, 0.22, 0.13, 0.9, 0.12], [0.56, -1, 0.16, 0.12, 0.7, 0.1]],
  moonflower: [[0.14, -1, 0.26, 0.17, 1.1, 0.14], [0.32, 1, 0.22, 0.15, 0.95, 0.12]],
  phoenixbloom: [[0.14, -1, 0.26, 0.13, 1.1, 0.14], [0.32, 1, 0.22, 0.12, 0.95, 0.12]],
  crocus: [[0.0, -1, 0.48, 0.05, 0.24, 0.12], [0.0, 1, 0.44, 0.05, 0.32, 0.1], [0.01, -1, 0.34, 0.05, 0.62, 0.16], [0.01, 1, 0.38, 0.05, 0.12, 0.06]],
  sweetpea: [[0.14, -1, 0.2, 0.2, 1.05, 0.1], [0.18, 1, 0.2, 0.2, 1.0, 0.1], [0.5, -1, 0.16, 0.19, 0.95, 0.1], [0.54, 1, 0.15, 0.19, 0.9, 0.1]],
  bluejazz: [[0.12, -1, 0.28, 0.15, 1.1, 0.14], [0.3, 1, 0.24, 0.14, 0.95, 0.12]],
  cosmos: [[0.12, -1, 0.3, 0, 1.0, 0.14], [0.28, 1, 0.28, 0, 0.9, 0.12], [0.46, -1, 0.22, 0, 0.85, 0.1]],
  allium: [[0.0, -1, 0.42, 0.07, 0.5, 0.25], [0.0, 1, 0.38, 0.07, 0.7, 0.25]],
  summerspangle: [[0.14, -1, 0.28, 0.12, 1.1, 0.14], [0.32, 1, 0.24, 0.11, 0.95, 0.12]],
  lilyofthevalley: [[0.0, -1, 0.3, 0.15, 0.42, 0.06], [0.0, -1, 0.24, 0.15, 0.12, 0.02]],
  poinsettia: [[0.12, -1, 0.26, 0.17, 1.1, 0.12], [0.3, 1, 0.24, 0.16, 0.95, 0.1]],
  fairyrose: [[0.18, -1, 0.2, 0.13, 1.05, 0.14], [0.38, 1, 0.19, 0.13, 0.9, 0.12], [0.55, -1, 0.14, 0.12, 0.8, 0.1]],
  torchflower: [[0.14, -1, 0.26, 0.13, 1.1, 0.14], [0.32, 1, 0.22, 0.12, 0.95, 0.12]],
  aurorabloom: [[0.14, -1, 0.26, 0.13, 1.1, 0.14], [0.32, 1, 0.22, 0.12, 0.95, 0.12]],
};
/** Leaf colour per kind (default: LEAF green). */
function leafStyle(kind: FlowerKind): Style | null {
  if (kind === 'snowdrop' || kind === 'cornflower') return sty(SAGE);
  if (kind === 'poinsettia') return sty(POINS_LEAF);
  if (kind === 'aurorabloom') return sty(FROSTLEAF);
  return null;
}

function kindColor(kind: FlowerKind, seed: number): Col {
  switch (kind) {
    case 'daisy': return hr(seed, 5) < 0.22 ? PETALS.pink : PETALS.white;
    case 'tulip': return pick([PETALS.coral, PETALS.pink, PETALS.tangerine], seed, 5);
    case 'poppy': return pick([RED, PETALS.coral, RED], seed, 5);
    case 'bluebell': return pick([PERI, PETALS.sky, PETALS.lilac], seed, 5);
    case 'clover': return hr(seed, 5) < 0.75 ? PETALS.pink : PETALS.lilac;
    case 'buttercup': return PETALS.butter;
    case 'forgetmenot': return pick([PETALS.sky, PETALS.sky, PERI], seed, 5);
    case 'pansy': return pick(PANSY, seed, 6)[0]; // bud matches the upper petals
    case 'dahlia': return pick([RASP, PETALS.tangerine, PETALS.coral, VIOLET, PETALS.pink], seed, 5);
    case 'lavender': return pick([PETALS.lilac, VIOLET], seed, 5);
    case 'sunflower': return PETALS.butter;
    case 'rose': return pick([PETALS.coral, PETALS.pink, RASP], seed, 5);
    case 'starbloom': return pick([PETALS.butter, PETALS.butter, PETALS.pink, PETALS.sky], seed, 5);
    case 'dandelion': return DANDY;
    case 'peacebloom': return PEACE;
    case 'cornflower': return CORN;
    case 'snowdrop': return SNOW;
    case 'tigerlily': return TIGER;
    case 'heartblossom': return HEART;
    case 'goldenlotus': return GOLD;
    case 'frostlotus': return FROST;
    case 'jadevine': return JADE;
    case 'moonflower': return MOON;
    case 'phoenixbloom': return FIRE;
    case 'crocus': return pick([CROCUS, CROCUS, PETALS.lilac], seed, 5);
    case 'sweetpea': return pick(SWEETPEA, seed, 6)[0]; // bud matches the standard petal
    case 'bluejazz': return JAZZ;
    case 'cosmos': return pick([COSMOS_PINK, COSMOS_PINK, COSMOS_MAG, COSMOS_PALE], seed, 5);
    case 'allium': return ALLIUM;
    case 'summerspangle': return SPANGLE;
    case 'lilyofthevalley': return LILYW;
    case 'poinsettia': return POINS;
    case 'fairyrose': return FAIRY;
    case 'torchflower': return TORCH;
    case 'aurorabloom': return AURORA;
    default: return PETALS.pink;
  }
}

// ---------------------------------------------------------------- main
/** The rigid sway rotation (radians, about the stem base) drawFlower applies. */
export function flowerSwayAngle(seed: number, time: number, sway = 0): number {
  const ph = hr(seed | 0, 0) * TAU;
  return (Math.sin(time * 1.35 + ph) * 0.6 + Math.sin(time * 0.77 + ph * 1.9) * 0.4) * 0.052 + sway * 0.14;
}

export function drawFlower(ctx: CanvasRenderingContext2D, o: FlowerOpts): void {
  const growth = clamp01(o.growth);
  if (growth <= 0.003) return;
  const kind = o.kind, seed = o.seed | 0, size = o.size;
  CT = o.time;
  PH = hr(seed, 0) * TAU;
  const H = size * (0.93 + 0.14 * hr(seed, 2));
  const lean = hr(seed, 3) * 2 - 1;
  OW = Math.min(2.2, Math.max(0.9, size * 0.013));
  const swayA = o.still ? 0 : flowerSwayAngle(seed, CT, o.sway || 0);
  const g1 = clamp01(growth / 0.35);
  const g2 = clamp01((growth - 0.35) / 0.25);
  const g3 = clamp01((growth - 0.6) / 0.4);
  const cfg = CFG[kind];
  const col = kindColor(kind, seed);
  const st = sty(col);

  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(swayA);

  // soil mound while sprouting
  if (growth < 0.8) {
    ctx.globalAlpha = 1 - clamp01((growth - 0.35) / 0.45);
    ctx.fillStyle = SOIL;
    ctx.strokeStyle = SOIL_DARK;
    ctx.lineWidth = OW * 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, H * 0.075, H * 0.028, 0, Math.PI, TAU);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- stem control points (full length)
  const L = cfg.stem * H;
  const dir = lean < 0 ? -1 : 1;
  SX[0] = 0; SY[0] = 0;
  if (kind === 'bluebell') {
    SX[1] = 0; SY[1] = -0.8 * H;
    SX[2] = dir * 0.1 * H; SY[2] = -1.0 * H;
    SX[3] = dir * 0.33 * H; SY[3] = -0.84 * H;
  } else if (kind === 'snowdrop') {
    SX[1] = dir * 0.02 * H; SY[1] = -0.8 * H;
    SX[2] = dir * 0.16 * H; SY[2] = -1.0 * H;
    SX[3] = dir * 0.27 * H; SY[3] = -0.8 * H;
  } else if (kind === 'lilyofthevalley') {
    SX[1] = -dir * 0.17 * H; SY[1] = -0.92 * H;
    SX[2] = dir * 0.2 * H; SY[2] = -1.04 * H;
    SX[3] = dir * 0.42 * H; SY[3] = -0.72 * H;
  } else if (kind === 'jadevine') {
    SX[1] = -dir * 0.06 * H; SY[1] = -0.85 * H;
    SX[2] = dir * 0.12 * H; SY[2] = -1.06 * H;
    SX[3] = dir * 0.24 * H; SY[3] = -0.92 * H;
  } else {
    SX[1] = lean * 0.04 * H; SY[1] = -L * 0.33;
    SX[2] = lean * 0.09 * H; SY[2] = -L * 0.66;
    SX[3] = lean * 0.07 * H; SY[3] = -L;
  }
  // partial (growing) stem via de Casteljau
  const s = easeOutCubic(g1);
  const m01x = SX[0] + (SX[1] - SX[0]) * s, m01y = SY[0] + (SY[1] - SY[0]) * s;
  const m12x = SX[1] + (SX[2] - SX[1]) * s, m12y = SY[1] + (SY[2] - SY[1]) * s;
  const m23x = SX[2] + (SX[3] - SX[2]) * s, m23y = SY[2] + (SY[3] - SY[2]) * s;
  const a0x = m01x + (m12x - m01x) * s, a0y = m01y + (m12y - m01y) * s;
  const a1x = m12x + (m23x - m12x) * s, a1y = m12y + (m23y - m12y) * s;
  QX[0] = 0; QY[0] = 0; QX[1] = m01x; QY[1] = m01y;
  QX[2] = a0x; QY[2] = a0y;
  QX[3] = a0x + (a1x - a0x) * s; QY[3] = a0y + (a1y - a0y) * s;
  // curl at the tip while growing
  const curl = H * 0.24 * (1 - g1) * s * (g1 < 1 ? dir : 0);
  QX[2] += curl * 0.45; QY[2] += curl * 0.05;
  QX[3] += curl; QY[3] += Math.abs(curl) * 0.35;

  const sw = Math.min(7, Math.max(2.2, H * (kind === 'sunflower' ? 0.04 : 0.028)));
  const tdx = QX[3] - QX[2], tdy = QY[3] - QY[2];
  let tipA = Math.atan2(tdx, -tdy);
  if (Math.abs(tdx) + Math.abs(tdy) < 1e-6) tipA = 0;

  if (s > 0.01) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(QX[1], QY[1], QX[2], QY[2], QX[3], QY[3]);
    ctx.strokeStyle = STEM.stroke; ctx.lineWidth = sw + OW * 1.6; ctx.stroke();
    ctx.strokeStyle = STEM.fill; ctx.lineWidth = sw; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sw * 0.18, -sw * 0.2);
    ctx.bezierCurveTo(QX[1] - sw * 0.18, QY[1], QX[2] - sw * 0.18, QY[2], QX[3] - sw * 0.18, QY[3]);
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#c4ee9f'; ctx.lineWidth = sw * 0.28; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- leaves
  if (g2 > 0 && kind !== 'sprout') {
    const spec = LEAVES[kind];
    const lst = leafStyle(kind), jag = kind === 'dandelion';
    for (let i = 0; i < spec.length; i++) {
      const sp = spec[i];
      const u = clamp01(g2 * 1.5 - i * 0.2);
      if (u <= 0) continue;
      const e = easeOutBack(u);
      stemAt(sp[0]);
      ctx.save();
      ctx.translate(PX, PY);
      const flut = Math.sin(CT * 1.9 + PH + i * 1.7) * 0.05;
      // lily of the valley's two broad leaves lean away from its arching flower stalk
      const side = kind === 'lilyofthevalley' ? sp[1] * dir : sp[1];
      ctx.rotate(side * lerp(0.12, sp[4], e) + flut);
      if (kind === 'cosmos') featherLeaf(ctx, sp[2] * H * Math.max(0.01, e), -side * sp[5]);
      else leaf(ctx, sp[2] * H * Math.max(0.01, e), sp[3], -side * sp[5], OW, lst, jag);
      ctx.restore();
    }
    if (kind === 'sweetpea') stemTendrils(ctx, H, g2, dir);
  }

  if (g2 > 0 && kind === 'clover') {
    for (let i = 0; i < 2; i++) {
      const u = clamp01(g2 * 1.5 - i * 0.25);
      if (u <= 0) continue;
      const e = easeOutBack(u);
      stemAt(i ? 0.3 : 0.1);
      const sd = i ? 1 : -1;
      ctx.save();
      ctx.translate(PX, PY);
      ctx.rotate(sd * lerp(0.1, 0.55 + i * 0.1, e) + Math.sin(CT * 1.9 + PH + i) * 0.04);
      const sl = H * (i ? 0.2 : 0.26) * Math.max(0.01, e);
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -sl);
      ctx.strokeStyle = STEM.stroke; ctx.lineWidth = Math.max(1.6, sw * 0.6) + OW; ctx.stroke();
      ctx.strokeStyle = STEM.fill; ctx.lineWidth = Math.max(1.6, sw * 0.6); ctx.stroke();
      ctx.translate(0, -sl);
      trefoil(ctx, H * (i ? 0.1 : 0.13) * Math.max(0.01, e));
      ctx.restore();
    }
  }

  // ---- bud (closed flower) until the bloom opens
  if (g3 < 0.5 && kind !== 'lavender' && kind !== 'lilyofthevalley') {
    const open = clamp01(g3 * 2.5);
    const bs = H * 0.062 * (1 - open * 0.6);
    const fade = 1 - open;
    ctx.save();
    ctx.translate(QX[3], QY[3]);
    ctx.rotate(tipA);
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(bs * 1.5, -bs * 0.5, bs * 1.2, -bs * 2.2, 0, -bs * 3);
    ctx.bezierCurveTo(-bs * 1.2, -bs * 2.2, -bs * 1.5, -bs * 0.5, 0, 0);
    ctx.closePath();
    const bst = kind === 'sprout' || kind === 'bluebell' || kind === 'dandelion' ? sty(LEAF) : st;
    ctx.fillStyle = bst.fill; ctx.fill();
    ctx.lineWidth = OW; ctx.lineJoin = 'round'; ctx.strokeStyle = bst.stroke; ctx.stroke();
    // little green sepals
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(bs * 1.4, -bs * 0.4, bs * 1.1, -bs * 1.4);
    ctx.quadraticCurveTo(bs * 0.5, -bs * 0.8, 0, 0);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-bs * 1.4, -bs * 0.4, -bs * 1.1, -bs * 1.4);
    ctx.quadraticCurveTo(-bs * 0.5, -bs * 0.8, 0, 0);
    ctx.fillStyle = LEAF.fill; ctx.fill();
    ctx.strokeStyle = LEAF.stroke; ctx.lineWidth = OW * 0.8; ctx.stroke();
    ctx.restore();
  }

  // ---- heads
  const b = easeOutBack(g3);
  const lag = Math.sin(CT * 1.35 + PH - 0.7) * 0.03 + (o.sway || 0) * 0.08;
  if (kind === 'sprout') {
    sproutLeaves(ctx, H, QX[3], QY[3], tipA, clamp01((growth - 0.3) / 0.6), lean);
  } else if (kind === 'bluebell') {
    if (g3 > 0) bluebells(ctx, st, H, g3, seed);
  } else if (kind === 'lavender') {
    if (g3 > 0) lavenderSpike(ctx, st, H, g3, seed);
  } else if (kind === 'snowdrop') {
    if (g3 > 0) snowdropHead(ctx, st, H, g3);
  } else if (kind === 'jadevine') {
    if (g3 > 0) jadeCluster(ctx, H, g3, seed, dir);
  } else if (kind === 'lilyofthevalley') {
    if (g2 > 0) lilyBells(ctx, st, H, g2, g3, dir);
  } else if (b > 0.02) {
    const R = cfg.r * H;
    ctx.save();
    ctx.translate(QX[3], QY[3]);
    ctx.rotate(tipA * 0.6 + lag + (cfg.spin ? (1 - b) * 0.9 + (kind === 'sunflower' ? 0 : 0) : 0));
    let cy = 0;
    if (kind === 'tulip') cy = 0;
    ctx.translate(0, cy);
    if (kind === 'sunflower') ctx.rotate(lean * 0.12);
    ctx.scale(R * b, R * b);
    LW = OW / R;
    if (kind === 'daisy') headDaisy(ctx, st, 11 + (seed & 3));
    else if (kind === 'tulip') headTulip(ctx, st, b);
    else if (kind === 'poppy') headPoppy(ctx, st, 5, b);
    else if (kind === 'clover') headClover(ctx, st);
    else if (kind === 'buttercup') headButtercup(ctx, st);
    else if (kind === 'forgetmenot') headForgetMeNot(ctx, st);
    else if (kind === 'pansy') headPansy(ctx, seed);
    else if (kind === 'dahlia') headDahlia(ctx, st);
    else if (kind === 'sunflower') headSunflower(ctx, st, 17 + (seed & 3));
    else if (kind === 'rose') headRose(ctx, st);
    else if (kind === 'starbloom') headStar(ctx, st);
    else if (kind === 'rainbowbloom') headRainbow(ctx, 8 + (seed & 1));
    else if (kind === 'dandelion') headDandelion(ctx, st);
    else if (kind === 'peacebloom') headPeace(ctx, st);
    else if (kind === 'cornflower') headCornflower(ctx, st);
    else if (kind === 'tigerlily') headTigerLily(ctx, st);
    else if (kind === 'heartblossom') headHeart(ctx, st);
    else if (kind === 'goldenlotus') headLotus(ctx, st, false);
    else if (kind === 'frostlotus') headLotus(ctx, st, true);
    else if (kind === 'moonflower') headMoon(ctx, st);
    else if (kind === 'phoenixbloom') headPhoenix(ctx);
    else if (kind === 'crocus') headCrocus(ctx, st, b);
    else if (kind === 'sweetpea') headSweetPea(ctx, seed);
    else if (kind === 'bluejazz') headBlueJazz(ctx, st);
    else if (kind === 'cosmos') headCosmos(ctx, st);
    else if (kind === 'allium') headAllium(ctx, st);
    else if (kind === 'summerspangle') headSpangle(ctx);
    else if (kind === 'poinsettia') headPoinsettia(ctx, st);
    else if (kind === 'fairyrose') headFairyRose(ctx, st);
    else if (kind === 'torchflower') headTorch(ctx, st, b);
    else if (kind === 'aurorabloom') headAurora(ctx, st);
    ctx.restore();
  }
  ctx.restore();
}

function trefoil(ctx: C, len: number): void {
  if (len < 1) return;
  const st = sty(LEAF);
  ctx.save();
  ctx.rotate(-0.1);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i - 1) * 1.15);
    ctx.scale(len, len);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-0.75, -0.1, -0.85, -0.95, -0.32, -1.0);
    ctx.quadraticCurveTo(-0.1, -1.0, 0, -0.82);
    ctx.quadraticCurveTo(0.1, -1.0, 0.32, -1.0);
    ctx.bezierCurveTo(0.85, -0.95, 0.75, -0.1, 0, 0);
    ctx.closePath();
    ctx.fillStyle = gPg(ctx, st); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = OW / len; ctx.strokeStyle = st.stroke; ctx.stroke();
    ctx.globalAlpha = 0.6; ctx.strokeStyle = '#e9ffd6'; ctx.lineWidth = OW * 1.3 / len; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.38, -0.4); ctx.quadraticCurveTo(0, -0.62, 0.38, -0.4); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function sproutLeaves(ctx: C, H: number, tx: number, ty: number, ang: number, u: number, lean: number): void {
  if (u <= 0) return;
  const e = easeOutBack(u);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(ang);
  const flut = Math.sin(CT * 2.0 + PH) * 0.05;
  const open = lerp(0.05, 0.95, Math.min(1.05, e));
  const len = H * 0.4 * Math.max(0.02, e);
  ctx.save(); ctx.rotate(-open + flut); leaf(ctx, len, 0.34, 0.12); ctx.restore();
  ctx.save(); ctx.rotate(open * (0.92 + 0.1 * lean) - flut); leaf(ctx, len * 0.92, 0.34, -0.12); ctx.restore();
  const u2 = clamp01((u - 0.55) / 0.45);
  if (u2 > 0) {
    const e2 = easeOutBack(u2);
    ctx.save(); ctx.rotate(0.05 + flut * 0.5); leaf(ctx, H * 0.2 * e2, 0.3, 0.0); ctx.restore();
  }
  ctx.restore();
}

function bluebells(ctx: C, st: Style, H: number, g3: number, seed: number): void {
  const n = 3 + (seed & 1);
  const sc = H * 0.15;
  for (let i = 0; i < n; i++) {
    const u = clamp01(g3 * 1.7 - i * 0.2);
    if (u <= 0) continue;
    const e = easeOutBack(u);
    const t = n === 3 ? 0.52 + i * 0.22 : 0.5 + i * 0.165;
    stemAt(Math.min(1, t));
    const size = sc * (1 - i * 0.1) * Math.max(0.01, e);
    const px = PX, py = PY;
    const ped = H * 0.045;
    const bx = px + (i % 2 ? -ped * 0.3 : ped * 0.5), by = py + ped;
    ctx.save();
    // pedicel
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + ped * 0.2, py + ped * 0.6, bx, by);
    ctx.strokeStyle = STEM.stroke; ctx.lineWidth = Math.max(1.6, H * 0.016) + OW; ctx.stroke();
    ctx.strokeStyle = STEM.fill; ctx.lineWidth = Math.max(1.6, H * 0.016); ctx.stroke();
    ctx.translate(bx, by);
    ctx.rotate(Math.sin(CT * 1.7 + PH + i * 1.3) * 0.09 - PA * 0.0 + 0.05 * (i % 2 ? -1 : 1));
    ctx.scale(size, size);
    LW = OW / Math.max(size, 1);
    bell(ctx, st);
    ctx.restore();
  }
  // tip bud
  stemAt(1);
}

function lavenderSpike(ctx: C, st: Style, H: number, g3: number, seed: number): void {
  const rows = 9 + (seed % 3);
  const t0 = 0.5;
  const bw = H * 0.07;
  for (let i = 0; i < rows; i++) {
    const u = clamp01(g3 * 1.8 - (i / rows) * 0.8);
    if (u <= 0) continue;
    const e = easeOutBack(u);
    const f = i / (rows - 1);
    const t = t0 + (1 - t0) * f * 0.97;
    stemAt(t);
    const size = bw * (1.05 - f * 0.45) * Math.max(0.01, e);
    ctx.save();
    ctx.translate(PX, PY);
    ctx.rotate(PA);
    ctx.lineJoin = 'round';
    for (let sd = -1; sd <= 1; sd += 2) {
      ctx.save();
      ctx.translate(sd * size * 0.35, -size * 0.2 * (sd > 0 ? 1 : -1) * 0 + (sd > 0 ? -size * 0.5 : 0));
      ctx.rotate(sd * (0.55 - 0.3 * f));
      ctx.scale(size, size);
      LW = OW / size;
      ctx.beginPath();
      ctx.moveTo(0, 0.1);
      ctx.bezierCurveTo(0.5, -0.1, 0.5, -1.4, 0, -1.6);
      ctx.bezierCurveTo(-0.5, -1.4, -0.5, -0.1, 0, 0.1);
      ctx.closePath();
      ctx.fillStyle = lavGrad(ctx, st);
      ctx.fill();
      ctx.lineWidth = LW; ctx.strokeStyle = st.stroke; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-0.18, -0.95, 0.09, 0.28, 0.1, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fill();
      ctx.restore();
    }
    if (i === rows - 1) {
      ctx.translate(0, -size * 1.0);
      ctx.scale(size, size);
      LW = OW / size;
      ctx.beginPath();
      ctx.moveTo(0, 0.1);
      ctx.bezierCurveTo(0.5, -0.1, 0.5, -1.4, 0, -1.6);
      ctx.bezierCurveTo(-0.5, -1.4, -0.5, -0.1, 0, 0.1);
      ctx.closePath();
      ctx.fillStyle = st.light; ctx.fill();
      ctx.lineWidth = LW; ctx.strokeStyle = st.stroke; ctx.stroke();
    }
    ctx.restore();
  }
}
const lavG = new WeakMap<Style, CanvasGradient>();
function lavGrad(ctx: C, st: Style): CanvasGradient {
  let g = lavG.get(st);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, -1.6);
    g.addColorStop(0, st.dark); g.addColorStop(0.55, st.fill); g.addColorStop(1, st.light);
    lavG.set(st, g);
  }
  return g;
}

function dropPetal(ctx: C, w: number): void {
  // a snowdrop petal hanging down (+y) from the origin
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-w * 1.1, 0.12, -w * 1.3, 0.7, 0, 1);
  ctx.bezierCurveTo(w * 1.3, 0.7, w * 1.1, 0.12, 0, 0);
  ctx.closePath();
}
function snowdropHead(ctx: C, st: Style, H: number, g3: number): void {
  const e = easeOutBack(clamp01(g3 * 1.3));
  stemAt(1);
  const size = H * 0.23 * Math.max(0.01, e);
  const lf = sty(LEAF);
  ctx.save();
  ctx.translate(PX, PY);
  ctx.rotate(Math.sin(CT * 1.5 + PH) * 0.05);
  ctx.scale(size, size);
  LW = OW / Math.max(size, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // little green ovary the flower hangs from
  ctx.beginPath(); ctx.ellipse(0, 0.08, 0.12, 0.15, 0, 0, TAU);
  ctx.fillStyle = gVg(ctx, lf); ctx.fill();
  ctx.lineWidth = LW; ctx.strokeStyle = lf.stroke; ctx.stroke();
  ctx.translate(0, 0.2);
  ctx.strokeStyle = st.stroke; ctx.fillStyle = gVg(ctx, st);
  // three long outer petals: one behind, two flaring out at the sides
  ctx.save(); ctx.scale(0.95, 0.96); dropPetal(ctx, 0.3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = rgba(st.stroke, 0.16); ctx.fill(); ctx.restore();
  ctx.fillStyle = gVg(ctx, st);
  for (let sd = -1; sd <= 1; sd += 2) {
    ctx.save(); ctx.rotate(sd * 0.5);
    dropPetal(ctx, 0.28); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.lineWidth = LW * 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0.15); ctx.quadraticCurveTo(sd * 0.04, 0.5, 0, 0.82); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = LW;
    ctx.restore();
  }
  // the small inner cup with its green tip mark
  ctx.beginPath();
  ctx.moveTo(-0.1, 0.12);
  ctx.bezierCurveTo(-0.26, 0.24, -0.25, 0.5, -0.2, 0.64);
  ctx.quadraticCurveTo(-0.1, 0.6, 0, 0.7);
  ctx.quadraticCurveTo(0.1, 0.6, 0.2, 0.64);
  ctx.bezierCurveTo(0.25, 0.5, 0.26, 0.24, 0.1, 0.12);
  ctx.closePath();
  ctx.fillStyle = '#f2f8ee'; ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.15, 0.6); ctx.quadraticCurveTo(-0.08, 0.5, 0, 0.58); ctx.quadraticCurveTo(0.08, 0.5, 0.15, 0.6);
  ctx.quadraticCurveTo(0.08, 0.6, 0, 0.67); ctx.quadraticCurveTo(-0.08, 0.6, -0.15, 0.6);
  ctx.fillStyle = '#6fbf4e'; ctx.fill();
  ctx.restore();
}

let gJade: CanvasGradient | null = null;
const RACHIS: Col = { fill: '#9c7fa8', stroke: '#664a75' };
function clawPath(ctx: C): void {
  // one jade vine flower: a fat claw reaching out (+x) and hooking upwards
  ctx.beginPath();
  ctx.moveTo(0, 0.14);
  ctx.bezierCurveTo(0.45, 0.32, 1.0, 0.16, 1.02, -0.48);
  ctx.quadraticCurveTo(1.0, -0.64, 0.88, -0.5);
  ctx.bezierCurveTo(0.8, -0.12, 0.42, -0.08, 0, -0.14);
  ctx.closePath();
}
function jadeCluster(ctx: C, H: number, g3: number, seed: number, dir: number): void {
  if (!gJade) {
    const g = ctx.createLinearGradient(0, 0.1, 0.95, -0.45);
    g.addColorStop(0, '#2aa596'); g.addColorStop(0.45, '#5fe0c8'); g.addColorStop(1, '#d4fff3');
    gJade = g;
  }
  stemAt(1);
  const tx = PX, ty = PY;
  const rows = 6 + (seed & 1);
  const len = H * 0.46 * (0.2 + 0.8 * easeOutCubic(clamp01(g3 * 1.4)));
  const cx = tx + dir * H * 0.05, cy = ty + len * 0.5, ex = tx - dir * H * 0.02, ey = ty + len;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(cx, cy, ex, ey);
  const rw = Math.max(1.4, H * 0.013);
  ctx.strokeStyle = RACHIS.stroke; ctx.lineWidth = rw + OW; ctx.stroke();
  ctx.strokeStyle = RACHIS.fill; ctx.lineWidth = rw; ctx.stroke();
  // tight buds at the very end
  ctx.beginPath();
  oval(ctx, ex, ey + H * 0.012, H * 0.012, H * 0.02, 0);
  oval(ctx, ex - H * 0.018, ey - H * 0.012, H * 0.011, H * 0.017, 0.6);
  oval(ctx, ex + H * 0.018, ey - H * 0.016, H * 0.011, H * 0.017, -0.6);
  ctx.fillStyle = '#3fb8a6'; ctx.fill();
  ctx.strokeStyle = JADE.stroke; ctx.lineWidth = OW * 0.8; ctx.stroke();
  // claws, bottom row first so the upper ones sit in front of the hooked tips below
  for (let i = rows - 1; i >= 0; i--) {
    const f = i / (rows - 1);
    const u = clamp01(g3 * 1.8 - f * 0.8);
    if (u <= 0) continue;
    const e = easeOutBack(u);
    const t = 0.06 + 0.82 * f, m = 1 - t;
    const x = m * m * tx + 2 * m * t * cx + t * t * ex, y = m * m * ty + 2 * m * t * cy + t * t * ey;
    const s = H * 0.15 * (1 - f * 0.5) * Math.max(0.01, e);
    LW = OW / Math.max(s, 1);
    ctx.lineWidth = LW;
    // each whorl: claws reaching out to both sides (dipping down, tips hooking up) and one or two in front
    for (let j = 0; j < 4; j++) {
      const sd = j % 2 ? 1 : -1;
      const front = j >= 2;
      if (front && (i + j) % 2 === 1 && i !== 0) continue;
      ctx.save();
      ctx.translate(x + (front ? sd * s * 0.12 : 0), y + (front ? s * 0.12 : 0));
      ctx.scale(sd * s * (front ? 0.62 : 1), s * (front ? 0.95 : 1));
      ctx.rotate(front ? 0.7 : 0.48 + (i % 2) * 0.12 + 0.1 * f);
      clawPath(ctx);
      ctx.fillStyle = gJade; ctx.fill();
      ctx.strokeStyle = JADE.stroke; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0.6, -0.08, 0.05, 0.15, 0.6, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
      ctx.restore();
    }
    // dark calyx where the flowers join the stalk
    ctx.beginPath(); ctx.arc(x, y, s * 0.12, 0, TAU);
    ctx.fillStyle = '#4f6e74'; ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- picking
// Tier weights (normalised when picking): W0 with no streak, W1 at a streak of 20+.
// Sprout has its own weight; the rest of each tier's share is split evenly across its kinds.
const SPROUT_W0 = 0.14, SPROUT_W1 = 0.01;
const TIER_W0 = [0.48, 0.29, 0.085, 0.005, 0];
const TIER_W1 = [0.11, 0.2, 0.33, 0.25, 0.1];
const PW0 = new Float64Array(FLOWER_KINDS.length), PW1 = new Float64Array(FLOWER_KINDS.length);
{
  const counts = [0, 0, 0, 0, 0];
  for (const k of FLOWER_KINDS) if (k !== 'sprout') counts[FLOWER_RARITY[k]]++;
  FLOWER_KINDS.forEach((k, i) => {
    const t = FLOWER_RARITY[k];
    PW0[i] = k === 'sprout' ? SPROUT_W0 : TIER_W0[t] / counts[t];
    PW1[i] = k === 'sprout' ? SPROUT_W1 : TIER_W1[t] / counts[t];
  });
}

/** Picks a kind given the player's current word streak; higher streak → better odds of rare kinds. */
export function pickFlowerKind(combo: number, r: number): FlowerKind {
  const q = clamp01(combo / 20);
  const n = FLOWER_KINDS.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += PW0[i] + (PW1[i] - PW0[i]) * q;
  let acc = r * total;
  for (let i = 0; i < n; i++) {
    const w = PW0[i] + (PW1[i] - PW0[i]) * q;
    if (w <= 0) continue;
    acc -= w;
    if (acc <= 0) return FLOWER_KINDS[i];
  }
  for (let i = n - 1; i >= 0; i--) if (PW0[i] + (PW1[i] - PW0[i]) * q > 0) return FLOWER_KINDS[i];
  return FLOWER_KINDS[0];
}
