// Outfits for Bumble the bee: hats and extras, drawn in Bumble's unit space
// (body ellipse rx 1, ry 0.92 at the origin, facing +x; see drawBee in characters.ts).
// Gradients are made once in unit space and cached, so the outfits cost only a few
// paths per frame.

import { PETALS } from './palette';

export type HatId = 'none' | 'flowercrown' | 'party' | 'sunhat' | 'graduation' | 'tophat' | 'wizard' | 'crown';
export type ExtraId = 'none' | 'bowtie' | 'heartglasses' | 'scarf' | 'specs' | 'cape' | 'lei';

export const HATS: readonly HatId[] = ['none', 'flowercrown', 'party', 'sunhat', 'graduation', 'tophat', 'wizard', 'crown'];
export const EXTRAS: readonly ExtraId[] = ['none', 'bowtie', 'heartglasses', 'scarf', 'specs', 'cape', 'lei'];

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Cached unit-space gradients                                         */
/* ------------------------------------------------------------------ */

type Stops = readonly (readonly [number, string])[];
const grads = new Map<string, CanvasGradient>();
function lin(ctx: C, key: string, x0: number, y0: number, x1: number, y1: number, stops: Stops): CanvasGradient {
  let g = grads.get(key);
  if (!g) {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    grads.set(key, g);
  }
  return g;
}
function rad(ctx: C, key: string, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: Stops): CanvasGradient {
  let g = grads.get(key);
  if (!g) {
    g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    grads.set(key, g);
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Small shared shapes                                                 */
/* ------------------------------------------------------------------ */

function starPath(ctx: C, x: number, y: number, r: number, rot: number, inner = 0.45): void {
  ctx.moveTo(x + Math.cos(rot - Math.PI / 2) * r, y + Math.sin(rot - Math.PI / 2) * r);
  for (let i = 1; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** A four-point twinkle (like drawSparkle), with a white heart. */
function twinkle(ctx: C, x: number, y: number, r: number, color: string, alpha: number): void {
  if (r <= 0.001 || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const k = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

interface Col { readonly fill: string; readonly stroke: string }
const FLOWER_CENTRE = '#ffd45c';
const FLOWER_CENTRE_STROKE = '#c99a22';

/**
 * A little flower: petals as one path, stroked thick then filled so only the
 * silhouette is outlined (cheap and clean at small sizes).
 */
function flower(ctx: C, x: number, y: number, s: number, rot: number, col: Col, petals: number, lw: number, centre = FLOWER_CENTRE): void {
  ctx.beginPath();
  for (let i = 0; i < petals; i++) {
    const a = rot + (i / petals) * TAU;
    const px = x + Math.cos(a) * s * 0.55;
    const py = y + Math.sin(a) * s * 0.55;
    ctx.moveTo(px + Math.cos(a) * s * 0.48, py + Math.sin(a) * s * 0.48);
    ctx.ellipse(px, py, s * 0.48, s * (petals > 5 ? 0.26 : 0.36), a, 0, TAU);
  }
  ctx.strokeStyle = col.stroke;
  ctx.lineWidth = lw * 1.6;
  ctx.stroke();
  ctx.fillStyle = col.fill;
  ctx.fill();
  ctx.fillStyle = centre;
  ctx.strokeStyle = FLOWER_CENTRE_STROKE;
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.3, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x - s * 0.09, y - s * 0.1, s * 0.09, 0, TAU);
  ctx.fill();
}

const LEAF_COL = { fill: '#86cf63', stroke: '#4a8a37' };
function leaf(ctx: C, x: number, y: number, len: number, rot: number, lw: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.fillStyle = LEAF_COL.fill;
  ctx.strokeStyle = LEAF_COL.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.moveTo(len * 0.15, 0);
  ctx.lineTo(len * 0.75, 0);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Hats                                                                */
/* ------------------------------------------------------------------ */

/** Where each hat sits on Bumble's head: seat point and lean. */
const SEAT: Record<Exclude<HatId, 'none'>, { x: number; y: number; r: number }> = {
  flowercrown: { x: 0.36, y: -0.84, r: 0.2 },
  party: { x: 0.42, y: -0.82, r: 0.42 },
  sunhat: { x: 0.34, y: -0.8, r: 0.16 },
  graduation: { x: 0.36, y: -0.82, r: 0.18 },
  tophat: { x: 0.36, y: -0.83, r: 0.2 },
  wizard: { x: 0.36, y: -0.82, r: 0.2 },
  crown: { x: 0.38, y: -0.84, r: 0.2 },
};

/**
 * Where Bumble's antenna tips go when a hat would hide them: splayed out so the
 * bobbles peek out on either side. null = the antennae stay as they are.
 */
export function hatAntennaTips(hat: HatId): readonly [readonly [number, number], readonly [number, number]] | null {
  switch (hat) {
    case 'none':
    case 'flowercrown':
      return null;
    case 'sunhat':
      return [[-0.6, -0.86], [1.24, -0.6]];
    default:
      return [[-0.3, -1.12], [1.1, -1.0]];
  }
}

export function drawHat(ctx: C, hat: HatId, t: number, lw: number): void {
  if (hat === 'none') return;
  const s = SEAT[hat];
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.r);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (hat) {
    case 'flowercrown': flowerCrown(ctx, t, lw); break;
    case 'party': partyHat(ctx, t, lw); break;
    case 'sunhat': sunHat(ctx, t, lw); break;
    case 'graduation': mortarboard(ctx, t, lw); break;
    case 'tophat': topHat(ctx, t, lw); break;
    case 'wizard': wizardHat(ctx, t, lw); break;
    case 'crown': crown(ctx, t, lw); break;
  }
  ctx.restore();
}

// ---- flower crown
const CROWN_FLOWERS: readonly { a: number; col: Col; petals: number; s: number }[] = [
  { a: -2.5, col: PETALS.pink, petals: 5, s: 0.13 },
  { a: -1.6, col: PETALS.white, petals: 8, s: 0.14 },
  { a: -0.65, col: PETALS.lilac, petals: 5, s: 0.13 },
  { a: 3.1, col: PETALS.butter, petals: 5, s: 0.15 },
  { a: 2.35, col: PETALS.white, petals: 8, s: 0.18 },
  { a: 1.6, col: PETALS.pink, petals: 5, s: 0.19 },
  { a: 0.85, col: PETALS.white, petals: 8, s: 0.18 },
  { a: 0.1, col: PETALS.coral, petals: 5, s: 0.15 },
];

function flowerCrown(ctx: C, t: number, lw: number): void {
  const rx = 0.5;
  const ry = 0.14;
  const cy = -0.06;
  const at = (a: number) => [Math.cos(a) * rx, cy + Math.sin(a) * ry] as const;
  // back half of the vine
  ctx.strokeStyle = LEAF_COL.stroke;
  ctx.lineWidth = lw * 2.4;
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.strokeStyle = '#6dbb52';
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  // leaves round the ring
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3;
    const [x, y] = at(a);
    if (Math.sin(a) < 0) leaf(ctx, x, y, 0.17, a + Math.PI * 0.62 + Math.sin(t * 1.5 + i) * 0.05, lw);
  }
  for (const f of CROWN_FLOWERS) if (Math.sin(f.a) < 0) {
    const [x, y] = at(f.a);
    flower(ctx, x, y - 0.03, f.s, f.a + Math.sin(t * 1.2 + f.a) * 0.08, f.col, f.petals, lw);
  }
  // front half of the vine
  ctx.strokeStyle = LEAF_COL.stroke;
  ctx.lineWidth = lw * 2.4;
  ctx.beginPath();
  ctx.ellipse(0, cy, rx, ry, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = '#6dbb52';
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3;
    const [x, y] = at(a);
    if (Math.sin(a) >= 0) leaf(ctx, x, y, 0.19, a + Math.PI * 0.62 + Math.sin(t * 1.5 + i) * 0.05, lw);
  }
  for (const f of CROWN_FLOWERS) if (Math.sin(f.a) >= 0) {
    const [x, y] = at(f.a);
    flower(ctx, x, y, f.s, f.a + Math.sin(t * 1.2 + f.a) * 0.08, f.col, f.petals, lw);
  }
}

// ---- party hat
const PARTY = { fill: PETALS.sky.fill, stroke: PETALS.sky.stroke, stripe: PETALS.pink.fill };
function partyHat(ctx: C, t: number, lw: number): void {
  const h = 0.92;
  const w = 0.3;
  const cone = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 0.5, -h * 0.55, -0.02, -h);
    ctx.quadraticCurveTo(0, -h - 0.02, 0.02, -h);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.55, w, 0);
    ctx.quadraticCurveTo(0, 0.1, -w, 0);
    ctx.closePath();
  };
  cone();
  ctx.fillStyle = PARTY.fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // diagonal stripes
  ctx.fillStyle = PARTY.stripe;
  for (let k = 0; k < 4; k++) {
    const y0 = -0.06 - k * 0.24;
    ctx.beginPath();
    ctx.moveTo(-0.5, y0 + 0.14);
    ctx.lineTo(0.5, y0 - 0.12);
    ctx.lineTo(0.5, y0 - 0.22);
    ctx.lineTo(-0.5, y0 + 0.04);
    ctx.closePath();
    ctx.fill();
  }
  // dots
  ctx.fillStyle = '#fff8d6';
  for (const [dx, dy] of [[-0.12, -0.2], [0.14, -0.33], [-0.04, -0.55], [0.06, -0.08], [0.02, -0.75]] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 0.03, 0, TAU);
    ctx.fill();
  }
  // cone shading
  ctx.fillStyle = lin(ctx, 'party-shade', -w, 0, w, 0, [[0, 'rgba(255,255,255,0.4)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(40,60,120,0.22)']]);
  ctx.fillRect(-w, -h - 0.05, w * 2, h + 0.2);
  ctx.restore();
  cone();
  ctx.strokeStyle = PARTY.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // frilly trim at the base
  ctx.fillStyle = PETALS.butter.fill;
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const x = -w + (i / 6) * w * 2;
    const y = 0.04 - Math.abs(x) * 0.12;
    ctx.moveTo(x + 0.055, y);
    ctx.arc(x, y, 0.055, 0, TAU);
  }
  ctx.stroke();
  ctx.fill();
  // pom-pom, bobbing
  const bx = Math.sin(t * 3.2) * 0.025;
  const by = -h - 0.07 + Math.abs(Math.cos(t * 3.2)) * -0.015;
  ctx.fillStyle = PETALS.pink.stroke;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    ctx.moveTo(bx + Math.cos(a) * 0.1 + 0.05, by + Math.sin(a) * 0.1);
    ctx.arc(bx + Math.cos(a) * 0.1, by + Math.sin(a) * 0.1, 0.05, 0, TAU);
  }
  ctx.strokeStyle = PETALS.coral.stroke;
  ctx.lineWidth = lw * 1.4;
  ctx.stroke();
  ctx.fillStyle = PETALS.coral.fill;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by, 0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(bx - 0.04, by - 0.05, 0.035, 0, TAU);
  ctx.fill();
}

