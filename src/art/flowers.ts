// Procedural storybook flowers. Everything is drawn in local coordinates with the
// origin at the stem base; heads are drawn in a unit space (scaled by their radius)
// so that CanvasGradients can be cached per colour and reused at any size.

import { PETALS, STEM, LEAF, SOIL, SOIL_DARK, clamp01, lerp, easeOutBack, easeOutCubic } from './palette';

export type FlowerKind =
  | 'sprout' | 'daisy' | 'tulip' | 'poppy' | 'bluebell' | 'clover'
  | 'lavender' | 'sunflower' | 'rose' | 'starbloom' | 'rainbowbloom';

/** Rarity tier 0..4 (0 common → 4 legendary). */
export const FLOWER_RARITY: Record<FlowerKind, number> = {
  sprout: 0, daisy: 0, clover: 0,
  tulip: 1, poppy: 1, bluebell: 1,
  lavender: 2, sunflower: 2,
  rose: 3,
  starbloom: 4, rainbowbloom: 4,
};

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
function leaf(ctx: C, len: number, wid: number, bend: number, ow: number = OW): void {
  if (len < 0.5) return;
  const st = LST || (LST = sty(LEAF));
  ctx.save();
  ctx.scale(len, len);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid * 1.15 + bend, -0.22, wid * 0.95 + bend, -0.72, bend * 0.1, -1);
  ctx.bezierCurveTo(-wid * 0.9 + bend, -0.72, -wid * 1.15 + bend, -0.22, 0, 0);
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
  for (let i = 0; i < n; i++) { ctx.rotate(step); ctx.ellipse(-0.05, -0.74, 0.03, 0.12, 0.08, 0, TAU); }
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
  for (let i = 0; i < n; i++) { ctx.rotate(step); ctx.ellipse(-0.3, -0.72, 0.045, 0.14, 0.4, 0, TAU); }
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
  for (let i = 0; i < n; i++) { ctx.rotate(step); ctx.ellipse(-0.045, -0.72, 0.028, 0.13, 0.08, 0, TAU); }
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

// ---------------------------------------------------------------- config
interface KC { stem: number; r: number; spin: boolean }
const CFG: Record<FlowerKind, KC> = {
  sprout: { stem: 0.58, r: 0.0, spin: false },
  daisy: { stem: 0.77, r: 0.23, spin: true },
  tulip: { stem: 0.66, r: 0.34, spin: false },
  poppy: { stem: 0.77, r: 0.22, spin: true },
  bluebell: { stem: 1.0, r: 0.12, spin: false },
  clover: { stem: 0.84, r: 0.15, spin: false },
  lavender: { stem: 0.97, r: 0.1, spin: false },
  sunflower: { stem: 0.72, r: 0.28, spin: true },
  rose: { stem: 0.78, r: 0.21, spin: true },
  starbloom: { stem: 0.74, r: 0.22, spin: false },
  rainbowbloom: { stem: 0.74, r: 0.27, spin: true },
};

// leaf specs: [t along stem, side(-1/1), length (fraction of H), half-width, angle from stem, bend]
const LEAVES: Record<FlowerKind, readonly number[][]> = {
  sprout: [],
  daisy: [[0.12, -1, 0.3, 0.14, 1.15, 0.14], [0.3, 1, 0.26, 0.13, 1.0, 0.12]],
  tulip: [[0.02, -1, 0.55, 0.2, 0.38, 0.3], [0.04, 1, 0.5, 0.19, 0.5, 0.3]],
  poppy: [[0.1, -1, 0.28, 0.15, 1.05, 0.14], [0.28, 1, 0.24, 0.14, 0.95, 0.12]],
  bluebell: [[0.01, -1, 0.5, 0.06, 0.35, 0.4], [0.02, 1, 0.44, 0.06, 0.6, 0.4], [0.02, -1, 0.34, 0.06, 0.85, 0.35]],
  clover: [],
  lavender: [[0.02, -1, 0.34, 0.06, 0.4, 0.3], [0.03, 1, 0.3, 0.06, 0.55, 0.3], [0.08, -1, 0.22, 0.05, 0.85, 0.25], [0.1, 1, 0.2, 0.05, 0.75, 0.25]],
  sunflower: [[0.18, -1, 0.3, 0.2, 1.1, 0.12], [0.34, 1, 0.28, 0.2, 1.0, 0.1], [0.5, -1, 0.2, 0.17, 0.95, 0.1]],
  rose: [[0.18, -1, 0.2, 0.13, 1.05, 0.14], [0.38, 1, 0.19, 0.13, 0.9, 0.12], [0.55, -1, 0.14, 0.12, 0.8, 0.1]],
  starbloom: [[0.14, -1, 0.24, 0.13, 1.1, 0.14], [0.32, 1, 0.21, 0.12, 0.95, 0.12]],
  rainbowbloom: [[0.14, -1, 0.26, 0.14, 1.1, 0.14], [0.32, 1, 0.22, 0.13, 0.95, 0.12]],
};

