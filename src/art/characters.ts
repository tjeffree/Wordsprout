// Procedural characters: Bumble the bee, dandelion puffs, seeds, butterflies, sparkles.
// Pure Canvas 2D. Static parts are cached to offscreen canvases (rendered at 2x).
import { INK, CREAM, PETALS, rng, clamp01, lerp, type PetalColor } from './palette';
import { drawHat, drawExtraBack, drawExtraFront, hatAntennaTips, type HatId, type ExtraId } from './outfits';

export type BeeMood = 'idle' | 'happy' | 'cheer' | 'oops' | 'sleepy';
export interface BeeOpts {
  x: number;
  y: number;
  size: number;
  time: number;
  mood: BeeMood;
  facing: 1 | -1;
  tilt?: number;
  /** Outfit: a hat on Bumble's head (default none). */
  hat?: HatId;
  /** Outfit: an extra such as glasses, a bow tie or a cape (default none). */
  extra?: ExtraId;
}

type Cvs = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): { c: Cvs; g: Ctx } {
  let c: Cvs;
  if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(w, h);
  else {
    const e = document.createElement('canvas');
    e.width = w;
    e.height = h;
    c = e;
  }
  const g = c.getContext('2d') as Ctx;
  return { c, g };
}

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Bumble                                                              */
/* ------------------------------------------------------------------ */

const BEE = {
  light: '#fff3a8',
  fill: '#ffd95e',
  deep: '#f5b93a',
  stroke: '#c58a1f',
  stripe: '#8e5fa8',
  stripeDark: '#6f4789',
  cheek: '#ff8fa6',
};

