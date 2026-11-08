// Outfits for Bumble the bee: hats and extras, drawn in Bumble's unit space
// (body ellipse rx 1, ry 0.92 at the origin, facing +x; see drawBee in characters.ts).
// Gradients are made once in unit space and cached, so the outfits cost only a few
// paths per frame.

import { PETALS } from './palette';
import type { BeeMood } from './characters';

export type HatId =
  | 'none' | 'flowercrown' | 'party' | 'sunhat' | 'graduation' | 'tophat' | 'wizard' | 'crown'
  | 'bobble' | 'cracker' | 'elf' | 'toadstool' | 'pirate' | 'antlers' | 'astronaut';
export type ExtraId =
  | 'none' | 'bowtie' | 'heartglasses' | 'scarf' | 'specs' | 'cape' | 'lei'
  | 'moustache' | 'bells' | 'goggles' | 'backpack' | 'medal' | 'wand';

export const HATS: readonly HatId[] = [
  'none', 'flowercrown', 'party', 'sunhat', 'graduation', 'tophat', 'wizard', 'crown',
  'bobble', 'cracker', 'elf', 'antlers', 'toadstool', 'pirate', 'astronaut',
];
export const EXTRAS: readonly ExtraId[] = [
  'none', 'bowtie', 'heartglasses', 'scarf', 'specs', 'cape', 'lei',
  'bells', 'moustache', 'goggles', 'medal', 'backpack', 'wand',
];

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
  bobble: { x: 0.36, y: -0.74, r: 0.2 },
  cracker: { x: 0.38, y: -0.8, r: 0.3 },
  elf: { x: 0.36, y: -0.78, r: 0.2 },
  toadstool: { x: 0.36, y: -0.8, r: 0.18 },
  pirate: { x: 0.36, y: -0.82, r: 0.16 },
  antlers: { x: 0.38, y: -0.84, r: 0.12 },
  // the space helmet is drawn straight in Bumble's own space
  astronaut: { x: 0, y: 0, r: 0 },
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
    case 'bobble':
      return [[-0.38, -1.06], [1.16, -0.94]];
    case 'cracker':
      return [[-0.44, -1.1], [1.22, -0.82]];
    case 'toadstool':
      return [[-0.52, -0.92], [1.24, -0.7]];
    case 'antlers':
      // stand up between the antlers
      return [[0.25, -1.36], [0.63, -1.38]];
    case 'elf':
      // the back one tucked away inside the hat, so it isn't a second bell
      return [[0.36, -1.36], [1.12, -1.0]];
    case 'pirate':
      // well clear of the gold bobbles on the hat's points
      return [[-0.58, -0.98], [1.32, -0.76]];
    case 'astronaut':
      // inside the glass, even when perked up and wobbling
      return [[0.15, -1.3], [0.62, -1.22]];
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
    case 'bobble': bobbleHat(ctx, t, lw); break;
    case 'cracker': crackerCrown(ctx, t, lw); break;
    case 'elf': elfHat(ctx, t, lw); break;
    case 'toadstool': toadstool(ctx, t, lw); break;
    case 'pirate': pirateHat(ctx, t, lw); break;
    case 'antlers': antlers(ctx, t, lw); break;
    case 'astronaut': spaceHelmet(ctx, t, lw); break;
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