function kindColor(kind: FlowerKind, seed: number): Col {
  switch (kind) {
    case 'daisy': return hr(seed, 5) < 0.22 ? PETALS.pink : PETALS.white;
    case 'tulip': return pick([PETALS.coral, PETALS.pink, PETALS.tangerine], seed, 5);
    case 'poppy': return pick([RED, PETALS.coral, RED], seed, 5);
    case 'bluebell': return pick([PERI, PETALS.sky, PETALS.lilac], seed, 5);
    case 'clover': return hr(seed, 5) < 0.75 ? PETALS.pink : PETALS.lilac;
    case 'lavender': return pick([PETALS.lilac, VIOLET], seed, 5);
    case 'sunflower': return PETALS.butter;
    case 'rose': return pick([PETALS.coral, PETALS.pink, RASP], seed, 5);
    case 'starbloom': return pick([PETALS.butter, PETALS.butter, PETALS.pink, PETALS.sky], seed, 5);
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
    for (let i = 0; i < spec.length; i++) {
      const sp = spec[i];
      const u = clamp01(g2 * 1.5 - i * 0.2);
      if (u <= 0) continue;
      const e = easeOutBack(u);
      stemAt(sp[0]);
      ctx.save();
      ctx.translate(PX, PY);
      const flut = Math.sin(CT * 1.9 + PH + i * 1.7) * 0.05;
      ctx.rotate(sp[1] * lerp(0.12, sp[4], e) + flut);
      leaf(ctx, sp[2] * H * Math.max(0.01, e), sp[3], -sp[1] * sp[5]);
      ctx.restore();
    }
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
  if (g3 < 0.5 && kind !== 'lavender') {
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
    const bst = kind === 'sprout' || kind === 'bluebell' ? sty(LEAF) : st;
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
    else if (kind === 'sunflower') headSunflower(ctx, st, 17 + (seed & 3));
    else if (kind === 'rose') headRose(ctx, st);
    else if (kind === 'starbloom') headStar(ctx, st);
    else if (kind === 'rainbowbloom') headRainbow(ctx, 8 + (seed & 1));
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

// ---------------------------------------------------------------- picking
const KINDS: FlowerKind[] = ['sprout', 'daisy', 'clover', 'tulip', 'poppy', 'bluebell', 'lavender', 'sunflower', 'rose', 'starbloom', 'rainbowbloom'];
const W0 = [0.2, 0.26, 0.2, 0.11, 0.1, 0.07, 0.03, 0.02, 0.01, 0, 0];
const W1 = [0.02, 0.07, 0.06, 0.11, 0.11, 0.11, 0.13, 0.12, 0.13, 0.07, 0.07];

/** Picks a kind given the player's current word streak; higher streak → better odds of rare kinds. */
export function pickFlowerKind(combo: number, r: number): FlowerKind {
  const q = clamp01(combo / 20);
  let total = 0;
  for (let i = 0; i < KINDS.length; i++) total += W0[i] + (W1[i] - W0[i]) * q;
  let acc = r * total;
  for (let i = 0; i < KINDS.length; i++) {
    acc -= W0[i] + (W1[i] - W0[i]) * q;
    if (acc <= 0) return KINDS[i];
  }
  return KINDS[KINDS.length - 1];
}