export function drawBee(ctx: CanvasRenderingContext2D, o: BeeOpts): void {
  const R = o.size / 2;
  const t = o.time;
  const mood = o.mood;
  const bobAmp = mood === 'sleepy' ? 0.025 : mood === 'cheer' ? 0.07 : 0.045;
  const bobSpeed = mood === 'sleepy' ? 1.4 : mood === 'cheer' ? 5 : 2.6;
  const bob = Math.sin(t * bobSpeed) * R * bobAmp * 2;
  const lw = Math.max(0.055, 1.7 / R);

  // blink: closes for 0.16s every ~3.6s
  const bp = (t + 1.3) % 3.6;
  const blink = bp < 0.16 ? Math.sin((bp / 0.16) * Math.PI) : 0;

  ctx.save();
  ctx.translate(o.x, o.y + bob);
  if (o.tilt) ctx.rotate(o.tilt);
  ctx.scale(o.facing, 1);
  ctx.scale(R, R);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const hat = o.hat ?? 'none';
  const extra = o.extra ?? 'none';

  // ---- outfit pieces that go behind everything (cape, scarf tails)
  if (extra !== 'none') {
    drawExtraBack(ctx, extra, t, lw);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  // ---- wings (behind body)
  const flap = mood === 'sleepy' ? Math.sin(t * 9) * 0.12 : Math.sin(t * 52);
  const wingAmp = mood === 'sleepy' ? 0.5 : 1;
  for (let i = 0; i < 2; i++) {
    const back = i === 0;
    ctx.save();
    ctx.translate(back ? -0.28 : -0.05, -0.78);
    const base = back ? -0.75 : -0.35;
    ctx.rotate(base + flap * 0.28 * wingAmp * (back ? 0.9 : 1));
    const shimmer = 0.55 + 0.12 * Math.sin(t * 7 + i * 2);
    const wl = back ? 0.82 : 0.95;
    const wg = ctx.createLinearGradient(0, 0, 0, -wl);
    wg.addColorStop(0, `rgba(255,255,255,${shimmer + 0.15})`);
    wg.addColorStop(0.6, `rgba(214,236,255,${shimmer})`);
    wg.addColorStop(1, `rgba(236,214,255,${shimmer - 0.1})`);
    ctx.fillStyle = wg;
    ctx.strokeStyle = 'rgba(130,160,215,0.85)';
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.ellipse(0, -wl * 0.5, 0.3, wl * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // vein + highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    ctx.moveTo(-0.1, -wl * 0.25);
    ctx.quadraticCurveTo(-0.15, -wl * 0.55, -0.06, -wl * 0.8);
    ctx.stroke();
    ctx.restore();
  }

  // ---- legs (tiny stubs)
  ctx.strokeStyle = BEE.stripeDark;
  ctx.lineWidth = lw * 1.5;
  for (const lx of [-0.25, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(lx, 0.82);
    ctx.lineTo(lx - 0.02, 1.02);
    ctx.stroke();
  }

  // ---- stinger
  ctx.fillStyle = BEE.stripeDark;
  ctx.strokeStyle = BEE.stripeDark;
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.moveTo(-0.93, 0.16);
  ctx.lineTo(-1.2, 0.28);
  ctx.lineTo(-0.9, 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ---- antennae
  const perk = mood === 'cheer' ? 1 : mood === 'sleepy' ? -0.7 : mood === 'oops' ? -0.35 : 0;
  const wob = Math.sin(t * (mood === 'cheer' ? 7 : 2.2)) * 0.06;
  // A big hat would hide the antennae, so they splay out to peek from under it.
  const tips = hatAntennaTips(hat);
  ctx.strokeStyle = BEE.stripeDark;
  ctx.lineWidth = lw * 1.3;
  for (const s of [0, 1]) {
    const bx = 0.18 + s * 0.42;
    const by = -0.82;
    const dir = s === 0 ? 0.2 : 0.55;
    let ex = bx + dir * 0.5 + wob * (s ? 1 : -1) + (mood === 'oops' ? -0.05 : 0);
    let ey = by - 0.45 - perk * 0.2 + (perk < 0 ? 0.25 * -perk : 0);
    let cx = bx + (perk < 0 ? 0.0 : 0.02);
    let cy = by - 0.35 - Math.max(0, perk) * 0.25 + (perk < 0 ? -perk * 0.1 : 0);
    if (tips) {
      const [tx, ty] = tips[s];
      ex = tx + wob * (s ? 1 : -1);
      ey = ty - perk * 0.12;
      cx = bx + (tx - bx) * 0.25;
      cy = ty - 0.12 - Math.max(0, perk) * 0.1;
    }
    ctx.beginPath();
    ctx.moveTo(bx, by + 0.05);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    // bobble
    ctx.fillStyle = '#ffb347';
    ctx.strokeStyle = '#c47a1c';
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.arc(ex, ey, 0.1, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(ex - 0.03, ey - 0.035, 0.03, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = BEE.stripeDark;
    ctx.lineWidth = lw * 1.3;
  }

  // ---- body
  const bodyPath = () => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 1, 0.92, 0, 0, TAU);
  };
  const bg = ctx.createRadialGradient(-0.3, -0.45, 0.05, 0, 0, 1.15);
  bg.addColorStop(0, BEE.light);
  bg.addColorStop(0.45, BEE.fill);
  bg.addColorStop(1, BEE.deep);
  ctx.fillStyle = bg;
  bodyPath();
  ctx.fill();

  // stripes, wrapped around the sphere
  ctx.save();
  bodyPath();
  ctx.clip();
  ctx.fillStyle = BEE.stripe;
  const bands: [number, number][] = [
    [-0.78, 0.27],
    [-0.36, 0.25],
  ];
  for (const [c, w] of bands) {
    ctx.beginPath();
    ctx.moveTo(c - w / 2, -1.1);
    ctx.quadraticCurveTo(c - w / 2 + 0.3, 0, c - w / 2, 1.1);
    ctx.lineTo(c + w / 2, 1.1);
    ctx.quadraticCurveTo(c + w / 2 + 0.3, 0, c + w / 2, -1.1);
    ctx.closePath();
    ctx.fill();
  }
  // soft shading over body edge (bottom-right darker rim)
  const sh = ctx.createRadialGradient(-0.25, -0.35, 0.5, 0, 0, 1.1);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(160,90,40,0.22)');
  ctx.fillStyle = sh;
  ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
  ctx.restore();

  // outline
  ctx.strokeStyle = BEE.stroke;
  ctx.lineWidth = lw * 1.3;
  bodyPath();
  ctx.stroke();

  // fuzz tufts on top of head
  ctx.strokeStyle = BEE.stroke;
  ctx.fillStyle = BEE.light;
  ctx.lineWidth = lw;
  for (const [fx, fr] of [[0.05, 0.1], [0.3, 0.12], [0.55, 0.09]] as const) {
    const fy = -0.92 * Math.sqrt(Math.max(0, 1 - fx * fx));
    ctx.beginPath();
    ctx.moveTo(fx - fr, fy + 0.03);
    ctx.quadraticCurveTo(fx - 0.02, fy - fr * 2.2, fx + fr, fy + 0.03);
    ctx.fill();
    ctx.stroke();
  }

  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-0.38, -0.62, 0.2, 0.1, -0.6, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.12, -0.78, 0.045, 0, TAU);
  ctx.fill();

  // ---- face
  drawBeeFace(ctx, mood, blink, lw, t);

  // ---- outfit pieces in front (glasses, bow tie, lei, scarf), then the hat last
  if (extra !== 'none') drawExtraFront(ctx, extra, t, lw);
  if (hat !== 'none') drawHat(ctx, hat, t, lw);

  ctx.restore();
}

function drawBeeFace(ctx: CanvasRenderingContext2D, mood: BeeMood, blink: number, lw: number, t: number): void {
  const eyeY = -0.08;
  const eyeX = [0.27, 0.8];
  const er = 0.2;
  ctx.lineCap = 'round';

  // cheeks first
  ctx.fillStyle = BEE.cheek;
  ctx.globalAlpha = 0.6;
  for (const [cx, rx] of [[0.1, 0.17], [0.88, 0.15]] as const) {
    ctx.beginPath();
    ctx.ellipse(cx, 0.3, rx, 0.1, 0, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // eyes
  const arc = mood === 'happy' || mood === 'sleepy';
  for (let i = 0; i < 2; i++) {
    const ex = eyeX[i];
    if (mood === 'happy') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw * 2.4;
      ctx.beginPath();
      ctx.arc(ex, eyeY + 0.08, er * 0.8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else if (mood === 'sleepy' || blink > 0.6) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw * 2.4;
      ctx.beginPath();
      ctx.arc(ex, eyeY - 0.05, er * 0.8, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else {
      const sy = 1 - blink * 0.9;
      const small = mood === 'oops' ? 0.88 : 1;
      ctx.save();
      ctx.translate(ex, eyeY);
      ctx.scale(1, sy);
      // white sclera ring not needed: big glossy ink eye
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(0, 0, er * 0.92 * small, er * 1.12 * small, 0, 0, TAU);
      ctx.fill();
      // iris glow
      const ig = ctx.createRadialGradient(0, 0.1, 0.01, 0, 0.1, er);
      ig.addColorStop(0, 'rgba(140,100,190,0.7)');
      ig.addColorStop(1, 'rgba(140,100,190,0)');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(0, 0.04, er * 0.85, er * 0.95, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-0.06 * small, -0.07 * small, 0.075 * small, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0.06 * small, 0.07 * small, 0.035 * small, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  void arc;

  // eyebrows for oops
  if (mood === 'oops') {
    ctx.strokeStyle = BEE.stripeDark;
    ctx.lineWidth = lw * 1.6;
    ctx.beginPath();
    ctx.moveTo(0.1, -0.4);
    ctx.lineTo(0.38, -0.34);
    ctx.moveTo(0.95, -0.4);
    ctx.lineTo(0.7, -0.34);
    ctx.stroke();
  }

  // mouth
  const mx = 0.54;
  const my = 0.32;
  if (mood === 'idle' || mood === 'happy') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 1.7;
    ctx.beginPath();
    if (mood === 'idle') {
      ctx.moveTo(mx - 0.13, my - 0.02);
      ctx.quadraticCurveTo(mx, my + 0.14, mx + 0.13, my - 0.02);
      ctx.stroke();
    } else {
      // big smile (open D shape)
      ctx.beginPath();
      ctx.moveTo(mx - 0.2, my - 0.04);
      ctx.quadraticCurveTo(mx, my + 0.0, mx + 0.2, my - 0.04);
      ctx.quadraticCurveTo(mx + 0.17, my + 0.25, mx, my + 0.26);
      ctx.quadraticCurveTo(mx - 0.17, my + 0.25, mx - 0.2, my - 0.04);
      ctx.closePath();
      ctx.fillStyle = '#b8435f';
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ff8fa0';
      ctx.beginPath();
      ctx.ellipse(mx, my + 0.28, 0.12, 0.1, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  } else if (mood === 'cheer') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 1.7;
    const open = 0.06 * Math.sin(t * 9);
    ctx.beginPath();
    ctx.moveTo(mx - 0.22, my - 0.05);
    ctx.quadraticCurveTo(mx, my + 0.0, mx + 0.22, my - 0.05);
    ctx.quadraticCurveTo(mx + 0.2, my + 0.3 + open, mx, my + 0.32 + open);
    ctx.quadraticCurveTo(mx - 0.2, my + 0.3 + open, mx - 0.22, my - 0.05);
    ctx.closePath();
    ctx.fillStyle = '#b8435f';
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ff8fa0';
    ctx.beginPath();
    ctx.ellipse(mx, my + 0.34 + open, 0.14, 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx - 0.2, my - 0.06, 0.4, 0.07);
    ctx.restore();
  } else if (mood === 'oops') {
    ctx.fillStyle = '#b8435f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 1.5;
    ctx.beginPath();
    ctx.ellipse(mx, my + 0.08, 0.075, 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // sweat drop
    const dy = (t * 0.6) % 1;
    const dyy = -0.5 + dy * 0.12;
    ctx.fillStyle = '#bfe6ff';
    ctx.strokeStyle = '#5b9fd6';
    ctx.lineWidth = lw * 1.2;
    ctx.beginPath();
    ctx.moveTo(1.02, dyy - 0.22);
    ctx.quadraticCurveTo(1.2, dyy + 0.02, 1.02, dyy + 0.1);
    ctx.quadraticCurveTo(0.84, dyy + 0.02, 1.02, dyy - 0.22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(0.97, dyy, 0.03, 0, TAU);
    ctx.fill();
  } else {
    // sleepy: tiny smile + z
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 1.6;
    ctx.beginPath();
    ctx.moveTo(mx - 0.08, my + 0.02);
    ctx.quadraticCurveTo(mx, my + 0.08, mx + 0.08, my + 0.02);
    ctx.stroke();
    // z floats up
    for (let k = 0; k < 2; k++) {
      const p = ((t * 0.35 + k * 0.5) % 1);
      const zs = 0.14 + p * 0.12;
      const zx = 1.0 + p * 0.25;
      const zy = -0.7 - p * 0.55;
      ctx.save();
      ctx.globalAlpha = Math.sin(p * Math.PI);
      ctx.strokeStyle = '#7b8fe0';
      ctx.lineWidth = lw * 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(zx - zs, zy - zs);
      ctx.lineTo(zx + zs, zy - zs);
      ctx.lineTo(zx - zs, zy + zs);
      ctx.lineTo(zx + zs, zy + zs);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Dandelion puff                                                      */
/* ------------------------------------------------------------------ */

export type PuffStyle = 'dandelion' | 'sparkle' | 'bubble' | 'balloon' | 'cloud' | 'rainbow';
export const PUFF_STYLES: readonly PuffStyle[] = ['dandelion', 'sparkle', 'bubble', 'balloon', 'cloud', 'rainbow'];

export interface PuffOpts {
  x: number;
  y: number;
  radius: number;
  time: number;
  seed: number;
  target?: number;
  shake?: number;
  urgency?: number;
  /** What carries the word (default 'dandelion'). */
  style?: PuffStyle;
}

const SPARKLE_COLS = ['#ffd84a', '#ff9ec7', '#ffffff', '#b99cff'] as const;
const BUBBLE_COLS = ['#e8f7ff', '#bfe6ff', '#ffffff', '#d9ccff', '#ffd6ec', '#c8f4e4'] as const;
const BALLOON_COLS: readonly PetalColor[] = ['coral', 'butter', 'lilac', 'pink', 'mint', 'tangerine', 'sky'];
const BALLOON_BURST = BALLOON_COLS.map((c) => PETALS[c].fill);
const CLOUD_COLS = ['#ffffff', '#f4f9ff', '#dcebff', '#cfe6ff', '#fff8ec'] as const;
/** Soft pastel rainbow, red to violet. */
const RAINBOW = ['#ff8a8a', '#ffb36b', '#ffe066', '#8fe08a', '#7cc8ff', '#a99cff', '#e59cf0'] as const;
const RAINBOW_SOFT = RAINBOW.map((c) => mixHex(c, '#ffffff', 0.3));

/** Sparkle colours for when a puff of this style pops (null = the usual petal colours). */
export function puffBurstColors(style: PuffStyle): readonly string[] | null {
  switch (style) {
    case 'sparkle': return SPARKLE_COLS;
    case 'bubble': return BUBBLE_COLS;
    case 'balloon': return BALLOON_BURST;
    case 'cloud': return CLOUD_COLS;
    case 'rainbow': return RAINBOW;
    default: return null;
  }
}

const CACHE_SCALE = 2;
type PuffCache = { c: Cvs; half: number; r: number };
const puffCache = new Map<string, PuffCache>();

/** Head sprites for each style, as cached layers. */
type Layer = 'dandelion' | 'rainbow' | 'bubble-sheen' | 'bubble-hi' | 'balloon' | 'cloud';

function getPuffCache(seed: number, radius: number, layer: Layer = 'dandelion'): PuffCache {
  const bucket = Math.max(12, Math.round(radius / 6) * 6);
  // limit variety so the cache stays small
  const sd =
    layer === 'dandelion' ? (seed | 0) % 64
      : layer === 'rainbow' ? (seed | 0) % 16
        : layer === 'balloon' ? (seed | 0) % BALLOON_COLS.length
          : 0;
  const key = layer === 'dandelion' ? sd + ':' + bucket : layer + ':' + sd + ':' + bucket;
  let e = puffCache.get(key);
  if (e) return e;
  const half = Math.ceil(bucket * 1.25);
  const px = half * 2 * CACHE_SCALE;
  const { c, g } = makeCanvas(px, px);
  g.scale(CACHE_SCALE, CACHE_SCALE);
  g.translate(half, half);
  switch (layer) {
    case 'dandelion': renderPuff(g, bucket, sd, false); break;
    case 'rainbow': renderPuff(g, bucket, sd, true); break;
    case 'bubble-sheen': renderBubbleSheen(g, bucket); break;
    case 'bubble-hi': renderBubbleHighlight(g, bucket); break;
    case 'balloon': renderBalloon(g, bucket, BALLOON_COLS[sd]); break;
    case 'cloud': renderCloud(g, bucket); break;
  }
  e = { c, half, r: bucket };
  puffCache.set(key, e);
  if (puffCache.size > 160) {
    const first = puffCache.keys().next().value;
    if (first !== undefined) puffCache.delete(first);
  }
  return e;
}

const FIL = '#d8c9b0';
const FIL_LIGHT = '#fffdf6';

function renderPuff(g: Ctx, r: number, seed: number, rainbow: boolean): void {
  const rand = rng(seed * 7919 + 13);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  if (rainbow) {
    // faint rainbow halo
    g.lineWidth = r * 0.035;
    for (let i = 0; i < RAINBOW.length; i++) {
      g.strokeStyle = RAINBOW[i];
      g.globalAlpha = 0.32;
      g.beginPath();
      g.arc(0, 0, r * (1.15 - i * 0.032), 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // soft cream haze so the sphere reads as a mass
  const haze = g.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
  haze.addColorStop(0, 'rgba(255,250,236,1)');
  haze.addColorStop(0.75, 'rgba(255,252,244,0.85)');
  haze.addColorStop(0.93, 'rgba(255,255,255,0.45)');
  haze.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = haze;
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();

  const n = Math.round(Math.min(96, 34 + r * 0.9));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const inner = r * 0.16;
  type F = { a: number; len: number; bend: number };
  const fs: F[] = [];
  for (let i = 0; i < n; i++) {
    // Fibonacci-ish spread in 2D for even coverage with jitter
    const a = i * golden + (rand() - 0.5) * 0.15;
    const len = r * (i % 3 === 0 ? 0.52 + rand() * 0.16 : 0.84 + rand() * 0.16);
    fs.push({ a, len, bend: (rand() - 0.5) * 0.12 });
  }
  // rainbow: tint by angle, in soft bands round the clock
  const band = (a: number) => {
    const u = (((a + Math.PI / 2) % TAU) + TAU) % TAU / TAU;
    return RAINBOW_SOFT[Math.min(RAINBOW.length - 1, Math.floor(u * RAINBOW.length))];
  };
  // filaments
  g.lineWidth = Math.max(0.7, r * 0.018);
  g.strokeStyle = FIL;
  for (const f of fs) {
    const ca = Math.cos(f.a);
    const sa = Math.sin(f.a);
    const ex = ca * f.len;
    const ey = sa * f.len;
    if (rainbow) g.strokeStyle = band(f.a);
    g.beginPath();
    g.moveTo(ca * inner, sa * inner);
    g.quadraticCurveTo(
      ca * f.len * 0.55 - sa * f.len * f.bend,
      sa * f.len * 0.55 + ca * f.len * f.bend,
      ex,
      ey,
    );
    g.stroke();
  }
  // tufts (parachutes) at tips: small starbursts
  const tlBase = Math.max(3.4, r * 0.2);
  fs.sort((a, b) => a.len - b.len);
  for (const f of fs) {
    const tl = tlBase * (f.len < r * 0.8 ? 0.8 : 1);
    const ca = Math.cos(f.a);
    const sa = Math.sin(f.a);
    const ex = ca * f.len;
    const ey = sa * f.len;
    const rays = 7;
    const col = rainbow ? band(f.a) : FIL;
    g.lineWidth = Math.max(0.6, r * 0.014) * (rainbow ? 1.5 : 1);
    g.strokeStyle = col;
    g.fillStyle = FIL_LIGHT;
    g.beginPath();
    for (let k = 0; k < rays; k++) {
      const ra = f.a + ((k - (rays - 1) / 2) / (rays - 1)) * 2.5;
      g.moveTo(ex, ey);
      g.lineTo(ex + Math.cos(ra) * tl, ey + Math.sin(ra) * tl);
    }
    g.stroke();
    // white wisp overlay to soften
    g.strokeStyle = rainbow ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.9)';
    g.lineWidth = Math.max(0.5, r * 0.008);
    g.beginPath();
    for (let k = 0; k < rays; k++) {
      const ra = f.a + ((k - (rays - 1) / 2) / (rays - 1)) * 2.5;
      g.moveTo(ex, ey);
      g.lineTo(ex + Math.cos(ra) * tl * 0.92, ey + Math.sin(ra) * tl * 0.92);
    }
    g.stroke();
    g.beginPath();
    g.arc(ex, ey, Math.max(0.9, r * 0.022), 0, TAU);
    g.fillStyle = '#fff';
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = Math.max(0.5, r * 0.01);
    g.stroke();
  }

  // receptacle core
  const cr = r * 0.17;
  const cg = g.createRadialGradient(-cr * 0.3, -cr * 0.3, cr * 0.1, 0, 0, cr);
  cg.addColorStop(0, '#b9a66c');
  cg.addColorStop(1, '#8a7a45');
  g.fillStyle = cg;
  g.strokeStyle = '#6b5d34';
  g.lineWidth = Math.max(1, r * 0.025);
  g.beginPath();
  g.arc(0, 0, cr, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(-cr * 0.35, -cr * 0.4, cr * 0.3, cr * 0.18, -0.6, 0, TAU);
  g.fill();
}

// ---- soap bubble: a rotating iridescent sheen layer + a fixed highlight layer
function renderBubbleSheen(g: Ctx, r: number): void {
  const body = g.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.1, 0, 0, r);
  body.addColorStop(0, 'rgba(255,255,255,0.05)');
  body.addColorStop(0.62, 'rgba(225,242,255,0.12)');
  body.addColorStop(0.88, 'rgba(205,230,255,0.32)');
  body.addColorStop(1, 'rgba(255,255,255,0.55)');
  g.fillStyle = body;
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();
  // iridescent film: soft overlapping colour arcs round the rim
  const film = ['#ff9ec7', '#ffd45c', '#7ee0c3', '#8fd0ff', '#b99cff', '#ff9ec7'];
  g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = r * (pass ? 0.07 : 0.2);
    g.globalAlpha = pass ? 0.4 : 0.16;
    for (let i = 0; i < film.length - 1; i++) {
      const a0 = (i / (film.length - 1)) * TAU;
      g.strokeStyle = film[i];
      g.beginPath();
      g.arc(0, 0, r * (pass ? 0.9 : 0.84), a0, a0 + TAU / (film.length - 1) * 0.92);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  // swirl of colour inside the film
  g.lineWidth = r * 0.05;
  g.globalAlpha = 0.22;
  g.strokeStyle = '#b99cff';
  g.beginPath();
  g.ellipse(r * 0.1, r * 0.15, r * 0.62, r * 0.4, 0.5, 0.2, 2.2);
  g.stroke();
  g.strokeStyle = '#7ee0c3';
  g.beginPath();
  g.ellipse(-r * 0.05, r * 0.05, r * 0.7, r * 0.5, -0.4, 3.4, 4.9);
  g.stroke();
  g.globalAlpha = 1;
}

function renderBubbleHighlight(g: Ctx, r: number): void {
  // thin rim
  g.strokeStyle = 'rgba(120,160,215,0.55)';
  g.lineWidth = Math.max(1, r * 0.025);
  g.beginPath();
  g.arc(0, 0, r * 0.985, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = Math.max(0.8, r * 0.018);
  g.beginPath();
  g.arc(0, 0, r * 0.95, 0, TAU);
  g.stroke();
  // bright window highlight, curved like the bubble
  const a0 = -2.55;
  const a1 = -1.75;
  const ri = r * 0.56;
  const ro = r * 0.8;
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.beginPath();
  g.arc(0, 0, ro, a0, a1);
  g.arc(0, 0, ri, a1, a0, true);
  g.closePath();
  g.fill();
  // window bars
  g.strokeStyle = 'rgba(200,225,255,0.9)';
  g.lineWidth = Math.max(0.8, r * 0.03);
  g.beginPath();
  const am = (a0 + a1) / 2;
  g.moveTo(Math.cos(am) * ri, Math.sin(am) * ri);
  g.lineTo(Math.cos(am) * ro, Math.sin(am) * ro);
  g.arc(0, 0, (ri + ro) / 2, a0, a1);
  g.stroke();
  // little glint and a lower reflection
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(Math.cos(-1.45) * r * 0.66, Math.sin(-1.45) * r * 0.66, r * 0.06, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = r * 0.06;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(0, 0, r * 0.8, 0.35, 1.15);
  g.stroke();
}

// ---- party balloon
const BALLOON_KNOT_Y = 0.9;
function balloonPath(g: Ctx, r: number): void {
  g.beginPath();
  g.moveTo(0, -r);
  g.bezierCurveTo(r * 0.56, -r, r * 0.9, -r * 0.6, r * 0.88, -r * 0.12);
  g.bezierCurveTo(r * 0.86, r * 0.36, r * 0.44, r * 0.8, 0, r * 0.86);
  g.bezierCurveTo(-r * 0.44, r * 0.8, -r * 0.86, r * 0.36, -r * 0.88, -r * 0.12);
  g.bezierCurveTo(-r * 0.9, -r * 0.6, -r * 0.56, -r, 0, -r);
  g.closePath();
}
function renderBalloon(g: Ctx, r: number, colour: PetalColor): void {
  const c = PETALS[colour];
  g.lineCap = 'round';
  g.lineJoin = 'round';
  balloonPath(g, r);
  const body = g.createRadialGradient(-r * 0.32, -r * 0.42, r * 0.05, 0, 0, r * 1.05);
  body.addColorStop(0, mixHex(c.fill, '#ffffff', 0.6));
  body.addColorStop(0.35, c.fill);
  body.addColorStop(1, mixHex(c.fill, c.stroke, 0.7));
  g.fillStyle = body;
  g.fill();
  g.strokeStyle = c.stroke;
  g.lineWidth = Math.max(1.4, r * 0.045);
  g.stroke();
  // knot
  g.fillStyle = mixHex(c.fill, c.stroke, 0.5);
  g.beginPath();
  g.moveTo(-r * 0.05, r * 0.85);
  g.lineTo(-r * 0.1, r * (BALLOON_KNOT_Y + 0.07));
  g.quadraticCurveTo(0, r * (BALLOON_KNOT_Y + 0.03), r * 0.1, r * (BALLOON_KNOT_Y + 0.07));
  g.lineTo(r * 0.05, r * 0.85);
  g.closePath();
  g.fill();
  g.lineWidth = Math.max(1, r * 0.03);
  g.stroke();
  // shine
  g.save();
  g.translate(-r * 0.4, -r * 0.42);
  g.rotate(0.55);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(0, 0, r * 0.12, r * 0.25, 0, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.arc(-r * 0.12, -r * 0.74, r * 0.055, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = r * 0.05;
  g.beginPath();
  g.arc(0, 0, r * 0.7, 0.2, 0.95);
  g.stroke();
}

// ---- sleepy cloud
const CLOUD_BUMPS: readonly (readonly [number, number, number])[] = [
  [-0.6, 0.12, 0.36],
  [-0.3, -0.24, 0.42],
  [0.16, -0.36, 0.48],
  [0.6, -0.02, 0.38],
  [0.32, 0.22, 0.4],
  [-0.22, 0.24, 0.4],
];
function cloudPath(g: Ctx, r: number): void {
  g.beginPath();
  for (const [x, y, s] of CLOUD_BUMPS) {
    g.moveTo((x + s) * r, y * r);
    g.arc(x * r, y * r, s * r, 0, TAU);
  }
}
function renderCloud(g: Ctx, r: number): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  cloudPath(g, r);
  g.strokeStyle = '#9fb6dc';
  g.lineWidth = Math.max(2.4, r * 0.09);
  g.stroke();
  const body = g.createLinearGradient(0, -r * 0.8, 0, r * 0.65);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.55, '#f6faff');
  body.addColorStop(1, '#d6e6fb');
  g.fillStyle = body;
  g.fill();
  // soft highlights on the top bumps
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.ellipse(-0.36 * r, -0.4 * r, 0.16 * r, 0.08 * r, -0.5, 0, TAU);
  g.ellipse(0.06 * r, -0.6 * r, 0.14 * r, 0.07 * r, -0.2, 0, TAU);
  g.fill();
  // shading crease lines between bumps
  g.strokeStyle = 'rgba(159,182,220,0.55)';
  g.lineWidth = Math.max(1, r * 0.03);
  g.beginPath();
  g.arc(0.6 * r, -0.02 * r, 0.3 * r, 2.3, 3.0);
  g.stroke();
  // face: closed happy eyes, rosy cheeks, little smile
  const ey = 0.04 * r;
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1.4, r * 0.05);
  g.beginPath();
  for (const ex of [-0.24, 0.24]) {
    g.moveTo(ex * r + r * 0.1 * Math.cos(0.15 * Math.PI), ey + r * 0.1 * Math.sin(0.15 * Math.PI) - r * 0.05);
    g.arc(ex * r, ey - r * 0.05, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  g.stroke();
  g.fillStyle = 'rgba(255,143,166,0.55)';
  g.beginPath();
  g.ellipse(-0.42 * r, 0.2 * r, 0.11 * r, 0.065 * r, 0, 0, TAU);
  g.ellipse(0.42 * r, 0.2 * r, 0.11 * r, 0.065 * r, 0, 0, TAU);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = Math.max(1.2, r * 0.04);
  g.beginPath();
  g.arc(0, 0.17 * r, 0.08 * r, 0.2 * Math.PI, 0.8 * Math.PI);
  g.stroke();
}

function mixHex(a: string, b: string, t: number): string {
  const A = parseInt(a.slice(1), 16);
  const B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

function drawHeadImage(ctx: CanvasRenderingContext2D, cache: PuffCache, r: number, sx: number, sy: number): void {
  const s = r / cache.r;
  ctx.scale(s * sx, s * sy);
  ctx.drawImage(cache.c as CanvasImageSource, -cache.half, -cache.half, cache.half * 2, cache.half * 2);
}

export function drawPuff(ctx: CanvasRenderingContext2D, o: PuffOpts): void {
  const { x, y, radius: r, time: t, seed } = o;
  const style = o.style ?? 'dandelion';
  const target = o.target ?? 0;
  const shake = o.shake ?? 0;
  const urg = o.urgency ?? 0;
  const ph = seed * 1.37;

  const sway = Math.sin(t * 1.1 + ph) * (0.05 + urg * 0.05) + Math.sin(t * 2.7 + ph) * 0.015 * urg;
  const wob = shake > 0 ? Math.sin(t * 48) * shake * 0.16 : 0;
  const breathe = 1 + Math.sin(t * 1.7 + ph) * 0.025;
  const shakeX = shake > 0 ? Math.sin(t * 61) * shake * r * 0.07 : 0;
  // a gentle nervous quiver when about to drift away (non-dandelion styles)
  const quiver = urg > 0.15 && style !== 'dandelion' && style !== 'sparkle' && style !== 'rainbow'
    ? Math.sin(t * 23 + ph) * r * 0.025 * urg : 0;

  ctx.save();
  ctx.translate(x + shakeX + quiver, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // golden target glow
  if (target > 0.01) {
    const gr = r * (1.45 + 0.05 * Math.sin(t * 4));
    const gg = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, gr);
    gg.addColorStop(0, `rgba(255,222,110,${0.05 * target})`);
    gg.addColorStop(0.6, `rgba(255,214,90,${0.5 * target})`);
    gg.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(0, 0, gr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,205,70,${0.75 * target})`;
    ctx.lineWidth = Math.max(2, r * 0.045);
    ctx.setLineDash([r * 0.18, r * 0.12]);
    ctx.lineDashOffset = -t * r * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (style === 'dandelion' || style === 'sparkle' || style === 'rainbow') {
    // stalk (sways below the head)
    const sl = r * 1.0;
    const sx = Math.sin(t * 1.1 + ph + 0.6) * r * 0.1 + sway * r * 0.6;
    const sTop = r * 0.8;
    ctx.strokeStyle = '#4a8a37';
    ctx.lineWidth = Math.max(2.5, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, sTop);
    ctx.quadraticCurveTo(r * 0.12 + sx * 0.4, sTop + sl * 0.55, sx + r * 0.16, r + sl * 0.9);
    ctx.stroke();
    ctx.strokeStyle = '#7fcb5e';
    ctx.lineWidth = Math.max(1.4, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, sTop);
    ctx.quadraticCurveTo(r * 0.12 + sx * 0.4, sTop + sl * 0.55, sx + r * 0.16, r + sl * 0.9);
    ctx.stroke();

    // little green sepal collar at base of head
    ctx.fillStyle = '#7fcb5e';
    ctx.strokeStyle = '#4a8a37';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, r * 0.88, r * 0.14, r * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();

    // head
    const cache = getPuffCache(seed, r, style === 'rainbow' ? 'rainbow' : 'dandelion');
    ctx.rotate(sway + wob);
    drawHeadImage(ctx, cache, r, breathe, breathe);
    ctx.restore();

    if (style === 'sparkle') {
      // twinkling sparkles orbiting the head
      for (let i = 0; i < 4; i++) {
        const a = t * 0.7 + ph + (i / 4) * TAU;
        const tw = 0.5 + 0.5 * Math.sin(t * 4.2 + i * 1.9);
        const d = r * (1.08 + 0.06 * Math.sin(t * 1.3 + i));
        drawSparkle(ctx, x + shakeX + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, r * (0.26 + 0.16 * tw), t * 1.5 + i, SPARKLE_COLS[i], 0.6 + 0.4 * tw);
      }
    }
    // loosening seeds when urgent
    if (urg > 0.15) drawLooseSeeds(ctx, x, y, r, t, seed, urg);
    return;
  }

  if (style === 'bubble') {
    const w = Math.sin(t * 2.3 + ph) * 0.035 + wob * 0.2;
    const sheen = getPuffCache(0, r, 'bubble-sheen');
    const hi = getPuffCache(0, r, 'bubble-hi');
    ctx.rotate(wob * 0.5);
    ctx.save();
    ctx.scale(breathe * (1 + w), breathe * (1 - w));
    ctx.save();
    ctx.rotate(t * 0.35 + ph);
    drawHeadImage(ctx, sheen, r, 1, 1);
    ctx.restore();
    drawHeadImage(ctx, hi, r, 1, 1);
    ctx.restore();
    ctx.restore();
    if (urg > 0.15) {
      // tiny bubbles drifting off
      const n = Math.min(5, Math.ceil(urg * 5));
      ctx.save();
      ctx.lineWidth = Math.max(1, r * 0.025);
      for (let i = 0; i < n; i++) {
        const p = ((t * 0.45 + i * 0.37 + seed * 0.13) % 1);
        const a = -0.4 - i * 0.55 + seed;
        const d = r * (0.95 + p * 0.8);
        const br = r * (0.09 + 0.04 * ((i * 7) % 3)) * (1 - p * 0.4);
        const bx = x + Math.cos(a) * d + Math.sin(t * 3 + i) * r * 0.05;
        const by = y + Math.sin(a) * d * 0.7 - p * r * 0.6;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
        ctx.fillStyle = 'rgba(220,240,255,0.35)';
        ctx.strokeStyle = 'rgba(120,160,215,0.7)';
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.25, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    return;
  }

  if (style === 'balloon') {
    const cache = getPuffCache(seed, r, 'balloon');
    const rot = sway * 0.8 + wob;
    const sc = breathe;
    // string from the knot, waving down towards the word tag
    const kx = -Math.sin(rot) * r * (BALLOON_KNOT_Y + 0.05) * sc;
    const ky = Math.cos(rot) * r * (BALLOON_KNOT_Y + 0.05) * sc;
    const endY = r * 1.95;
    const wv = Math.sin(t * 2.6 + ph) * r * 0.1;
    ctx.strokeStyle = 'rgba(122,96,140,0.8)';
    ctx.lineWidth = Math.max(1.2, r * 0.03);
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.bezierCurveTo(kx + wv + r * 0.12, ky + (endY - ky) * 0.35, -wv - r * 0.12, ky + (endY - ky) * 0.65, 0, endY);
    ctx.stroke();
    ctx.rotate(rot);
    drawHeadImage(ctx, cache, r, sc, sc * (1 + Math.sin(t * 1.7 + ph + 1) * 0.01));
    ctx.restore();
    if (urg > 0.15) {
      const col = PETALS[BALLOON_COLS[(seed | 0) % BALLOON_COLS.length]].fill;
      drawDriftingSparkles(ctx, x, y, r, t, seed, urg, col);
    }
    return;
  }

  // cloud
  const cache = getPuffCache(0, r, 'cloud');
  ctx.rotate(sway * 0.5 + wob);
  drawHeadImage(ctx, cache, r, breathe * (1 + Math.sin(t * 1.2 + ph) * 0.02), breathe);
  ctx.restore();
  if (urg > 0.15) {
    // wisps of cloud drifting away
    const n = Math.min(4, Math.ceil(urg * 4));
    ctx.save();
    for (let i = 0; i < n; i++) {
      const p = ((t * 0.35 + i * 0.29 + seed * 0.11) % 1);
      const dir = i % 2 ? 1 : -1;
      const wx = x + dir * r * (0.9 + p * 0.8);
      const wy = y + r * (-0.1 + 0.25 * ((i * 5) % 3) - p * 0.4);
      const ws = r * 0.13 * (1 - p * 0.3);
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(159,182,220,0.8)';
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.arc(wx - ws * 0.6, wy, ws * 0.75, 0, TAU);
      ctx.moveTo(wx + ws * 1.6, wy);
      ctx.arc(wx + ws * 0.6, wy, ws, 0, TAU);
      ctx.stroke();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawLooseSeeds(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, seed: number, urg: number): void {
  const n = Math.min(6, Math.ceil(urg * 6));
  for (let i = 0; i < n; i++) {
    const cyc = 3.2 - urg * 1.4;
    const p = ((t + i * 0.77 + seed) % cyc) / cyc;
    const a = i * 2.4 + seed;
    const dist = r * (0.85 + p * 0.9);
    const px = x + Math.cos(a) * dist + Math.sin(t * 3 + i) * r * 0.06 * p;
    const py = y + Math.sin(a) * dist * 0.8 - p * r * 0.5;
    drawSeed(ctx, px, py, Math.max(8, r * 0.28), a + Math.PI / 2 + Math.sin(t * 2 + i) * 0.4, Math.sin(p * Math.PI) * 0.9);
  }
}

function drawDriftingSparkles(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, seed: number, urg: number, col: string): void {
  const n = Math.min(4, Math.ceil(urg * 4));
  for (let i = 0; i < n; i++) {
    const p = ((t * 0.5 + i * 0.31 + seed * 0.17) % 1);
    const a = -0.6 - i * 0.7 + seed;
    const d = r * (0.95 + p * 0.7);
    drawSparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - p * r * 0.5, r * 0.22 * (1 - p * 0.4), t * 2 + i, i % 2 ? '#ffffff' : col, Math.sin(p * Math.PI) * 0.9);
  }
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

let seedSprite: Cvs | null = null;
const SEED_PX = 96; // sprite height in cache px (width same)

function getSeedSprite(): Cvs {
  if (seedSprite) return seedSprite;
  const { c, g } = makeCanvas(SEED_PX, SEED_PX);
  // design in unit space: height 1 mapped to SEED_PX, origin center
  g.translate(SEED_PX / 2, SEED_PX / 2);
  g.scale(SEED_PX, SEED_PX);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const u = 1 / SEED_PX;
  // beak stem from achene (bottom) to pappus (top)
  const topY = -0.2;
  const botY = 0.2;
  g.strokeStyle = '#b3a07e';
  g.lineWidth = u * 2;
  g.beginPath();
  g.moveTo(0, botY);
  g.lineTo(0, topY);
  g.stroke();
  // pappus umbrella: arc of filaments
  const tipY = topY;
  g.lineWidth = u * 1.5;
  g.strokeStyle = '#b3a07e';
  g.beginPath();
  const rays = 11;
  for (let k = 0; k < rays; k++) {
    const a = -Math.PI / 2 + ((k - (rays - 1) / 2) / (rays - 1)) * 2.7;
    g.moveTo(0, tipY);
    g.lineTo(Math.cos(a) * 0.36, tipY + Math.sin(a) * 0.3);
  }
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = u * 0.9;
  g.beginPath();
  for (let k = 0; k < rays; k++) {
    const a = -Math.PI / 2 + ((k - (rays - 1) / 2) / (rays - 1)) * 2.7;
    g.moveTo(0, tipY);
    g.lineTo(Math.cos(a) * 0.34, tipY + Math.sin(a) * 0.25);
  }
  g.stroke();
  g.fillStyle = '#fff';
  g.strokeStyle = '#b3a07e';
  g.lineWidth = u * 1.1;
  for (let k = 0; k < rays; k++) {
    const a = -Math.PI / 2 + ((k - (rays - 1) / 2) / (rays - 1)) * 2.7;
    g.beginPath();
    g.arc(Math.cos(a) * 0.36, tipY + Math.sin(a) * 0.27, u * 1.8, 0, TAU);
    g.fill();
  }
  // achene (seed body)
  g.fillStyle = '#b79b6a';
  g.strokeStyle = '#7d6638';
  g.lineWidth = u * 1.8;
  g.beginPath();
  g.ellipse(0, botY + 0.05, 0.05, 0.1, 0, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.beginPath();
  g.ellipse(-0.015, botY + 0.02, 0.012, 0.035, 0, 0, TAU);
  g.fill();
  seedSprite = c;
  return c;
}

export function drawSeed(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha: number,
): void {
  if (alpha <= 0.003) return;
  const s = getSeedSprite();
  const d = size / 0.7; // sprite box is ~0.7 of the box tall in content (top -0.47..bottom 0.35)
  ctx.save();
  ctx.globalAlpha *= clamp01(alpha);
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.drawImage(s as CanvasImageSource, -d / 2, -d / 2 - size * 0.06, d, d);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Butterfly                                                           */
/* ------------------------------------------------------------------ */

const BFLY_COLORS: PetalColor[] = ['coral', 'butter', 'lilac', 'pink', 'mint', 'tangerine', 'sky'];

export interface ButterflyOpts {
  x: number;
  y: number;
  size: number;
  time: number;
  seed: number;
  facing: 1 | -1;
}

export function drawButterfly(ctx: CanvasRenderingContext2D, o: ButterflyOpts): void {
  const rand = rng(Math.floor(o.seed * 1000) + 5);
  const col = PETALS[BFLY_COLORS[Math.floor(rand() * BFLY_COLORS.length)]];
  const col2 = PETALS[BFLY_COLORS[Math.floor(rand() * BFLY_COLORS.length)]];
  const t = o.time;
  const R = o.size / 2;
  const speed = 7 + rand() * 2;
  const flap = Math.abs(Math.sin(t * speed + o.seed * 3));
  const wx = 0.22 + 0.78 * flap;
  const bob = Math.sin(t * speed * 0.5 + o.seed) * R * 0.08;
  const lw = Math.max(0.05, 1.5 / R);

  ctx.save();
  ctx.translate(o.x, o.y + bob);
  ctx.scale(o.facing * R, R);
  ctx.rotate(-0.15 + Math.sin(t * 1.3 + o.seed) * 0.08);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(wx, 1);
    // hind wing
    ctx.beginPath();
    ctx.moveTo(0, 0.05);
    ctx.bezierCurveTo(side * 0.5, 0.0, side * 0.95, 0.35, side * 0.55, 0.75);
    ctx.bezierCurveTo(side * 0.3, 0.9, side * 0.08, 0.55, 0, 0.12);
    ctx.closePath();
    ctx.fillStyle = col2.fill;
    ctx.strokeStyle = col2.stroke;
    ctx.lineWidth = lw * 1.2 / wx;
    ctx.fill();
    ctx.stroke();
    // fore wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(side * 0.35, -0.75, side * 1.1, -0.95, side * 1.0, -0.35);
    ctx.bezierCurveTo(side * 0.95, 0.05, side * 0.35, 0.25, 0, 0.05);
    ctx.closePath();
    ctx.fillStyle = col.fill;
    ctx.strokeStyle = col.stroke;
    ctx.fill();
    ctx.stroke();
    // spots
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(side * 0.72, -0.42, 0.11, 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(side * 0.5, -0.22, 0.06, 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(side * 0.42, 0.5, 0.08, 0.07, 0, 0, TAU);
    ctx.fill();
    // highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = lw * 1.4 / wx;
    ctx.beginPath();
    ctx.moveTo(side * 0.35, -0.5);
    ctx.quadraticCurveTo(side * 0.6, -0.7, side * 0.88, -0.65);
    ctx.stroke();
    ctx.restore();
  }

  // body
  ctx.fillStyle = '#7a5a8e';
  ctx.strokeStyle = '#4f3763';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(0, 0.12, 0.09, 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // head
  ctx.beginPath();
  ctx.arc(0, -0.42, 0.1, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // antennae
  ctx.strokeStyle = '#4f3763';
  ctx.lineWidth = lw;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.03, -0.5);
    ctx.quadraticCurveTo(s * 0.12, -0.75, s * 0.26, -0.78);
    ctx.stroke();
    ctx.fillStyle = '#4f3763';
    ctx.beginPath();
    ctx.arc(s * 0.26, -0.78, 0.04, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Sparkle                                                             */
/* ------------------------------------------------------------------ */

export function drawSparkle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  color: string,
  alpha: number,
): void {
  if (alpha <= 0.003 || size <= 0.2) return;
  const r = size / 2;
  ctx.save();
  ctx.globalAlpha *= clamp01(alpha);
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const k = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(k, -k, r, 0);
  ctx.quadraticCurveTo(k, k, 0, r);
  ctx.quadraticCurveTo(-k, k, -r, 0);
  ctx.quadraticCurveTo(-k, -k, 0, -r);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = Math.max(0.6, r * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// keep imports used
void CREAM;
void lerp;