// ---- woolly bobble hat (knitted to match the scarf)
const WOOL = { light: '#ff9aa4', fill: '#ff6f7d', dark: '#e2536a', stroke: '#c44a5e', cream: '#fff1d6', creamDark: '#d9bf96' };
function bobbleHat(ctx: C, t: number, lw: number): void {
  const w = 0.5;
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.bezierCurveTo(-w - 0.02, -0.46, -0.24, -0.66, 0.02, -0.66);
    ctx.bezierCurveTo(0.28, -0.66, w + 0.02, -0.44, w, 0);
    ctx.closePath();
  };
  dome();
  ctx.fillStyle = lin(ctx, 'bobble-dome', -w, 0, w, 0, [[0, WOOL.light], [0.4, WOOL.fill], [1, WOOL.dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // rows of little knitted v's
  ctx.strokeStyle = 'rgba(196,74,94,0.4)';
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  for (let row = 0; row < 4; row++) {
    const y0 = -0.13 - row * 0.12;
    for (let x = -0.5 + (row % 2) * 0.05; x < 0.55; x += 0.1) {
      const y = y0 + (1 - (x / 0.6) ** 2) * 0.04;
      ctx.moveTo(x - 0.03, y - 0.035);
      ctx.lineTo(x, y);
      ctx.lineTo(x + 0.03, y - 0.035);
    }
  }
  ctx.stroke();
  // a cream stripe with little diamonds
  ctx.fillStyle = WOOL.cream;
  ctx.beginPath();
  ctx.moveTo(-0.6, -0.4);
  ctx.quadraticCurveTo(0, -0.32, 0.6, -0.4);
  ctx.lineTo(0.6, -0.29);
  ctx.quadraticCurveTo(0, -0.21, -0.6, -0.29);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = WOOL.fill;
  ctx.beginPath();
  for (let x = -0.4; x < 0.45; x += 0.2) {
    const y = -0.3 + (1 - (x / 0.6) ** 2) * 0.04;
    ctx.moveTo(x, y - 0.035);
    ctx.lineTo(x + 0.035, y);
    ctx.lineTo(x, y + 0.035);
    ctx.lineTo(x - 0.035, y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
  dome();
  ctx.strokeStyle = WOOL.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // turned-up ribbed cuff
  const cuff = () => {
    ctx.beginPath();
    ctx.moveTo(-w - 0.05, -0.15);
    ctx.quadraticCurveTo(0, -0.05, w + 0.05, -0.15);
    ctx.lineTo(w + 0.05, 0.04);
    ctx.quadraticCurveTo(0, 0.16, -w - 0.05, 0.04);
    ctx.closePath();
  };
  cuff();
  ctx.fillStyle = lin(ctx, 'bobble-cuff', -w, 0, w, 0, [[0, WOOL.light], [0.35, WOOL.fill], [1, WOOL.dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(196,74,94,0.55)';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (let x = -0.5; x < 0.55; x += 0.075) {
    ctx.moveTo(x, -0.2);
    ctx.lineTo(x * 1.04, 0.2);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = lw * 1.2;
  ctx.beginPath();
  ctx.moveTo(-w, -0.1);
  ctx.quadraticCurveTo(0, -0.0, w, -0.1);
  ctx.stroke();
  ctx.restore();
  cuff();
  ctx.strokeStyle = WOOL.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // big fluffy pom-pom that bobs
  const ph = t * 2.6;
  const bx = 0.02 + Math.sin(ph) * 0.03;
  const by = -0.78 - Math.abs(Math.sin(ph)) * 0.035;
  const pr = 0.17;
  ctx.beginPath();
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + Math.sin(ph) * 0.08;
    const x = bx + Math.cos(a) * pr * 0.68;
    const y = by + Math.sin(a) * pr * 0.68;
    ctx.moveTo(x + pr * 0.4, y);
    ctx.arc(x, y, pr * 0.4, 0, TAU);
  }
  ctx.strokeStyle = WOOL.creamDark;
  ctx.lineWidth = lw * 1.6;
  ctx.stroke();
  ctx.fillStyle = WOOL.cream;
  ctx.fill();
  ctx.save();
  ctx.translate(bx, by);
  ctx.beginPath();
  ctx.arc(0, 0, pr * 0.8, 0, TAU);
  ctx.fillStyle = rad(ctx, 'bobble-pom', -0.05, -0.06, 0.02, 0, 0, pr, [[0, '#fffdf6'], [0.6, WOOL.cream], [1, 'rgba(217,191,150,0.7)']]);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(-0.05, -0.06, 0.035, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---- Christmas cracker crown: thin crinkly tissue paper
const TISSUE = { light: '#ffe2ef', fill: '#ffb8d6', back: '#ffd0e4', dark: '#f39cc2', stroke: '#d0689a' };
/** Heights of the points (a little uneven, like a real crumpled one). */
const CRACKER_TIPS = [0.37, 0.33, 0.4, 0.32, 0.36];
const CRINKLES: readonly (readonly [number, number, number, number])[] = [
  [-0.33, -0.2, -0.3, -0.04], [0.03, -0.27, 0.0, -0.06], [0.3, -0.18, 0.34, -0.03],
];
function crackerCrown(ctx: C, t: number, lw: number): void {
  ctx.scale(1.15, 1.15);
  const w = 0.5;
  const n = CRACKER_TIPS.length;
  const step = (2 * w) / n;
  const sag = (x: number) => 0.06 * (1 - (x / w) ** 2);
  // the back of the paper ring: just a thin band showing in the dips
  ctx.beginPath();
  ctx.ellipse(0, -0.07, w * 0.97, 0.1, 0, Math.PI + 0.15, TAU - 0.15);
  ctx.strokeStyle = TISSUE.stroke;
  ctx.lineWidth = 0.05 + lw * 1.6;
  ctx.stroke();
  ctx.strokeStyle = TISSUE.back;
  ctx.lineWidth = 0.05;
  ctx.stroke();
  // the front: one row of broad, slightly uneven, rustling points
  const front = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 0.02);
    ctx.lineTo(-w - 0.01, -0.11);
    for (let i = 0; i < n; i++) {
      const xt = -w + (i + 0.5) * step;
      const r = Math.sin(t * 3 + i * 1.9) * 0.012;
      ctx.lineTo(xt + r, -CRACKER_TIPS[i] + sag(xt) + Math.abs(r));
      const xv = -w + (i + 1) * step;
      ctx.lineTo(xv + (i === n - 1 ? 0.01 : 0), (i < n - 1 ? -0.12 + (i % 2) * 0.02 : -0.11) + sag(xv));
    }
    ctx.lineTo(w, 0.02);
    ctx.quadraticCurveTo(0, 0.14, -w, 0.02);
    ctx.closePath();
  };
  front();
  ctx.fillStyle = lin(ctx, 'cracker', 0, -0.38, 0, 0.08, [[0, TISSUE.light], [0.55, TISSUE.fill], [1, TISSUE.dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // soft creases in the thin paper, and the glued hem along the bottom
  ctx.lineWidth = lw * 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of CRINKLES) {
    ctx.moveTo(x0, y0 + sag(x0));
    ctx.lineTo((x0 + x1) / 2 + 0.025, (y0 + y1) / 2 + sag(x0));
    ctx.lineTo(x1, y1 + sag(x1));
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(208,104,154,0.45)';
  ctx.beginPath();
  ctx.moveTo(-w, -0.045);
  ctx.quadraticCurveTo(0, 0.075, w, -0.045);
  ctx.stroke();
  ctx.restore();
  front();
  ctx.strokeStyle = TISSUE.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
}

// ---- elf hat: long, floppy, with a bell on the droopy tip
const ELF = { light: '#93e08a', fill: '#5fc16a', dark: '#3f9d52', stroke: '#2f7d42' };
const ELF_CUFF = { fill: '#ff5d62', light: '#ff8f8f', stroke: '#b53344' };
function elfHat(ctx: C, t: number, lw: number): void {
  const sw = Math.sin(t * 1.8) * 0.06;
  const tx = -0.98 + sw;
  const ty = -0.2 + Math.abs(sw) * 0.3;
  const cone = () => {
    ctx.beginPath();
    ctx.moveTo(-0.42, 0);
    ctx.quadraticCurveTo(-0.44, -0.34, -0.34, -0.56);
    ctx.quadraticCurveTo(-0.64 + sw * 0.5, -0.6, tx, ty);
    ctx.quadraticCurveTo(-0.66 + sw * 0.5, -1.1, -0.06, -0.98);
    ctx.quadraticCurveTo(0.34, -0.6, 0.42, 0);
    ctx.ellipse(0, 0, 0.42, 0.09, 0, 0, Math.PI);
    ctx.closePath();
  };
  cone();
  ctx.fillStyle = lin(ctx, 'elf-cone', -0.5, -0.6, 0.42, 0, [[0, ELF.dark], [0.3, ELF.fill], [0.5, ELF.light], [1, ELF.dark]]);
  ctx.fill();
  ctx.strokeStyle = ELF.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // a soft fold where it flops over, and a sheen
  ctx.strokeStyle = 'rgba(47,125,66,0.5)';
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(-0.32, -0.64);
  ctx.quadraticCurveTo(-0.22, -0.82, -0.06, -0.88);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = lw * 1.8;
  ctx.beginPath();
  ctx.moveTo(0.04, -0.22);
  ctx.quadraticCurveTo(0.06, -0.48, 0.0, -0.68);
  ctx.stroke();
  // zig-zag cuff
  const cuff = () => {
    ctx.beginPath();
    ctx.moveTo(-0.46, -0.15);
    ctx.quadraticCurveTo(0, -0.06, 0.46, -0.15);
    ctx.lineTo(0.46, 0.02);
    const k = 5;
    for (let i = 0; i < k; i++) {
      const x0 = 0.46 - (i / k) * 0.92;
      const xm = x0 - 0.46 / k;
      const x1 = x0 - 0.92 / k;
      const sg = (x: number) => 0.07 * (1 - (x / 0.46) ** 2);
      ctx.lineTo(xm, 0.11 + sg(xm));
      ctx.lineTo(x1, (i === k - 1 ? 0.02 : 0.03) + sg(x1));
    }
    ctx.closePath();
  };
  cuff();
  ctx.fillStyle = lin(ctx, 'elf-cuff', -0.46, 0, 0.46, 0, [[0, ELF_CUFF.light], [0.4, ELF_CUFF.fill], [1, '#d9434f']]);
  ctx.fill();
  ctx.strokeStyle = ELF_CUFF.stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(-0.4, -0.1);
  ctx.quadraticCurveTo(0, -0.01, 0.4, -0.1);
  ctx.stroke();
  // a round gold jingle bell, swinging from the tip
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(sw * 3);
  const br = 0.135;
  const by = 0.06 + br;
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.arc(0, 0.04, 0.035, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, by, br, 0, TAU);
  ctx.fillStyle = rad(ctx, 'elf-bell', -0.05, by - 0.06, 0.01, 0, by, br, [[0, GOLD.light], [0.5, GOLD.fill], [1, GOLD.dark]]);
  ctx.fill();
  ctx.stroke();
  // the slot, with a round hole at each end
  ctx.lineWidth = lw * 2.2;
  ctx.strokeStyle = '#8a5512';
  ctx.beginPath();
  ctx.moveTo(-br * 0.62, by + br * 0.28);
  ctx.quadraticCurveTo(0, by + br * 0.52, br * 0.62, by + br * 0.28);
  ctx.moveTo(0, by + br * 0.42);
  ctx.lineTo(0, by + br * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#8a5512';
  ctx.beginPath();
  ctx.arc(-br * 0.62, by + br * 0.28, br * 0.22, 0, TAU);
  ctx.moveTo(br * 0.62 + br * 0.22, by + br * 0.28);
  ctx.arc(br * 0.62, by + br * 0.28, br * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(-br * 0.38, by - br * 0.42, br * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---- toadstool cap: a round red mushroom with white spots
const TOAD = { light: '#ff9a8a', fill: '#f2564f', dark: '#cf3d43', stroke: '#9e2c38', under: '#fff1d9', gill: '#d2b386', spot: '#fffaf0', spotEdge: '#e8d8c4' };
const TOAD_SPOTS: readonly (readonly [number, number, number])[] = [
  [-0.4, -0.2, 0.08], [-0.13, -0.38, 0.1], [0.18, -0.26, 0.075], [0.42, -0.13, 0.065],
  [0.02, -0.12, 0.06], [0.36, -0.42, 0.06], [-0.4, -0.46, 0.055], [-0.2, -0.08, 0.045], [0.12, -0.52, 0.06],
];
function toadstool(ctx: C, t: number, lw: number): void {
  const sq = Math.sin(t * 2.2) * 0.025;
  ctx.scale(1 - sq * 0.6, 1 + sq);
  // the pale underside peeking out below the rim
  ctx.fillStyle = TOAD.under;
  ctx.strokeStyle = TOAD.gill;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(0, 0.03, 0.6, 0.13, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * Math.PI;
    ctx.moveTo(Math.cos(a) * 0.2, 0.03 + Math.sin(a) * 0.045);
    ctx.lineTo(Math.cos(a) * 0.56, 0.03 + Math.sin(a) * 0.12);
  }
  ctx.stroke();
  // the cap
  const cap = () => {
    ctx.beginPath();
    ctx.moveTo(-0.66, 0);
    ctx.bezierCurveTo(-0.7, -0.8, 0.7, -0.8, 0.66, 0);
    ctx.quadraticCurveTo(0, 0.05, -0.66, 0);
    ctx.closePath();
  };
  cap();
  ctx.fillStyle = rad(ctx, 'toad-cap', -0.22, -0.4, 0.04, 0, -0.2, 0.75, [[0, TOAD.light], [0.5, TOAD.fill], [1, TOAD.dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = TOAD.spot;
  ctx.strokeStyle = TOAD.spotEdge;
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  for (const [x, y, r] of TOAD_SPOTS) {
    ctx.moveTo(x + r, y);
    ctx.ellipse(x, y, r, r * 0.85, 0, 0, TAU);
  }
  ctx.fill();
  ctx.stroke();
  // shade the rim so it looks round
  ctx.fillStyle = 'rgba(158,44,56,0.25)';
  ctx.beginPath();
  ctx.moveTo(-0.7, -0.08);
  ctx.quadraticCurveTo(0, 0.0, 0.7, -0.08);
  ctx.lineTo(0.7, 0.1);
  ctx.lineTo(-0.7, 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  cap();
  ctx.strokeStyle = TOAD.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // glossy shine
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-0.36, -0.42, 0.13, 0.05, -0.85, 0, TAU);
  ctx.fill();
}

// ---- pirate hat: a friendly bicorn with gold trim, a plume and an anchor
const PIRATE = { light: '#a2735a', fill: '#7d4f3c', dark: '#5c372a', stroke: '#40241b' };
const PLUME = { root: '#fffaf3', mid: '#fff0f0', tip: '#ff8a96', stroke: '#b98f8f', quill: 'rgba(185,143,143,0.85)' };
const COCKADE = { fill: GOLD.fill, stroke: GOLD.stroke };
/** Points along the plume's spine and its outer and inner edges, reused every frame. */
const PLUME_N = 14;
const plumeSpine = new Float64Array((PLUME_N + 1) * 2);
const plumeNorm = new Float64Array((PLUME_N + 1) * 2);
const plumeWide = new Float64Array(PLUME_N + 1);
/**
 * A classic sweeping plume: from the rosette at the front, up over the top of the hat
 * and back, drooping at the tip; tapered at both ends, with a soft scalloped edge.
 */
function plume(ctx: C, t: number, lw: number): void {
  const fs = Math.sin(t * 2.1) * 0.05;
  const x0 = 0.34, y0 = -0.36, x1 = 0.28, y1 = -0.88, x2 = -0.55 + fs * 0.5, y2 = -0.88, x3 = -0.94 + fs, y3 = -0.48 + Math.abs(fs);
  for (let i = 0; i <= PLUME_N; i++) {
    const u = i / PLUME_N;
    const v = 1 - u;
    plumeSpine[i * 2] = v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3;
    plumeSpine[i * 2 + 1] = v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3;
    const dx = 3 * v * v * (x1 - x0) + 6 * v * u * (x2 - x1) + 3 * u * u * (x3 - x2);
    const dy = 3 * v * v * (y1 - y0) + 6 * v * u * (y2 - y1) + 3 * u * u * (y3 - y2);
    const l = Math.hypot(dx, dy) || 1;
    // the normal pointing up and out (away from the hat)
    plumeNorm[i * 2] = -dy / l;
    plumeNorm[i * 2 + 1] = dx / l;
    plumeWide[i] = 0.015 + 0.13 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.04)), 0.75);
  }
  const ex = (i: number, s: number) => plumeSpine[i * 2] + plumeNorm[i * 2] * plumeWide[i] * s;
  const ey = (i: number, s: number) => plumeSpine[i * 2 + 1] + plumeNorm[i * 2 + 1] * plumeWide[i] * s;
  ctx.beginPath();
  ctx.moveTo(ex(0, 1), ey(0, 1));
  // outer edge: a small soft scallop between each pair of points
  for (let i = 0; i < PLUME_N; i++) {
    const mx = (ex(i, 1) + ex(i + 1, 1)) / 2 + (plumeNorm[i * 2] + plumeNorm[i * 2 + 2]) * 0.03;
    const my = (ey(i, 1) + ey(i + 1, 1)) / 2 + (plumeNorm[i * 2 + 1] + plumeNorm[i * 2 + 3]) * 0.03;
    ctx.quadraticCurveTo(mx, my, ex(i + 1, 1), ey(i + 1, 1));
  }
  // inner edge back to the root, scalloped a little more gently, two points at a time
  for (let i = PLUME_N; i > 0; i -= 2) {
    const j = Math.max(0, i - 2);
    const k = i - 1;
    const mx = ex(k, -0.8) - plumeNorm[k * 2] * 0.035;
    const my = ey(k, -0.8) - plumeNorm[k * 2 + 1] * 0.035;
    ctx.quadraticCurveTo(mx, my, ex(j, -0.8), ey(j, -0.8));
  }
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 'pirate-plume', 0.34, -0.4, -0.94, -0.5, [[0, PLUME.root], [0.55, PLUME.mid], [1, PLUME.tip]]);
  ctx.fill();
  ctx.strokeStyle = PLUME.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  // the quill, and a few soft barbs
  ctx.beginPath();
  ctx.moveTo(plumeSpine[0], plumeSpine[1]);
  for (let i = 1; i < PLUME_N; i++) ctx.lineTo(plumeSpine[i * 2], plumeSpine[i * 2 + 1]);
  for (let i = 3; i < PLUME_N - 1; i += 2) {
    ctx.moveTo(plumeSpine[i * 2], plumeSpine[i * 2 + 1]);
    ctx.lineTo(ex(i + 1, 0.7), ey(i + 1, 0.7));
  }
  ctx.strokeStyle = PLUME.quill;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
}
function pirateHat(ctx: C, t: number, lw: number): void {
  // the hat: a wide crescent with turned-up points
  const top = () => {
    ctx.moveTo(-0.72, -0.17);
    ctx.bezierCurveTo(-0.5, -0.22, -0.44, -0.6, 0, -0.6);
    ctx.bezierCurveTo(0.44, -0.6, 0.5, -0.22, 0.72, -0.17);
  };
  const shape = () => {
    ctx.beginPath();
    top();
    ctx.quadraticCurveTo(0.5, 0.0, 0.3, 0.04);
    ctx.quadraticCurveTo(0, 0.11, -0.3, 0.04);
    ctx.quadraticCurveTo(-0.5, 0.0, -0.72, -0.17);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = lin(ctx, 'pirate-hat', -0.6, -0.5, 0.6, 0.1, [[0, PIRATE.light], [0.45, PIRATE.fill], [1, PIRATE.dark]]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // gold braid along the top edge
  ctx.beginPath();
  top();
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = 0.15;
  ctx.stroke();
  ctx.strokeStyle = GOLD.fill;
  ctx.lineWidth = 0.15 - lw * 1.6;
  ctx.stroke();
  ctx.strokeStyle = GOLD.light;
  ctx.lineWidth = lw * 0.8;
  ctx.stroke();
  // sheen
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = lw * 2;
  ctx.beginPath();
  ctx.moveTo(-0.42, -0.24);
  ctx.quadraticCurveTo(-0.3, -0.44, -0.08, -0.47);
  ctx.stroke();
  ctx.restore();
  shape();
  ctx.strokeStyle = PIRATE.stroke;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  // gold bobbles on the points
  ctx.fillStyle = GOLD.fill;
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.arc(-0.73, -0.18, 0.045, 0, TAU);
  ctx.moveTo(0.775, -0.18);
  ctx.arc(0.73, -0.18, 0.045, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // a sweeping plume, pinned on with a gold rosette at the front
  plume(ctx, t, lw);
  flower(ctx, 0.34, -0.36, 0.115, 0.3, COCKADE, 8, lw, '#ff5d62');
  // a bold gold anchor
  ctx.save();
  ctx.translate(0.0, -0.28);
  ctx.scale(1.33, 1.33);
  const anchor = () => {
    ctx.beginPath();
    ctx.moveTo(0.035, -0.13);
    ctx.arc(0, -0.13, 0.035, 0, TAU);
    ctx.moveTo(0, -0.095);
    ctx.lineTo(0, 0.1);
    ctx.moveTo(-0.065, -0.05);
    ctx.lineTo(0.065, -0.05);
    ctx.moveTo(-0.1, 0.03);
    ctx.quadraticCurveTo(-0.08, 0.11, 0, 0.11);
    ctx.quadraticCurveTo(0.08, 0.11, 0.1, 0.03);
  };
  anchor();
  ctx.strokeStyle = PIRATE.stroke;
  ctx.lineWidth = lw * 2.3;
  ctx.stroke();
  ctx.strokeStyle = GOLD.fill;
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  ctx.restore();
}

// ---- reindeer antlers on a headband, with a sprig of holly
const ANTLER = { fill: '#d6a273', light: '#f2cc9e', stroke: '#86562f' };
const HEADBAND = { fill: '#ff5d62', stroke: '#b53344' };
/** One plush antler as quadratic curves [x0, y0, cx, cy, x1, y1], base at 0,0: the beam first, then two tines. */
const ANTLER_BRANCHES: readonly (readonly [number, number, number, number, number, number])[] = [
  [0, 0, -0.03, -0.32, 0.13, -0.63],
  [0.02, -0.17, 0.17, -0.18, 0.25, -0.3],
  [0.03, -0.4, -0.06, -0.44, -0.09, -0.58],
];
function antler(ctx: C, x: number, y: number, rot: number, flip: number, lw: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(flip, 1);
  ctx.beginPath();
  for (const [x0, y0, cx, cy, x1, y1] of ANTLER_BRANCHES) {
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
  }
  const W = 0.115;
  ctx.strokeStyle = ANTLER.stroke;
  ctx.lineWidth = W + lw * 1.8;
  ctx.stroke();
  ctx.strokeStyle = ANTLER.fill;
  ctx.lineWidth = W;
  ctx.stroke();
  // a soft highlight down the main beam only
  const [x0, y0, cx, cy, x1, y1] = ANTLER_BRANCHES[0];
  ctx.beginPath();
  ctx.moveTo(x0 - 0.025, y0 - 0.06);
  ctx.quadraticCurveTo(cx - 0.025, cy, x1 - 0.03, y1 + 0.04);
  ctx.strokeStyle = ANTLER.light;
  ctx.lineWidth = W * 0.3;
  ctx.stroke();
  ctx.restore();
}
function antlers(ctx: C, t: number, lw: number): void {
  const wig = Math.sin(t * 2) * 0.03;
  antler(ctx, -0.3, 0.06, -0.3 - wig, -1, lw);
  antler(ctx, 0.32, 0.06, 0.3 + wig, 1, lw);
  // headband over the top of the head
  ctx.beginPath();
  ctx.moveTo(-0.52, 0.16);
  ctx.quadraticCurveTo(0, -0.14, 0.52, 0.16);
  ctx.strokeStyle = HEADBAND.stroke;
  ctx.lineWidth = 0.09 + lw * 1.8;
  ctx.stroke();
  ctx.strokeStyle = HEADBAND.fill;
  ctx.lineWidth = 0.09;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(-0.4, 0.07);
  ctx.quadraticCurveTo(0, -0.18, 0.4, 0.07);
  ctx.stroke();
  // holly sprig: two leaves and three berries
  leaf(ctx, 0.04, 0.0, 0.2, -2.7, lw);
  leaf(ctx, 0.1, 0.0, 0.2, -0.45, lw);
  ctx.fillStyle = '#ff4a5e';
  ctx.strokeStyle = '#a82840';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (const [bx, by] of [[0.04, -0.03], [0.12, -0.04], [0.08, 0.04]] as const) {
    ctx.moveTo(bx + 0.045, by);
    ctx.arc(bx, by, 0.045, 0, TAU);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  for (const [bx, by] of [[0.04, -0.03], [0.12, -0.04], [0.08, 0.04]] as const) {
    ctx.moveTo(bx - 0.0, by - 0.015);
    ctx.arc(bx - 0.015, by - 0.015, 0.014, 0, TAU);
  }
  ctx.fill();
}

// ---- space helmet: a round glass bubble over all of (round) Bumble, seated in a spacesuit neck ring
/** Bubble centre, and where the glass meets the ring: its height and half-width. */
const HELM = { cx: -0.08, cy: -0.34, collarY: 0.8, hw: 0.82 };
const HELM_R = Math.hypot(HELM.hw, HELM.collarY - HELM.cy);
/** The neck ring: half-width, the depth of its top face (a thin sliver), and the height of its front band. */
const RING = { rx: 0.96, ry: 0.075, depth: 0.18 };
const COLLAR = { top: '#9aa6c2', light: '#f6f8fc', shade: '#c6cee0', stroke: '#6f7fa6', band: '#ff7a7a' };
function spaceHelmet(ctx: C, t: number, lw: number): void {
  const { cx, cy, collarY, hw } = HELM;
  const r = HELM_R;
  const a = Math.atan2(collarY - cy, hw);
  const a0 = Math.PI - a;
  const a1 = a + TAU;
  // glass: completely clear in the middle, a cool blue only towards the rim
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.closePath();
  ctx.fillStyle = rad(ctx, 'helm-glass', cx - 0.3, cy - 0.35, 0.1, cx, cy, r, [[0, 'rgba(205,232,255,0)'], [0.78, 'rgba(170,214,255,0.05)'], [1, 'rgba(120,180,245,0.48)']]);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.strokeStyle = 'rgba(90,135,200,0.95)';
  ctx.lineWidth = lw * 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - lw * 2, a0 + 0.08, a1 - 0.08);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = lw;
  ctx.stroke();
  // window shine top left, a glint, and a short reflection below the cheek
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = lw * 3.2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 3.75, 4.45);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(cx + Math.cos(4.68) * r * 0.86, cy + Math.sin(4.68) * r * 0.86, lw * 1.7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = lw * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.91, 0.66, 0.9);
  ctx.stroke();
  // the neck ring: a thin darker sliver of its top face, the glass sitting in it...
  const { rx, ry, depth } = RING;
  ctx.beginPath();
  ctx.ellipse(cx, collarY, rx, ry, 0, 0, TAU);
  ctx.fillStyle = COLLAR.top;
  ctx.fill();
  ctx.strokeStyle = COLLAR.stroke;
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  // ...and its chunky front band
  ctx.beginPath();
  ctx.ellipse(cx, collarY, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, collarY + depth);
  ctx.ellipse(cx, collarY + depth, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 'helm-collar', 0, collarY, 0, collarY + depth + ry, [[0, COLLAR.light], [1, COLLAR.shade]]);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, collarY + 0.03, rx - 0.03, ry, 0, 0.25, Math.PI - 0.25);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = lw * 1.1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, collarY + depth * 0.5, rx, ry, 0, 0.08, Math.PI - 0.08);
  ctx.strokeStyle = COLLAR.band;
  ctx.lineWidth = 0.045;
  ctx.stroke();
  ctx.fillStyle = COLLAR.stroke;
  ctx.beginPath();
  for (const th of [0.45, 1.75, 2.6]) {
    const bx = cx + Math.cos(th) * rx * 0.97;
    const by = collarY + depth * 0.8 + Math.sin(th) * ry;
    ctx.moveTo(bx + 0.024, by);
    ctx.arc(bx, by, 0.024, 0, TAU);
  }
  ctx.fill();
  // a light on the front of the ring that glows on and off
  const lx = cx + Math.cos(1.1) * rx;
  const ly = collarY + depth * 0.5 + Math.sin(1.1) * ry;
  ctx.fillStyle = '#3fa487';
  ctx.strokeStyle = '#2b7a64';
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.arc(lx, ly, 0.05, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const glow = 0.5 + 0.5 * Math.sin(t * 3.4);
  ctx.save();
  ctx.globalAlpha *= glow;
  ctx.fillStyle = '#c8ffec';
  ctx.beginPath();
  ctx.arc(lx, ly, 0.038, 0, TAU);
  ctx.fill();
  ctx.restore();
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
  else if (extra === 'backpack') backpack(ctx, t, lw);
}

/** Drawn after the face: glasses, bow tie, lei, scarf band. */
export function drawExtraFront(ctx: C, extra: ExtraId, t: number, lw: number, mood: BeeMood = 'idle'): void {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (extra) {
    case 'bowtie': bowTie(ctx, t, lw); break;
    case 'heartglasses': heartGlasses(ctx, lw); break;
    case 'specs': specs(ctx, lw); break;
    case 'scarf': scarfFront(ctx, t, lw); break;
    case 'lei': lei(ctx, t, lw); break;
    case 'cape': capeClasp(ctx, lw); break;
    case 'moustache': moustache(ctx, t, lw, mood); break;
    case 'bells': jingleBells(ctx, t, lw, mood); break;
    case 'goggles': goggles(ctx, lw); break;
    case 'backpack': backpackStraps(ctx, lw); break;
    case 'medal': medal(ctx, t, lw, mood); break;
    case 'wand': wand(ctx, t, lw, mood); break;
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

/* ------------------------------------------------------------------ */
/* Winter treasures: moustache, bells, goggles, backpack, medal, wand  */
/* ------------------------------------------------------------------ */

// ---- twirly moustache
const TASH = { light: '#a5704a', fill: '#7a4a2e', stroke: '#4a2a1a' };
function moustache(ctx: C, t: number, lw: number, mood: BeeMood): void {
  const cheer = mood === 'cheer';
  // a happy wiggle when cheering (the tips bounce down, never up into the
  // eyes), otherwise a slow little twitch
  const wig = cheer ? (0.5 + 0.5 * Math.sin(t * 13)) * 0.15 : (0.5 + 0.5 * Math.sin(t * 1.7)) * 0.04;
  const curlW = 0.065;
  const half = (s: number, draw: () => void) => {
    ctx.save();
    ctx.rotate(s * wig);
    ctx.scale(s, 1);
    draw();
    ctx.restore();
  };
  // full in the middle, so the idle smile tucks right under it
  const lobe = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0.12);
    ctx.bezierCurveTo(0.1, 0.13, 0.25, 0.095, 0.33, -0.005);
    ctx.bezierCurveTo(0.24, -0.055, 0.1, -0.085, 0, -0.035);
  };
  // the handlebar tips sweep up and curl outside the eyes, so the face stays clear
  const curl = () => {
    ctx.beginPath();
    ctx.moveTo(0.3, 0.005);
    ctx.quadraticCurveTo(0.4, 0.0, 0.435, -0.06);
    ctx.quadraticCurveTo(0.455, -0.125, 0.395, -0.128);
    ctx.quadraticCurveTo(0.35, -0.125, 0.365, -0.083);
  };
  ctx.save();
  ctx.translate(0.54, 0.29);
  // drawn a touch bigger than its unit shape, so it reads at thumbnail size
  const k = 1.2;
  ctx.scale(k, k);
  lw /= k;
  // curl outlines, then the lobes, then the curls' fill over the joins
  ctx.strokeStyle = TASH.stroke;
  ctx.lineWidth = curlW + lw * 1.2;
  for (const s of [-1, 1]) half(s, () => { curl(); ctx.stroke(); });
  for (const s of [-1, 1]) half(s, () => {
    lobe();
    ctx.fillStyle = lin(ctx, 'tash', 0, -0.09, 0, 0.13, [[0, TASH.light], [0.4, TASH.fill], [1, TASH.stroke]]);
    ctx.fill();
    ctx.strokeStyle = TASH.stroke;
    ctx.lineWidth = lw * 1.2;
    ctx.stroke();
  });
  ctx.strokeStyle = TASH.fill;
  ctx.lineWidth = curlW;
  for (const s of [-1, 1]) half(s, () => { curl(); ctx.stroke(); });
  // sheen on top of each side
  ctx.strokeStyle = 'rgba(255,214,170,0.55)';
  ctx.lineWidth = lw * 0.8;
  for (const s of [-1, 1]) half(s, () => {
    ctx.beginPath();
    ctx.moveTo(0.07, -0.05);
    ctx.quadraticCurveTo(0.15, -0.065, 0.22, -0.035);
    ctx.stroke();
  });
  ctx.restore();
}

// ---- jingle bells
const RIBBON = { fill: '#e8414e', light: '#ff7a80', stroke: '#a82535' };
const BELL = { light: '#fff6b8', fill: '#ffd54f', dark: '#e3a127', stroke: '#a8701a', slot: '#6b4310' };
// hung high on the collar, so the lowest bell stays inside the wardrobe thumbnail
const BELLS: readonly { a: number; s: number }[] = [
  { a: 1.05, s: 0.95 },
  { a: 1.42, s: 1.05 },
  { a: 1.8, s: 0.95 },
];
function jingleBells(ctx: C, t: number, lw: number, mood: BeeMood): void {
  const a0 = 0.68;
  const a1 = 2.7;
  const ko = 1.0;
  const ki = 0.89;
  // red ribbon collar hugging Bumble's lower rim
  ctx.beginPath();
  ctx.ellipse(0, 0, ko, 0.92 * ko, 0, a0, a1);
  ctx.ellipse(0, 0, ki, 0.92 * ki, 0, a1, a0, true);
  ctx.closePath();
  ctx.fillStyle = rad(ctx, 'bell-ribbon', 0, 0, ki, 0, 0, ko, [[0, RIBBON.fill], [0.4, RIBBON.light], [1, RIBBON.fill]]);
  ctx.fill();
  ctx.strokeStyle = RIBBON.stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  // bells, swinging (and jingling hard when Bumble cheers)
  const fast = mood === 'cheer';
  const sleepy = mood === 'sleepy';
  BELLS.forEach((b, i) => {
    const [x, y] = rim(b.a, 0.93);
    const sw = Math.sin(t * (fast ? 11 : sleepy ? 1.6 : 4) + i * 1.9) * (fast ? 0.45 : sleepy ? 0.08 : 0.22);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sw);
    ctx.scale(b.s, b.s);
    const l = lw / b.s;
    // little loop
    ctx.strokeStyle = BELL.stroke;
    ctx.lineWidth = l * 1.3;
    ctx.beginPath();
    ctx.ellipse(0, 0.025, 0.03, 0.035, 0, 0, TAU);
    ctx.stroke();
    // round sleigh bell
    ctx.fillStyle = rad(ctx, 'bell', -0.04, 0.085, 0.01, 0, 0.135, 0.12, [[0, BELL.light], [0.45, BELL.fill], [1, BELL.dark]]);
    ctx.strokeStyle = BELL.stroke;
    ctx.lineWidth = l * 1.1;
    ctx.beginPath();
    ctx.arc(0, 0.135, 0.11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // band round the middle and the slot underneath
    ctx.lineWidth = l * 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0.125, 0.105, 0.03, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.strokeStyle = BELL.slot;
    ctx.lineWidth = l * 1.5;
    ctx.beginPath();
    ctx.moveTo(-0.045, 0.185);
    ctx.lineTo(0.045, 0.185);
    ctx.stroke();
    ctx.fillStyle = BELL.slot;
    ctx.beginPath();
    ctx.arc(0, 0.185, 0.022, 0, TAU);
    ctx.fill();
    // shine
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(-0.045, 0.085, 0.025, 0, TAU);
    ctx.fill();
    ctx.restore();
  });
  // a holly sprig where the ribbon ties, leaves pointing away from the mouth
  const [hx, hy] = rim(0.72, 1.03);
  ctx.save();
  ctx.translate(hx, hy);
  for (const r of [-0.25, 0.85]) {
    ctx.save();
    ctx.rotate(r);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0.05, -0.07, 0.08, -0.04);
    ctx.quadraticCurveTo(0.11, -0.09, 0.15, -0.05);
    ctx.quadraticCurveTo(0.2, -0.06, 0.22, 0);
    ctx.quadraticCurveTo(0.2, 0.06, 0.15, 0.05);
    ctx.quadraticCurveTo(0.11, 0.09, 0.08, 0.04);
    ctx.quadraticCurveTo(0.05, 0.07, 0, 0);
    ctx.fillStyle = '#5bb04a';
    ctx.strokeStyle = '#2f6e2b';
    ctx.lineWidth = lw * 0.9;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#ff4a5a';
  ctx.strokeStyle = RIBBON.stroke;
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  for (const [bx, by] of [[0.0, -0.02], [0.065, -0.03], [0.035, 0.035]] as const) {
    ctx.moveTo(bx + 0.045, by);
    ctx.arc(bx, by, 0.045, 0, TAU);
  }
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(0.05, -0.045, 0.014, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---- pilot goggles
const GOG = { strap: '#8a5a3c', strapLight: '#b07a52', strapStroke: '#5a3624', brass: '#e6b04a', brassLight: '#fff0b0', brassDark: '#b07a22', stroke: '#7a5014' };
function goggles(ctx: C, lw: number): void {
  const r = 0.21;
  const ring = 0.065;
  const cy = EYE_Y;
  // leather strap round the back of the head, and a stub on the far side
  const strap = () => {
    ctx.beginPath();
    ctx.moveTo(EYES[0] - r, cy - 0.02);
    ctx.quadraticCurveTo(-0.45, cy + 0.06, -0.99, cy - 0.12);
    ctx.moveTo(EYES[1] + r, cy - 0.02);
    ctx.lineTo(1.0, cy - 0.04);
  };
  ctx.lineCap = 'butt';
  strap();
  ctx.strokeStyle = GOG.strapStroke;
  ctx.lineWidth = 0.13 + lw * 1.2;
  ctx.stroke();
  ctx.strokeStyle = GOG.strap;
  ctx.lineWidth = 0.13;
  ctx.stroke();
  ctx.strokeStyle = GOG.strapLight;
  ctx.lineWidth = 0.03;
  ctx.setLineDash([0.05, 0.045]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  // bridge
  ctx.strokeStyle = GOG.stroke;
  ctx.lineWidth = lw * 3;
  ctx.beginPath();
  ctx.moveTo(EYES[0] + r, cy - 0.05);
  ctx.quadraticCurveTo(0.535, cy - 0.12, EYES[1] - r, cy - 0.05);
  ctx.stroke();
  ctx.strokeStyle = GOG.brass;
  ctx.lineWidth = lw * 1.6;
  ctx.stroke();
  for (const ex of EYES) {
    ctx.save();
    ctx.translate(ex, cy);
    // pale glass, clear in the middle so the eyes (open or closed) stay crisp
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = rad(ctx, 'gog-glass', 0, 0, r * 0.35, 0, 0, r, [[0, 'rgba(240,250,255,0.12)'], [1, 'rgba(200,232,255,0.55)']]);
    ctx.fill();
    // brass rim
    ctx.beginPath();
    ctx.arc(0, 0, r + ring, 0, TAU);
    ctx.moveTo(r, 0);
    ctx.arc(0, 0, r, 0, TAU, true);
    ctx.fillStyle = lin(ctx, 'gog-rim', -r, -r, r, r, [[0, GOG.brassLight], [0.4, GOG.brass], [1, GOG.brassDark]]);
    ctx.fill();
    ctx.strokeStyle = GOG.stroke;
    ctx.lineWidth = lw * 1.1;
    ctx.stroke();
    // rivets
    ctx.fillStyle = GOG.brassDark;
    ctx.beginPath();
    for (const a of [0.6, 2.5, 4.4]) {
      const rx = Math.cos(a) * (r + ring / 2);
      const ry = Math.sin(a) * (r + ring / 2);
      ctx.moveTo(rx + 0.016, ry);
      ctx.arc(rx, ry, 0.016, 0, TAU);
    }
    ctx.fill();
    // glints out near the rim, clear of the eye curves
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = lw * 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 3.75, 4.45);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(Math.cos(0.55) * r * 0.82, Math.sin(0.55) * r * 0.82, lw, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---- adventure backpack
const PACK = { light: '#b4f2d6', fill: '#7cd9b2', dark: '#55bc94', stroke: '#2f8063', flap: '#ffa45c', flapLight: '#ffc58f', flapStroke: '#c0682a' };
function backpack(ctx: C, t: number, lw: number): void {
  // shoulder strap from the top of the pack over Bumble's shoulder; it peeks out
  // above the outline and carries on as the front strap
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(-0.98, -0.62);
  ctx.quadraticCurveTo(-0.86, -0.95, -0.56, -0.8);
  ctx.strokeStyle = PACK.stroke;
  ctx.lineWidth = 0.075 + lw * 1.1;
  ctx.stroke();
  ctx.strokeStyle = PACK.fill;
  ctx.lineWidth = 0.075;
  ctx.stroke();
  ctx.save();
  // a little jiggle as Bumble buzzes along
  ctx.translate(-1.12, -0.35 + Math.sin(t * 2.6 + 0.8) * 0.012);
  ctx.rotate(0.28);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const w = 0.7;
  const h = 0.86;
  // the bag
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 0.2);
  ctx.fillStyle = lin(ctx, 'pack', -w / 2, 0, w / 2, 0, [[0, PACK.light], [0.45, PACK.fill], [1, PACK.dark]]);
  ctx.fill();
  ctx.strokeStyle = PACK.stroke;
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  // orange flap over the top
  const fy = -h / 2;
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 0.01, fy + 0.18);
  ctx.quadraticCurveTo(-w / 2, fy - 0.02, 0, fy - 0.02);
  ctx.quadraticCurveTo(w / 2, fy - 0.02, w / 2 + 0.01, fy + 0.18);
  ctx.quadraticCurveTo(w / 2, fy + 0.4, 0, fy + 0.42);
  ctx.quadraticCurveTo(-w / 2, fy + 0.4, -w / 2 - 0.01, fy + 0.18);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 'pack-flap', -w / 2, 0, w / 2, 0, [[0, PACK.flapLight], [0.5, PACK.flap], [1, PACK.flapStroke]]);
  ctx.fill();
  ctx.strokeStyle = PACK.flapStroke;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 0.07, fy + 0.07);
  ctx.quadraticCurveTo(-0.12, fy + 0.02, 0.06, fy + 0.03);
  ctx.stroke();
  // front pocket with a little flower patch
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 0.06, 0.12, w * 0.58, 0.24, 0.08);
  ctx.fillStyle = PACK.light;
  ctx.fill();
  ctx.strokeStyle = PACK.stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
  flower(ctx, -w / 2 + 0.06 + w * 0.29, 0.24, 0.09, 0.3, PETALS.pink, 5, lw * 0.8);
  // gold buckle at the flap's tip
  ctx.fillStyle = '#ffd54f';
  ctx.strokeStyle = '#a8701a';
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.roundRect(-0.07, fy + 0.35, 0.13, 0.11, 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function backpackStraps(ctx: C, lw: number): void {
  // the front strap, carrying on from the shoulder down the yellow gap between the stripes
  const strap = () => {
    ctx.beginPath();
    ctx.moveTo(-0.58, -0.76);
    ctx.quadraticCurveTo(-0.27, 0, -0.56, 0.74);
  };
  ctx.lineCap = 'butt';
  strap();
  ctx.strokeStyle = PACK.stroke;
  ctx.lineWidth = 0.075 + lw * 1.1;
  ctx.stroke();
  ctx.strokeStyle = PACK.fill;
  ctx.lineWidth = 0.075;
  ctx.stroke();
  ctx.lineCap = 'round';
  // buckle
  ctx.fillStyle = '#ffd54f';
  ctx.strokeStyle = '#a8701a';
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.roundRect(-0.48, -0.12, 0.12, 0.13, 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.42, -0.08);
  ctx.lineTo(-0.42, -0.03);
  ctx.stroke();
}

// ---- gold medal
const MEDAL_RIBBON = { fill: '#5aa6e8', stroke: '#2f6aa8', stripe: '#fff8ec' };
function medal(ctx: C, t: number, lw: number, mood: BeeMood): void {
  const sw = Math.sin(t * (mood === 'cheer' ? 6 : 1.9)) * (mood === 'cheer' ? 0.14 : 0.06);
  // hangs on Bumble's tummy, left of the mouth and high enough to stay inside the
  // wardrobe thumbnail (and above a space helmet's collar)
  const mx = 0.08;
  const my = 0.5;
  const R = 0.21;
  // ribbon: a V rising from the ring. The back arm climbs over Bumble's side and is
  // clipped just inside the outline, so it wraps round behind; the front arm tucks
  // behind the disc.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, 1 - lw * 0.65, 0.92 - lw * 0.65, 0, 0, TAU);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(mx - 0.02, my + 0.02);
  ctx.quadraticCurveTo(-0.45, 0.5, -1.06, 0.1);
  ctx.moveTo(mx + 0.02, my + 0.02);
  ctx.quadraticCurveTo(0.2, 0.55, 0.22, 0.72);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = MEDAL_RIBBON.stroke;
  ctx.lineWidth = 0.12 + lw * 1.1;
  ctx.stroke();
  ctx.strokeStyle = MEDAL_RIBBON.fill;
  ctx.lineWidth = 0.12;
  ctx.stroke();
  ctx.strokeStyle = MEDAL_RIBBON.stripe;
  ctx.lineWidth = 0.035;
  ctx.stroke();
  ctx.restore();
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(sw);
  // little ring
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = lw * 1.4;
  ctx.beginPath();
  ctx.arc(0, 0.03, 0.035, 0, TAU);
  ctx.stroke();
  // disc, with a deep gold edge so it stands out on Bumble's yellow
  const cy = 0.055 + R;
  ctx.beginPath();
  ctx.arc(0, cy, R, 0, TAU);
  ctx.fillStyle = rad(ctx, 'medal', -0.07, cy - 0.08, 0.02, 0, cy, R, [[0, GOLD.light], [0.4, GOLD.fill], [0.78, GOLD.dark], [1, '#d08a1c']]);
  ctx.fill();
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = lw * 1.5;
  ctx.stroke();
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath();
  ctx.arc(0, cy, R * 0.78, 0, TAU);
  ctx.stroke();
  // embossed star
  ctx.beginPath();
  starPath(ctx, 0, cy + 0.01, R * 0.58, 0, 0.48);
  ctx.fillStyle = GOLD.light;
  ctx.fill();
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  // shine sweeping across now and then
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, cy, R, 0, TAU);
  ctx.clip();
  const gx = ((t * 0.45) % 1.8) - 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(gx - 0.08, cy + R);
  ctx.lineTo(gx + 0.02, cy - R);
  ctx.lineTo(gx + 0.07, cy - R);
  ctx.lineTo(gx - 0.03, cy + R);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-R * 0.5, cy - R * 0.5, R * 0.12, 0, TAU);
  ctx.fill();
  const tw = Math.max(0, Math.sin(t * 2.3 + 0.6));
  twinkle(ctx, R * 0.75, cy - R * 0.7, 0.11 * tw, '#fffbe0', tw);
  ctx.restore();
}

// ---- magic wand
const WAND = { fill: '#b99cff', stroke: '#5c4cb4', stripe: '#fffdf7', leg: '#6f4789' };
const WAND_SPARKS = ['#ff9ec7', '#fff3a8', '#b99cff', '#8fd0ff'] as const;
function wand(ctx: C, t: number, lw: number, mood: BeeMood): void {
  // held in Bumble's front leg, pointing forward; waved about when cheering,
  // drooping when sleepy
  const a = mood === 'cheer' ? -0.36 + Math.sin(t * 7) * 0.2
    : mood === 'sleepy' ? 0.15 + Math.sin(t * 1.4) * 0.04
      : -0.32 + Math.sin(t * 2.4) * 0.08;
  const gx = 0.19;
  const gy = 0.97;
  const len = 1.05;
  const sx = gx + Math.cos(a) * len;
  const sy = gy + Math.sin(a) * len;
  // shaft
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gx - Math.cos(a) * 0.12, gy - Math.sin(a) * 0.12);
  ctx.lineTo(sx, sy);
  ctx.strokeStyle = WAND.stroke;
  ctx.lineWidth = 0.09 + lw * 1.2;
  ctx.stroke();
  ctx.strokeStyle = WAND.fill;
  ctx.lineWidth = 0.09;
  ctx.stroke();
  // candy stripes
  ctx.strokeStyle = WAND.stripe;
  ctx.lineWidth = lw * 1.2;
  ctx.beginPath();
  const nx = -Math.sin(a) * 0.036;
  const ny = Math.cos(a) * 0.036;
  for (let i = 0; i < 5; i++) {
    const u = 0.14 + i * 0.16;
    const px = gx + Math.cos(a) * len * u;
    const py = gy + Math.sin(a) * len * u;
    ctx.moveTo(px - nx + Math.cos(a) * 0.03, py - ny + Math.sin(a) * 0.03);
    ctx.lineTo(px + nx - Math.cos(a) * 0.03, py + ny - Math.sin(a) * 0.03);
  }
  ctx.stroke();
  // Bumble's front leg curling round the grip
  ctx.strokeStyle = WAND.leg;
  ctx.lineWidth = lw * 1.5;
  ctx.beginPath();
  ctx.moveTo(0.2, 0.82);
  ctx.quadraticCurveTo(0.27, 0.92, gx + 0.03, gy + 0.03);
  ctx.stroke();
  // twinkle trail drifting back from the star
  const dim = mood === 'sleepy' ? 0.45 : 1;
  for (let k = 0; k < 4; k++) {
    const p = (t * 0.7 + k / 4) % 1;
    const tx = sx - p * 0.55;
    const ty = sy + Math.sin(p * 5 + k * 1.7) * 0.07 + p * 0.12;
    twinkle(ctx, tx, ty, 0.09 * (1 - p * 0.6), WAND_SPARKS[k], Math.sin(p * Math.PI) * dim);
  }
  // soft glow and the star
  const pulse = 0.75 + 0.25 * Math.sin(t * 4.2);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.globalAlpha *= pulse * dim;
  ctx.fillStyle = rad(ctx, 'wand-glow', 0, 0, 0.02, 0, 0, 0.42, [[0, 'rgba(255,246,184,0.85)'], [1, 'rgba(255,246,184,0)']]);
  ctx.beginPath();
  ctx.arc(0, 0, 0.42, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(a + Math.PI / 2 + Math.sin(t * 1.8) * 0.15);
  ctx.beginPath();
  starPath(ctx, 0, 0, 0.27, 0, 0.5);
  ctx.fillStyle = rad(ctx, 'wand-star', -0.06, -0.07, 0.01, 0, 0, 0.27, [[0, '#fffbe0'], [0.25, '#ffd54f'], [0.85, '#ffd54f'], [1, GOLD.dark]]);
  ctx.fill();
  ctx.strokeStyle = GOLD.stroke;
  ctx.lineWidth = lw * 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(-0.05, -0.06, 0.035, 0, TAU);
  ctx.fill();
  ctx.restore();
  const tw = Math.max(0, Math.sin(t * 3.1 + 1));
  twinkle(ctx, sx + 0.24, sy - 0.24, 0.1 * tw * dim, '#fffbe0', tw);
}