// ---- sun hat
const STRAW = { light: '#fff1c2', fill: '#f4d58a', dark: '#dfb35e', stroke: '#b98a3c' };
function sunHat(ctx: C, t: number, lw: number): void {
  ctx.scale(1.18, 1.18);
  // ribbon tails hanging from the back, under the brim
  ctx.fillStyle = PETALS.lilac.fill;
  ctx.strokeStyle = PETALS.lilac.stroke;
  ctx.lineWidth = lw * 0.9;
  for (const [ex, ey, ph] of [[-0.86, 0.36, 0], [-0.7, 0.44, 1.3]] as const) {
    const f = Math.sin(t * 4 + ph) * 0.05;
    ctx.beginPath();
    ctx.moveTo(-0.56, -0.02);
    ctx.quadraticCurveTo(-0.7 + f, 0.12, ex + f, ey);
    ctx.lineTo(ex + 0.08 + f, ey + 0.04);
    ctx.quadraticCurveTo(-0.58 + f, 0.16, -0.44, 0.0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // brim
  ctx.fillStyle = rad(ctx, 'sun-brim', -0.2, -0.08, 0.05, 0, 0, 0.8, [[0, STRAW.light], [0.55, STRAW.fill], [1, STRAW.dark]]);
  ctx.strokeStyle = STRAW.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.78, 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // straw weave rings on the brim
  ctx.strokeStyle = 'rgba(185,138,60,0.45)';
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.62, 0.155, 0, 0.1, Math.PI - 0.1);
  ctx.moveTo(0.46 * Math.cos(0.15), 0.115 * Math.sin(0.15));
  ctx.ellipse(0, 0, 0.46, 0.115, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  // crown (dome)
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(-0.36, 0.0);
    ctx.bezierCurveTo(-0.38, -0.5, 0.38, -0.5, 0.36, 0.0);
    ctx.quadraticCurveTo(0, 0.1, -0.36, 0.0);
    ctx.closePath();
  };
  dome();
  ctx.fillStyle = lin(ctx, 'sun-dome', -0.36, -0.4, 0.36, 0, [[0, STRAW.light], [0.5, STRAW.fill], [1, STRAW.dark]]);
  ctx.fill();
  ctx.strokeStyle = STRAW.stroke;
  ctx.stroke();
  ctx.save();
  dome();
  ctx.clip();
  ctx.strokeStyle = 'rgba(185,138,60,0.4)';
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  for (const y of [-0.27, -0.2]) {
    ctx.moveTo(-0.4, y);
    ctx.quadraticCurveTo(0, y + 0.06, 0.4, y);
  }
  ctx.stroke();
  // ribbon band
  ctx.fillStyle = PETALS.lilac.fill;
  ctx.beginPath();
  ctx.moveTo(-0.4, -0.13);
  ctx.quadraticCurveTo(0, -0.05, 0.4, -0.13);
  ctx.lineTo(0.4, 0.02);
  ctx.quadraticCurveTo(0, 0.1, -0.4, 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.moveTo(-0.4, -0.1);
  ctx.quadraticCurveTo(0, -0.02, 0.4, -0.1);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PETALS.lilac.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(-0.35, -0.12);
  ctx.quadraticCurveTo(0, -0.05, 0.35, -0.12);
  ctx.stroke();
  dome();
  ctx.strokeStyle = STRAW.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // a flower on the band, and a leaf
  leaf(ctx, 0.2, -0.05, 0.16, -0.5, lw);
  flower(ctx, 0.16, -0.04, 0.14, 0.3 + Math.sin(t * 1.3) * 0.06, PETALS.pink, 5, lw);
}

// ---- graduation mortarboard
const NAVY = { light: '#7a8bd6', fill: '#5465b0', dark: '#3c4a8c', stroke: '#2f3a72' };
function mortarboard(ctx: C, t: number, lw: number): void {
  // skull cap
  ctx.fillStyle = lin(ctx, 'grad-cap', -0.34, 0, 0.34, 0, [[0, NAVY.light], [0.45, NAVY.fill], [1, NAVY.dark]]);
  ctx.strokeStyle = NAVY.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.moveTo(-0.33, 0.02);
  ctx.lineTo(-0.31, -0.28);
  ctx.lineTo(0.31, -0.28);
  ctx.lineTo(0.33, 0.02);
  ctx.quadraticCurveTo(0, 0.12, -0.33, 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // board thickness (front edges)
  const top = -0.36;
  const L = [-0.66, top] as const, F = [0.02, top + 0.15] as const, Rr = [0.66, top] as const, B = [-0.02, top - 0.15] as const;
  ctx.fillStyle = NAVY.dark;
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  ctx.lineTo(F[0], F[1]);
  ctx.lineTo(Rr[0], Rr[1]);
  ctx.lineTo(Rr[0], Rr[1] + 0.06);
  ctx.lineTo(F[0], F[1] + 0.06);
  ctx.lineTo(L[0], L[1] + 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // board top
  ctx.fillStyle = lin(ctx, 'grad-board', -0.4, top - 0.15, 0.4, top + 0.15, [[0, NAVY.light], [0.6, NAVY.fill], [1, NAVY.dark]]);
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(Rr[0], Rr[1]);
  ctx.lineTo(F[0], F[1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(L[0] + 0.1, L[1] - 0.005);
  ctx.lineTo(B[0] - 0.02, B[1] + 0.03);
  ctx.stroke();
  // tassel: cord from the button to the front corner, then hanging and swinging
  const sw = Math.sin(t * 2.4) * 0.32 + Math.sin(t * 5.1) * 0.05;
  const px = Rr[0] - 0.06;
  const py = Rr[1] + 0.02;
  const len = 0.36;
  const ex = px + Math.sin(sw) * len;
  const ey = py + Math.cos(sw) * len;
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 1.6;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.quadraticCurveTo(px * 0.6, top + 0.06, px, py);
  ctx.quadraticCurveTo(px + Math.sin(sw) * len * 0.4, py + len * 0.5, ex, ey);
  ctx.stroke();
  ctx.strokeStyle = PETALS.butter.fill;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // tassel bundle
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(-sw * 0.8);
  ctx.beginPath();
  ctx.moveTo(-0.035, 0);
  ctx.lineTo(-0.075, 0.2);
  ctx.quadraticCurveTo(0, 0.23, 0.075, 0.2);
  ctx.lineTo(0.035, 0);
  ctx.closePath();
  ctx.fillStyle = PETALS.butter.fill;
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.025, 0.07);
  ctx.lineTo(-0.035, 0.19);
  ctx.moveTo(0.02, 0.07);
  ctx.lineTo(0.03, 0.19);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0.0, 0.05, 0.035, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // button
  ctx.fillStyle = PETALS.butter.fill;
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.ellipse(0, top, 0.06, 0.035, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

// ---- top hat
const TOP = { light: '#8e86c8', fill: '#625a9c', dark: '#463f7a', stroke: '#352f62', top: '#7169ad' };
function topHat(ctx: C, t: number, lw: number): void {
  void t;
  // brim
  ctx.fillStyle = lin(ctx, 'top-brim', -0.52, 0, 0.52, 0, [[0, TOP.light], [0.45, TOP.fill], [1, TOP.dark]]);
  ctx.strokeStyle = TOP.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.5, 0.12, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const yb = -0.02;
  const yt = -0.72;
  const crown = () => {
    ctx.beginPath();
    ctx.moveTo(-0.29, yb);
    ctx.lineTo(-0.32, yt);
    ctx.ellipse(0, yt, 0.32, 0.075, 0, Math.PI, TAU);
    ctx.lineTo(0.29, yb);
    ctx.ellipse(0, yb, 0.29, 0.075, 0, 0, Math.PI);
    ctx.closePath();
  };
  crown();
  ctx.fillStyle = lin(ctx, 'top-crown', -0.32, 0, 0.32, 0, [[0, TOP.fill], [0.18, TOP.light], [0.5, TOP.fill], [1, TOP.dark]]);
  ctx.fill();
  ctx.stroke();
  // coloured band
  const band = PETALS.coral;
  ctx.fillStyle = band.fill;
  ctx.beginPath();
  ctx.moveTo(-0.3, -0.19);
  ctx.lineTo(-0.29, yb);
  ctx.ellipse(0, yb, 0.29, 0.075, 0, Math.PI, 0, true);
  ctx.lineTo(0.3, -0.19);
  ctx.ellipse(0, -0.19, 0.3, 0.075, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = band.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.ellipse(0, -0.15, 0.3, 0.075, 0, 0.35, Math.PI - 0.35);
  ctx.stroke();
  // a little flower tucked in the band
  flower(ctx, 0.17, -0.07, 0.11, 0.4, PETALS.butter, 5, lw, '#fff3a8');
  // top
  ctx.fillStyle = TOP.top;
  ctx.strokeStyle = TOP.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.ellipse(0, yt, 0.32, 0.075, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // sheen
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = lw * 2.2;
  ctx.beginPath();
  ctx.moveTo(-0.19, -0.62);
  ctx.lineTo(-0.18, -0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-0.185, -0.25, lw * 0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
}

// ---- wizard hat
const WIZ = { light: '#a99af4', fill: '#7d6cd8', dark: '#5c4cb4', stroke: '#47399a' };
function wizardHat(ctx: C, t: number, lw: number): void {
  // brim
  ctx.fillStyle = lin(ctx, 'wiz-brim', -0.58, 0, 0.58, 0, [[0, WIZ.light], [0.45, WIZ.fill], [1, WIZ.dark]]);
  ctx.strokeStyle = WIZ.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.58, 0.13, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // cone with a floppy tip that sways
  const sw = Math.sin(t * 1.7) * 0.05;
  const tx = -0.5 + sw;
  const ty = -0.98 + Math.abs(sw) * 0.4;
  const cone = () => {
    ctx.beginPath();
    ctx.moveTo(-0.34, -0.01);
    ctx.quadraticCurveTo(-0.22, -0.5, -0.16, -0.84);
    ctx.quadraticCurveTo(-0.26, -0.98 + sw * 0.3, tx, ty);
    ctx.quadraticCurveTo(-0.12 + sw * 0.5, -1.22, 0.1, -0.92);
    ctx.quadraticCurveTo(0.22, -0.5, 0.34, -0.01);
    ctx.ellipse(0, -0.01, 0.34, 0.08, 0, 0, Math.PI);
    ctx.closePath();
  };
  cone();
  ctx.fillStyle = lin(ctx, 'wiz-cone', -0.34, 0, 0.34, 0, [[0, WIZ.fill], [0.22, WIZ.light], [0.55, WIZ.fill], [1, WIZ.dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // gold band
  ctx.fillStyle = PETALS.butter.fill;
  ctx.beginPath();
  ctx.moveTo(-0.4, -0.18);
  ctx.quadraticCurveTo(0, -0.1, 0.4, -0.18);
  ctx.lineTo(0.4, 0.1);
  ctx.lineTo(-0.4, 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(-0.4, -0.18);
  ctx.quadraticCurveTo(0, -0.1, 0.4, -0.18);
  ctx.stroke();
  // stars and a moon
  ctx.fillStyle = '#ffe680';
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  starPath(ctx, 0.1, -0.36, 0.08, 0.2);
  starPath(ctx, -0.12, -0.58, 0.06, -0.3);
  starPath(ctx, 0.04, -0.8, 0.045, 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-0.15, -0.3, 0.075, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = WIZ.fill;
  ctx.beginPath();
  ctx.arc(-0.12, -0.32, 0.065, 0, TAU);
  ctx.fill();
  ctx.restore();
  cone();
  ctx.strokeStyle = WIZ.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // sheen down the left
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = lw * 1.8;
  ctx.beginPath();
  ctx.moveTo(-0.2, -0.24);
  ctx.quadraticCurveTo(-0.15, -0.55, -0.1, -0.74);
  ctx.stroke();
  // twinkly star bobble on the tip
  const tw = 0.75 + 0.25 * Math.sin(t * 4.5);
  ctx.fillStyle = '#ffe680';
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  starPath(ctx, tx - 0.02, ty + 0.03, 0.09, t * 0.8);
  ctx.fill();
  ctx.stroke();
  twinkle(ctx, tx - 0.15, ty - 0.12, 0.07 * tw, '#fff3a8', tw);
}

// ---- crown
const GOLD = { light: '#fff6b8', fill: '#ffd54f', dark: '#eaa52a', stroke: '#b5791a' };
const JEWELS: readonly { x: number; col: Col; r: number }[] = [
  { x: -0.2, col: PETALS.sky, r: 0.045 },
  { x: 0, col: { fill: '#ff5d7a', stroke: '#b8325a' }, r: 0.06 },
  { x: 0.2, col: PETALS.mint, r: 0.045 },
];
function crown(ctx: C, t: number, lw: number): void {
  ctx.scale(1.3, 1.3);
  const w = 0.36;
  const tips: readonly (readonly [number, number])[] = [[-w - 0.02, -0.4], [-0.18, -0.34], [0, -0.5], [0.18, -0.34], [w + 0.02, -0.4]];
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 0.0);
    ctx.lineTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < tips.length; i++) {
      const px = tips[i - 1][0];
      const [x, y] = tips[i];
      // dip between points
      ctx.quadraticCurveTo((px + x) / 2, -0.12, x, y);
    }
    ctx.lineTo(w, 0.0);
    ctx.quadraticCurveTo(0, 0.1, -w, 0.0);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = lin(ctx, 'crown-gold', -w, -0.5, w, 0.1, [[0, GOLD.light], [0.4, GOLD.fill], [1, GOLD.dark]]);
  ctx.fill();
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // band
  ctx.fillStyle = GOLD.dark;
  ctx.beginPath();
  ctx.moveTo(-w, -0.12);
  ctx.quadraticCurveTo(0, -0.04, w, -0.12);
  ctx.lineTo(w, 0.0);
  ctx.quadraticCurveTo(0, 0.1, -w, 0.0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(-w + 0.05, -0.09);
  ctx.quadraticCurveTo(0, -0.01, w - 0.05, -0.09);
  ctx.stroke();
  // jewels on the band
  for (const j of JEWELS) {
    const y = -0.045 + (1 - (j.x / w) ** 2) * 0.035;
    ctx.fillStyle = j.col.fill;
    ctx.strokeStyle = j.col.stroke;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.ellipse(j.x, y, j.r, j.r * 1.15, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(j.x - j.r * 0.35, y - j.r * 0.4, j.r * 0.35, 0, TAU);
    ctx.fill();
  }
  // ball tips
  for (let i = 0; i < tips.length; i++) {
    const [x, y] = tips[i];
    const r = i === 2 ? 0.065 : 0.05;
    ctx.fillStyle = i === 2 ? '#ff5d7a' : GOLD.light;
    ctx.strokeStyle = i === 2 ? '#b8325a' : GOLD.stroke;
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.6, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r, r * 0.3, 0, TAU);
    ctx.fill();
  }
  // gleam sweeping across + a twinkle
  ctx.save();
  shape();
  ctx.clip();
  const gx = ((t * 0.5) % 2.2) - 0.9;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(gx - 0.05, 0.1);
  ctx.lineTo(gx + 0.15, -0.6);
  ctx.lineTo(gx + 0.24, -0.6);
  ctx.lineTo(gx + 0.04, 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const tw = Math.max(0, Math.sin(t * 2.6));
  twinkle(ctx, 0.27, -0.46, 0.13 * tw, '#fffbe0', tw);
  const tw2 = Math.max(0, Math.sin(t * 2.6 + 2.4));
  twinkle(ctx, -0.33, -0.18, 0.09 * tw2, '#fffbe0', tw2);
}

/* ------------------------------------------------------------------ */
/* Extras                                                              */
/* ------------------------------------------------------------------ */

/** Point on Bumble's body rim (scaled by k) at angle a. */
const rim = (a: number, k: number) => [Math.cos(a) * k, Math.sin(a) * 0.92 * k] as const;

/** Drawn first, behind the wings and body: cape, scarf tails. */
export function drawExtraBack(ctx: C, extra: ExtraId, t: number, lw: number): void {
  if (extra === 'cape') cape(ctx, t, lw);
  else if (extra === 'scarf') scarfTails(ctx, t, lw);
}

/** Drawn after the face: glasses, bow tie, lei, scarf band. */
export function drawExtraFront(ctx: C, extra: ExtraId, t: number, lw: number): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (extra) {
    case 'bowtie': bowTie(ctx, t, lw); break;
    case 'heartglasses': heartGlasses(ctx, lw); break;
    case 'specs': specs(ctx, lw); break;
    case 'scarf': scarfFront(ctx, t, lw); break;
    case 'lei': lei(ctx, t, lw); break;
    case 'cape': capeClasp(ctx, lw); break;
    default: break;
  }
}

// ---- cape
const CAPE = { light: '#ff8f8f', fill: '#ff5d62', dark: '#d9434f', stroke: '#b53344' };
function cape(ctx: C, t: number, lw: number): void {
  const f = (k: number) => Math.sin(t * 5 - k * 1.4) * 0.07 * k;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0.4, -0.78);
    // top edge, peeking over Bumble's back and sweeping out behind
    ctx.bezierCurveTo(-0.2, -1.1, -0.9, -0.95, -1.3 + f(1), -0.45 + f(1) * 0.5);
    // outer edge billowing out and down
    ctx.quadraticCurveTo(-1.55 + f(1.4), 0.1, -1.7 + f(2), 0.72 + f(2) * 0.4);
    // scalloped hem
    const n = 4;
    let px = -1.7 + f(2);
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const x = -1.7 + u * 1.25 + f(2 - u) * 0.6;
      const y = 0.72 + u * 0.22 + f(2 - u) * 0.4;
      ctx.quadraticCurveTo((px + x) / 2, (0.72 + u * 0.22) + 0.14, x, y);
      px = x;
    }
    ctx.quadraticCurveTo(-0.1, 0.9, 0.2, 0.55);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = lin(ctx, 'cape', 0.2, -0.6, -1.7, 0.8, [[0, CAPE.dark], [0.5, CAPE.fill], [1, CAPE.light]]);
  ctx.fill();
  ctx.strokeStyle = CAPE.stroke;
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  // folds
  ctx.strokeStyle = 'rgba(181,51,68,0.45)';
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.moveTo(-1.05, -0.5);
  ctx.quadraticCurveTo(-1.2 + f(1.3), 0.2, -1.25 + f(1.6) * 0.6, 0.86);
  ctx.moveTo(-1.32, -0.2);
  ctx.quadraticCurveTo(-1.45 + f(1.5), 0.3, -1.52 + f(1.8) * 0.6, 0.8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = lw * 1.4;
  ctx.beginPath();
  ctx.moveTo(-1.15, -0.42);
  ctx.quadraticCurveTo(-1.32 + f(1.4), 0.1, -1.36 + f(1.7) * 0.6, 0.6);
  ctx.stroke();
  // gold star emblem
  ctx.fillStyle = '#ffe680';
  ctx.strokeStyle = PETALS.butter.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  starPath(ctx, -1.33 + f(1.5) * 0.6, 0.38 + f(1.5) * 0.3, 0.17, -0.25 + f(1.5));
  ctx.fill();
  ctx.stroke();
}
function capeClasp(ctx: C, lw: number): void {
  // a little gold clasp where the cape ties on, at the top of Bumble's back
  const [x, y] = rim(-2.0, 0.97);
  ctx.fillStyle = '#ffd54f';
  ctx.strokeStyle = '#b5791a';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(x, y, 0.09, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x - 0.03, y - 0.03, 0.03, 0, TAU);
  ctx.fill();
}

// ---- scarf
const SCARF = { fill: '#ff6f7d', stroke: '#c44a5e', stripe: '#fff1d6', shade: 'rgba(150,40,70,0.22)' };
const SCARF_A0 = 0.62;
const SCARF_A1 = 2.75;
function stripyStrip(ctx: C, pts: readonly (readonly [number, number])[], w: number, lw: number, fringe: boolean): void {
  // a ribbon of width w along a polyline, with cross stripes
  const n = pts.length;
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    left.push([pts[i][0] + nx * w / 2, pts[i][1] + ny * w / 2]);
    right.push([pts[i][0] - nx * w / 2, pts[i][1] - ny * w / 2]);
  }
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fillStyle = SCARF.fill;
  ctx.fill();
  ctx.strokeStyle = SCARF.stripe;
  ctx.lineWidth = w * 0.3;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = 1; i < n - 1; i += 2) {
    ctx.moveTo(left[i][0], left[i][1]);
    ctx.lineTo(right[i][0], right[i][1]);
  }
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.strokeStyle = SCARF.stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  if (fringe) {
    const e = pts[n - 1];
    const p = pts[n - 2];
    const dx = e[0] - p[0];
    const dy = e[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = SCARF.stroke;
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const u = (k + 0.5) / 4;
      const x = left[n - 1][0] + (right[n - 1][0] - left[n - 1][0]) * u;
      const y = left[n - 1][1] + (right[n - 1][1] - left[n - 1][1]) * u;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (dx / l) * 0.08, y + (dy / l) * 0.08);
    }
    ctx.stroke();
  }
}

function scarfTails(ctx: C, t: number, lw: number): void {
  const [ax, ay] = rim(SCARF_A1, 0.92);
  for (let s = 0; s < 2; s++) {
    const pts: [number, number][] = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = ax + 0.05 - u * (0.78 - s * 0.14);
      const y = ay + u * (0.12 + s * 0.2) + Math.sin(t * 7 - u * 4 + s * 1.7) * 0.07 * u;
      pts.push([x, y]);
    }
    stripyStrip(ctx, pts, 0.19, lw, true);
  }
}

function scarfFront(ctx: C, t: number, lw: number): void {
  // the band hugging Bumble's lower rim
  const ko = 1.05;
  const ki = 0.84;
  const band = () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, ko, 0.92 * ko, 0, SCARF_A0, SCARF_A1);
    ctx.ellipse(0, 0, ki, 0.92 * ki, 0, SCARF_A1, SCARF_A0, true);
    ctx.closePath();
  };
  band();
  ctx.fillStyle = SCARF.fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = SCARF.stripe;
  ctx.lineWidth = 0.075;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let a = SCARF_A0 + 0.16; a < SCARF_A1; a += 0.3) {
    const [x0, y0] = rim(a, ki - 0.05);
    const [x1, y1] = rim(a, ko + 0.05);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.fillStyle = rad(ctx, 'scarf-tube', 0, 0, ki, 0, 0, ko, [[0, SCARF.shade], [0.45, 'rgba(255,255,255,0.12)'], [1, SCARF.shade]]);
  ctx.fillRect(-1.2, -0.2, 2.4, 1.4);
  ctx.restore();
  band();
  ctx.strokeStyle = SCARF.stroke;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
  // front tail hanging from the knot
  const [kx, ky] = rim(SCARF_A0 + 0.12, 0.95);
  const sw = Math.sin(t * 3) * 0.04;
  stripyStrip(ctx, [[kx, ky], [kx + 0.06 + sw * 0.3, ky + 0.13], [kx + 0.1 + sw * 0.6, ky + 0.26], [kx + 0.12 + sw, ky + 0.38]], 0.18, lw, true);
  // knot
  ctx.fillStyle = SCARF.fill;
  ctx.strokeStyle = SCARF.stroke;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(kx, ky, 0.12, 0.1, 0.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = SCARF.stripe;
  ctx.lineWidth = lw * 1.4;
  ctx.beginPath();
  ctx.moveTo(kx - 0.05, ky - 0.06);
  ctx.lineTo(kx + 0.03, ky + 0.07);
  ctx.stroke();
}

// ---- bow tie
const BOW = { fill: '#ff6f7d', stroke: '#c44a5e', dot: '#fff4e6' };
function bowTie(ctx: C, t: number, lw: number): void {
  ctx.save();
  ctx.translate(0.56, 0.8);
  ctx.rotate(-0.42 + Math.sin(t * 2.2) * 0.04);
  const wing = (s: number) => {
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.1, -0.16, s * 0.28, -0.2, s * 0.3, -0.12);
    ctx.quadraticCurveTo(s * 0.34, 0, s * 0.3, 0.12);
    ctx.bezierCurveTo(s * 0.28, 0.2, s * 0.1, 0.16, 0, 0);
    ctx.closePath();
  };
  ctx.beginPath();
  wing(-1);
  wing(1);
  ctx.fillStyle = BOW.fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = BOW.dot;
  ctx.beginPath();
  for (const [x, y] of [[-0.22, -0.07], [-0.14, 0.06], [-0.26, 0.09], [0.22, -0.07], [0.14, 0.06], [0.27, 0.08]] as const) {
    ctx.moveTo(x + 0.035, y);
    ctx.arc(x, y, 0.035, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(150,40,70,0.18)';
  ctx.fillRect(-0.4, 0.04, 0.8, 0.2);
  ctx.restore();
  ctx.beginPath();
  wing(-1);
  wing(1);
  ctx.strokeStyle = BOW.stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  // knot
  ctx.fillStyle = '#ff8f99';
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.065, 0.085, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-0.02, -0.03, 0.022, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---- glasses
const EYES = [0.27, 0.8] as const;
const EYE_Y = -0.08;

function heartPath(ctx: C, cx: number, cy: number, s: number): void {
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 0.35, cy + s * 0.62, cx - s * 1.05, cy + s * 0.15, cx - s * 0.98, cy - s * 0.32);
  ctx.bezierCurveTo(cx - s * 0.92, cy - s * 0.84, cx - s * 0.22, cy - s * 0.92, cx, cy - s * 0.44);
  ctx.bezierCurveTo(cx + s * 0.22, cy - s * 0.92, cx + s * 0.92, cy - s * 0.84, cx + s * 0.98, cy - s * 0.32);
  ctx.bezierCurveTo(cx + s * 1.05, cy + s * 0.15, cx + s * 0.35, cy + s * 0.62, cx, cy + s * 0.9);
  ctx.closePath();
}

const HEART = { tint: 'rgba(255,92,160,0.5)', frame: '#ff6fae', stroke: '#c9417f' };
function heartGlasses(ctx: C, lw: number): void {
  const s = 0.27;
  const cy = EYE_Y - 0.01;
  // arm back to the side of the head + bridge
  ctx.strokeStyle = HEART.stroke;
  ctx.lineWidth = lw * 2.2;
  ctx.beginPath();
  ctx.moveTo(EYES[0] - s * 0.95, cy - s * 0.3);
  ctx.quadraticCurveTo(-0.08, cy - 0.12, -0.2, cy - 0.06);
  ctx.moveTo(EYES[0] + s * 0.75, cy - s * 0.45);
  ctx.quadraticCurveTo(0.535, cy - 0.24, EYES[1] - s * 0.75, cy - s * 0.45);
  ctx.stroke();
  ctx.strokeStyle = HEART.frame;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // lenses
  ctx.beginPath();
  heartPath(ctx, EYES[0], cy, s);
  heartPath(ctx, EYES[1], cy, s);
  ctx.fillStyle = HEART.tint;
  ctx.fill();
  ctx.strokeStyle = HEART.stroke;
  ctx.lineWidth = lw * 3;
  ctx.stroke();
  ctx.strokeStyle = HEART.frame;
  ctx.lineWidth = lw * 1.7;
  ctx.stroke();
  // glints
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = lw * 1.3;
  ctx.beginPath();
  for (const ex of EYES) {
    ctx.moveTo(ex - s * 0.6, cy - s * 0.3);
    ctx.quadraticCurveTo(ex - s * 0.6, cy - s * 0.58, ex - s * 0.35, cy - s * 0.62);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  for (const ex of EYES) {
    ctx.moveTo(ex + s * 0.5, cy + s * 0.05);
    ctx.arc(ex + s * 0.42, cy + s * 0.05, lw * 0.9, 0, TAU);
  }
  ctx.fill();
}

const SPECS = { frame: '#c98a3a', stroke: '#8f5a1f', glass: 'rgba(225,242,255,0.28)' };
function specs(ctx: C, lw: number): void {
  const r = 0.235;
  const cy = EYE_Y;
  ctx.strokeStyle = SPECS.stroke;
  ctx.lineWidth = lw * 2;
  ctx.beginPath();
  ctx.moveTo(EYES[0] - r, cy - 0.04);
  ctx.quadraticCurveTo(-0.1, cy - 0.1, -0.22, cy - 0.04);
  ctx.moveTo(EYES[0] + r * 0.94, cy - r * 0.3);
  ctx.quadraticCurveTo(0.535, cy - 0.16, EYES[1] - r * 0.94, cy - r * 0.3);
  ctx.stroke();
  ctx.strokeStyle = SPECS.frame;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  ctx.beginPath();
  for (const ex of EYES) {
    ctx.moveTo(ex + r, cy);
    ctx.arc(ex, cy, r, 0, TAU);
  }
  ctx.fillStyle = SPECS.glass;
  ctx.fill();
  ctx.strokeStyle = SPECS.stroke;
  ctx.lineWidth = lw * 2.6;
  ctx.stroke();
  ctx.strokeStyle = SPECS.frame;
  ctx.lineWidth = lw * 1.4;
  ctx.stroke();
  // glints
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = lw * 1.2;
  ctx.beginPath();
  for (const ex of EYES) {
    ctx.moveTo(ex + Math.cos(3.6) * r * 0.72, cy + Math.sin(3.6) * r * 0.72);
    ctx.arc(ex, cy, r * 0.72, 3.6, 4.3);
  }
  ctx.stroke();
}

// ---- lei
const LEI: readonly { col: Col; petals: number }[] = [
  { col: PETALS.pink, petals: 5 },
  { col: PETALS.butter, petals: 5 },
  { col: PETALS.white, petals: 6 },
  { col: PETALS.coral, petals: 5 },
  { col: PETALS.lilac, petals: 5 },
  { col: PETALS.tangerine, petals: 5 },
];
function lei(ctx: C, t: number, lw: number): void {
  const a0 = 0.7;
  const a1 = 2.95;
  const n = 9;
  // leaves underneath
  for (let i = 0; i < n - 1; i++) {
    const a = a0 + ((i + 0.5) / (n - 1)) * (a1 - a0);
    const [x, y] = rim(a, 1.0);
    leaf(ctx, x, y, 0.16, a + 0.3, lw);
  }
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / (n - 1)) * (a1 - a0);
    const [x, y] = rim(a, 0.96);
    const f = LEI[i % LEI.length];
    flower(ctx, x, y, 0.15, a * 2 + Math.sin(t * 1.6 + i) * 0.1, f.col, f.petals, lw, f.col === PETALS.butter ? '#ff9a6a' : FLOWER_CENTRE);
  }
}
