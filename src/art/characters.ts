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
  if (extra !== 'none') drawExtraFront(ctx, extra, t, lw, mood);
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

export type PuffStyle =
  | 'dandelion' | 'sparkle' | 'bubble' | 'balloon' | 'cloud' | 'rainbow'
  | 'snowflake' | 'bauble' | 'star' | 'slime' | 'ghost' | 'present';
export const PUFF_STYLES: readonly PuffStyle[] = [
  'dandelion', 'sparkle', 'bubble', 'balloon', 'cloud', 'rainbow',
  'snowflake', 'bauble', 'present', 'star', 'slime', 'ghost',
];

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
/** [fill, outline] colour pairs. */
type Duo = readonly [string, string];
const SNOW_EDGE = '#6f9ad4';
/** Above this urgency, the faces look a little worried. */
const WORRIED = 0.5;
const SNOW_COLS = ['#ffffff', '#9fd0ff', '#d9ecff', '#6f9ad4', '#bfe0ff'] as const;
/** Outline of the snow dots drifting off an urgent snowflake. */
const SNOW_DOT_EDGE = '#5a86c4';
const BAUBLE_COLS: readonly Duo[] = [
  ['#ff6b6b', '#c4434f'], ['#5fcf8a', '#2f9a5c'], ['#6fb6ff', '#3d7fc4'], ['#b48cff', '#7d58c9'],
  ['#ff8fc0', '#cf5f92'], ['#ffcf4a', '#c9971f'], ['#4fd1c5', '#2a9a90'],
];
const BAUBLE_BURST = [...BAUBLE_COLS.map((c) => c[0]), '#ffe9a0', '#ffffff'];
const STAR_COLS = ['#ffd84a', '#fff1a8', '#ffb84a', '#ffffff', '#ffe066'] as const;
const SLIME_COLS: readonly Duo[] = [
  ['#7ee0a8', '#3fa46e'], ['#8fd0ff', '#4f93c9'], ['#ff9ec7', '#cf5f92'], ['#b99cff', '#7d62c9'], ['#ffd45c', '#e0a92a'],
];
const SLIME_BURST = [...SLIME_COLS.map((c) => c[0]), '#ffffff'];
const GHOST_EDGE = '#a99cd6';
const GHOST_COLS = ['#ffffff', '#ece6ff', '#ffd6ec', '#d7ecff', '#f6f2ff'] as const;
type Wrap = { paper: Duo; ribbon: Duo; dots: boolean };
const PRESENT_WRAPS: readonly Wrap[] = [
  { paper: ['#ff7a7a', '#c4525a'], ribbon: ['#ffd45c', '#c99a22'], dots: true },
  { paper: ['#7ee0c3', '#3fa487'], ribbon: ['#ff9ec7', '#cf5f92'], dots: false },
  { paper: ['#8fd0ff', '#4f93c9'], ribbon: ['#ff7a7a', '#c4525a'], dots: true },
  { paper: ['#b99cff', '#7d62c9'], ribbon: ['#ffd45c', '#c99a22'], dots: false },
  { paper: ['#ffd45c', '#c99a22'], ribbon: ['#ff7a7a', '#c4525a'], dots: true },
  { paper: ['#6dcf7a', '#3f9a4f'], ribbon: ['#ff6b6b', '#c4434f'], dots: false },
  { paper: ['#ff9ec7', '#cf5f92'], ribbon: ['#8fd0ff', '#4f93c9'], dots: true },
];
const PRESENT_BURST = ['#ff7a7a', '#ffd45c', '#7ee0c3', '#ff9ec7', '#8fd0ff', '#b99cff', '#ffffff'];

/** A seed's pick out of n variants (always 0..n-1). */
function pick(seed: number, n: number): number {
  return (((seed | 0) % n) + n) % n;
}

/** Sparkle colours for when a puff of this style pops (null = the usual petal colours). */
export function puffBurstColors(style: PuffStyle): readonly string[] | null {
  switch (style) {
    case 'sparkle': return SPARKLE_COLS;
    case 'bubble': return BUBBLE_COLS;
    case 'balloon': return BALLOON_BURST;
    case 'cloud': return CLOUD_COLS;
    case 'rainbow': return RAINBOW;
    case 'snowflake': return SNOW_COLS;
    case 'bauble': return BAUBLE_BURST;
    case 'star': return STAR_COLS;
    case 'slime': return SLIME_BURST;
    case 'ghost': return GHOST_COLS;
    case 'present': return PRESENT_BURST;
    default: return null;
  }
}

const CACHE_SCALE = 2;
type PuffCache = { c: Cvs; half: number; r: number };
const puffCache = new Map<string, PuffCache>();

/** Head sprites for each style, as cached layers. */
type Layer = 'dandelion' | 'rainbow' | 'bubble-sheen' | 'bubble-hi' | 'balloon' | 'cloud'
  | 'snow-glow' | 'snowflake' | 'bauble' | 'star-glow' | 'star' | 'star-worried' | 'slime' | 'slime-worried'
  | 'ghost' | 'ghost-worried' | 'ghost-arm' | 'present-box' | 'present-lid';

/** How many seeded looks a layer has (limited so the cache stays small). */
function layerVariety(layer: Layer): number {
  switch (layer) {
    case 'dandelion': return 64;
    case 'rainbow': return 16;
    case 'balloon': return BALLOON_COLS.length;
    case 'snowflake': return SNOW_VARIANTS.length;
    case 'bauble': return BAUBLE_COLS.length * 2;
    case 'slime': case 'slime-worried': return SLIME_COLS.length;
    case 'present-box': case 'present-lid': return PRESENT_WRAPS.length;
    default: return 1;
  }
}

function getPuffCache(seed: number, radius: number, layer: Layer = 'dandelion'): PuffCache {
  const bucket = Math.max(12, Math.round(radius / 6) * 6);
  const sd = pick(seed, layerVariety(layer));
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
    case 'snow-glow': renderSnowGlow(g, bucket); break;
    case 'snowflake': renderSnowflake(g, bucket, SNOW_VARIANTS[sd]); break;
    case 'bauble': renderBauble(g, bucket, BAUBLE_COLS[sd % BAUBLE_COLS.length], Math.floor(sd / BAUBLE_COLS.length)); break;
    case 'star-glow': renderStarGlow(g, bucket); break;
    case 'star': renderStar(g, bucket, false); break;
    case 'star-worried': renderStar(g, bucket, true); break;
    case 'slime': renderSlime(g, bucket, SLIME_COLS[sd], false); break;
    case 'slime-worried': renderSlime(g, bucket, SLIME_COLS[sd], true); break;
    case 'ghost': renderGhost(g, bucket, false); break;
    case 'ghost-worried': renderGhost(g, bucket, true); break;
    case 'ghost-arm': renderGhostArm(g, bucket, 1); break;
    case 'present-box': renderPresentBox(g, bucket, PRESENT_WRAPS[sd]); break;
    case 'present-lid': renderPresentLid(g, bucket, PRESENT_WRAPS[sd]); break;
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

/** A '#rrggbb' colour with some alpha. */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** How a cute face's mouth looks: a smile, a happy open mouth, or a little worried 'o' (with raised brows). */
type Mouth = 'smile' | 'open' | 'o';
/** A soft round face: shiny eyes, rosy cheeks and a mouth. */
function drawCuteFace(g: Ctx, r: number, cx: number, cy: number, spread: number, scale: number, mouth: Mouth, cheek = 'rgba(255,143,166,0.55)'): void {
  const s = r * scale;
  g.fillStyle = cheek;
  g.beginPath();
  g.ellipse(cx - spread * 1.75, cy + s * 0.2, s * 0.13, s * 0.08, 0, 0, TAU);
  g.ellipse(cx + spread * 1.75, cy + s * 0.2, s * 0.13, s * 0.08, 0, 0, TAU);
  g.fill();
  g.fillStyle = INK;
  g.beginPath();
  g.ellipse(cx - spread, cy, s * 0.09, s * 0.115, 0, 0, TAU);
  g.ellipse(cx + spread, cy, s * 0.09, s * 0.115, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (const ex of [cx - spread, cx + spread]) {
    g.moveTo(ex - s * 0.025 + s * 0.04, cy - s * 0.04);
    g.arc(ex - s * 0.025, cy - s * 0.04, s * 0.04, 0, TAU);
    g.moveTo(ex + s * 0.035 + s * 0.018, cy + s * 0.045);
    g.arc(ex + s * 0.035, cy + s * 0.045, s * 0.018, 0, TAU);
  }
  g.fill();
  const my = cy + s * 0.13;
  if (mouth === 'o') {
    // worried, not scared: brows lifted in the middle and a small round mouth
    g.strokeStyle = INK;
    g.lineCap = 'round';
    g.lineWidth = Math.max(1, s * 0.035);
    g.beginPath();
    for (const side of [-1, 1]) {
      const ex = cx + side * spread;
      g.moveTo(ex + side * s * 0.1, cy - s * 0.17);
      g.quadraticCurveTo(ex, cy - s * 0.22, ex - side * s * 0.07, cy - s * 0.25);
    }
    g.stroke();
    g.fillStyle = '#7a3b5a';
    g.beginPath();
    g.ellipse(cx, my + s * 0.03, s * 0.05, s * 0.06, 0, 0, TAU);
    g.fill();
    return;
  }
  if (mouth === 'open') {
    g.fillStyle = '#7a3b5a';
    g.beginPath();
    g.moveTo(cx - s * 0.11, my);
    g.quadraticCurveTo(cx, my + s * 0.02, cx + s * 0.11, my);
    g.quadraticCurveTo(cx + s * 0.1, my + s * 0.16, cx, my + s * 0.16);
    g.quadraticCurveTo(cx - s * 0.1, my + s * 0.16, cx - s * 0.11, my);
    g.fill();
    g.fillStyle = '#ff8fa6';
    g.beginPath();
    g.ellipse(cx, my + s * 0.12, s * 0.055, s * 0.035, 0, 0, TAU);
    g.fill();
  } else {
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1.1, s * 0.04);
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx, my - s * 0.04, s * 0.09, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
  }
}

// ---- snowflake: a slowly turning crystal over a soft glow
type SnowVariant = { br: readonly (readonly [number, number])[]; ring: number; tip: 0 | 1 | 2 };
/** Branches as [where along the arm, length]; an optional hexagon ring; arm tips (0 plain, 1 dot, 2 diamond). */
const SNOW_VARIANTS: readonly SnowVariant[] = [
  { br: [[0.42, 0.3], [0.68, 0.2]], ring: 0, tip: 1 },
  { br: [[0.55, 0.32]], ring: 0.32, tip: 2 },
  { br: [[0.36, 0.2], [0.58, 0.26], [0.8, 0.14]], ring: 0, tip: 0 },
  { br: [[0.62, 0.28]], ring: 0.4, tip: 1 },
];
function renderSnowGlow(g: Ctx, r: number): void {
  const gl = g.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.2);
  gl.addColorStop(0, 'rgba(240,250,255,0.85)');
  gl.addColorStop(0.45, 'rgba(214,236,255,0.5)');
  gl.addColorStop(1, 'rgba(214,236,255,0)');
  g.fillStyle = gl;
  g.beginPath();
  g.arc(0, 0, r * 1.2, 0, TAU);
  g.fill();
}
function renderSnowflake(g: Ctx, r: number, v: SnowVariant): void {
  const R = r * 0.94;
  const w = Math.max(1.8, r * 0.11);
  const ow = Math.max(1, r * 0.035);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const armAngle = (k: number) => (k * TAU) / 6 - Math.PI / 2;
  const arms = () => {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = armAngle(k);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      g.moveTo(0, 0);
      g.lineTo(ca * R * (v.tip === 2 ? 0.86 : 1), sa * R * (v.tip === 2 ? 0.86 : 1));
      for (const [p, l] of v.br) {
        for (const s of [-1, 1]) {
          const ba = a + s * 0.95;
          g.moveTo(ca * R * p, sa * R * p);
          g.lineTo(ca * R * p + Math.cos(ba) * R * l, sa * R * p + Math.sin(ba) * R * l);
        }
      }
    }
    if (v.ring) {
      for (let k = 0; k <= 6; k++) {
        const a = armAngle(k) + Math.PI / 6;
        const rr = R * v.ring * 0.9;
        if (k === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
  };
  const tips = () => {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = armAngle(k);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      if (v.tip === 1) {
        g.moveTo(ca * R + w * 0.95, sa * R);
        g.arc(ca * R, sa * R, w * 0.95, 0, TAU);
      } else if (v.tip === 2) {
        const m = R * 0.9;
        g.moveTo(ca * R * 0.74, sa * R * 0.74);
        g.lineTo(ca * m - sa * w * 1.3, sa * m + ca * w * 1.3);
        g.lineTo(ca * R * 1.04, sa * R * 1.04);
        g.lineTo(ca * m + sa * w * 1.3, sa * m - ca * w * 1.3);
        g.closePath();
      }
    }
  };
  // outline pass, then the frosty fill, then a bright core line
  arms();
  g.strokeStyle = SNOW_EDGE;
  g.lineWidth = w + ow * 2;
  g.stroke();
  if (v.tip) {
    tips();
    g.lineWidth = ow * 2;
    g.stroke();
  }
  arms();
  g.strokeStyle = '#e3f3ff';
  g.lineWidth = w;
  g.stroke();
  if (v.tip) {
    tips();
    g.fillStyle = '#e3f3ff';
    g.fill();
  }
  arms();
  g.strokeStyle = '#ffffff';
  g.lineWidth = w * 0.38;
  g.stroke();
  // hexagon hub
  const hr = R * 0.24;
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = armAngle(k);
    if (k === 0) g.moveTo(Math.cos(a) * hr, Math.sin(a) * hr);
    else g.lineTo(Math.cos(a) * hr, Math.sin(a) * hr);
  }
  g.closePath();
  const hub = g.createRadialGradient(-hr * 0.3, -hr * 0.3, hr * 0.1, 0, 0, hr);
  hub.addColorStop(0, '#ffffff');
  hub.addColorStop(1, '#cfe6ff');
  g.fillStyle = hub;
  g.fill();
  g.strokeStyle = SNOW_EDGE;
  g.lineWidth = ow * 1.4;
  g.stroke();
  // a little six-point star in the middle
  g.strokeStyle = '#a9c8ee';
  g.lineWidth = Math.max(0.8, ow);
  g.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = armAngle(k);
    g.moveTo(Math.cos(a) * hr * 0.55, Math.sin(a) * hr * 0.55);
    g.lineTo(-Math.cos(a) * hr * 0.55, -Math.sin(a) * hr * 0.55);
  }
  g.stroke();
}

// ---- Christmas bauble
function renderBauble(g: Ctx, r: number, col: Duo, pattern: number): void {
  const [fill, edge] = col;
  const cy = r * 0.1;
  const R = r * 0.84;
  const lw = Math.max(1.4, r * 0.045);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // hanging loop and gold cap
  const cw = r * 0.34;
  const ch = r * 0.2;
  const ctop = cy - R - ch * 0.5;
  g.strokeStyle = '#c9971f';
  g.lineWidth = Math.max(1.2, r * 0.05);
  g.beginPath();
  g.ellipse(0, ctop - r * 0.08, r * 0.09, r * 0.1, 0, 0, TAU);
  g.stroke();
  // sphere
  g.beginPath();
  g.arc(0, cy, R, 0, TAU);
  const body = g.createRadialGradient(-R * 0.32, cy - R * 0.38, R * 0.05, 0, cy, R * 1.02);
  body.addColorStop(0, mixHex(fill, '#ffffff', 0.65));
  body.addColorStop(0.3, mixHex(fill, '#ffffff', 0.12));
  body.addColorStop(0.75, fill);
  body.addColorStop(1, mixHex(fill, edge, 0.75));
  g.fillStyle = body;
  g.fill();
  // painted band, curving round the ball
  g.save();
  g.beginPath();
  g.arc(0, cy, R, 0, TAU);
  g.clip();
  const gold = fill === '#ffcf4a';
  // the gold bauble has a white band, so its pattern uses the darker gold to stand out
  const patCol = gold ? edge : fill;
  const bandCol = gold ? '#ffffff' : '#ffe08a';
  const bandEdge = gold ? '#e0c690' : '#d9a92e';
  const by = cy - R * 0.08;
  const h = R * 0.15;
  const ry = R * 0.3;
  g.beginPath();
  g.ellipse(0, by - h, R * 1.02, ry, 0, Math.PI, 0, true);
  g.lineTo(R * 1.02, by + h);
  g.ellipse(0, by + h, R * 1.02, ry, 0, 0, Math.PI, false);
  g.closePath();
  g.fillStyle = bandCol;
  g.fill();
  g.strokeStyle = bandEdge;
  g.lineWidth = Math.max(0.8, r * 0.025);
  g.stroke();
  const onBand = (th: number, dy: number): [number, number] => [Math.cos(th) * R, by + dy + Math.sin(th) * ry];
  if (pattern === 0) {
    // dots in the bauble's own colour
    g.fillStyle = patCol;
    g.beginPath();
    for (let i = 1; i < 8; i++) {
      const th = Math.PI - (i / 8) * Math.PI;
      const [px, py] = onBand(th, 0);
      const rr = h * 0.55 * (0.55 + 0.45 * Math.sin(th));
      g.moveTo(px + rr, py);
      g.arc(px, py, rr, 0, TAU);
    }
    g.fill();
  } else {
    // a zigzag
    g.strokeStyle = patCol;
    g.lineWidth = Math.max(1, r * 0.04);
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const th = Math.PI - (i / 12) * Math.PI;
      const [px, py] = onBand(th, (i % 2 ? 1 : -1) * h * 0.55);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
  // shade the edges so it reads as round
  const sh = g.createRadialGradient(-R * 0.25, cy - R * 0.3, R * 0.3, 0, cy, R);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.7, 'rgba(60,30,80,0)');
  sh.addColorStop(1, 'rgba(60,30,80,0.22)');
  g.fillStyle = sh;
  g.fillRect(-R, cy - R, R * 2, R * 2);
  g.restore();
  g.beginPath();
  g.arc(0, cy, R, 0, TAU);
  g.strokeStyle = edge;
  g.lineWidth = lw;
  g.stroke();
  // shine
  g.save();
  g.translate(-R * 0.4, cy - R * 0.42);
  g.rotate(0.75);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(0, 0, R * 0.12, R * 0.24, 0, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.arc(-R * 0.66, cy - R * 0.02, R * 0.05, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = R * 0.06;
  g.beginPath();
  g.arc(0, cy, R * 0.8, 0.25, 1.05);
  g.stroke();
  // cap on top
  const capG = g.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  capG.addColorStop(0, '#c9971f');
  capG.addColorStop(0.35, '#fff1a8');
  capG.addColorStop(0.7, '#e7b53a');
  capG.addColorStop(1, '#b8862a');
  g.fillStyle = capG;
  g.beginPath();
  g.roundRect(-cw / 2, ctop, cw, ch, r * 0.04);
  g.fill();
  g.strokeStyle = '#9c6f1c';
  g.lineWidth = Math.max(1, r * 0.03);
  g.stroke();
  g.strokeStyle = 'rgba(156,111,28,0.55)';
  g.beginPath();
  for (const fx of [-0.25, 0, 0.25]) {
    g.moveTo(cw * fx, ctop + ch * 0.25);
    g.lineTo(cw * fx, ctop + ch * 0.8);
  }
  g.stroke();
}

// ---- wishing star
const STAR_CY = 0.1;
function starPath(g: Ctx, r: number, scale = 1): void {
  const cy = r * STAR_CY;
  const ro = r * 1.09 * scale;
  const ri = r * 0.61 * scale;
  const cr = r * 0.22 * scale;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? ri : ro;
    pts.push([Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  g.beginPath();
  g.moveTo((pts[9][0] + pts[0][0]) / 2, (pts[9][1] + pts[0][1]) / 2);
  for (let i = 0; i < 10; i++) {
    const p = pts[i];
    const n = pts[(i + 1) % 10];
    g.arcTo(p[0], p[1], (p[0] + n[0]) / 2, (p[1] + n[1]) / 2, i % 2 ? cr * 0.7 : cr);
  }
  g.closePath();
}
function renderStarGlow(g: Ctx, r: number): void {
  const cy = r * STAR_CY;
  const gl = g.createRadialGradient(0, cy, r * 0.2, 0, cy, r * 1.15);
  gl.addColorStop(0, 'rgba(255,236,140,0.75)');
  gl.addColorStop(0.5, 'rgba(255,224,110,0.4)');
  gl.addColorStop(1, 'rgba(255,224,110,0)');
  g.fillStyle = gl;
  g.beginPath();
  g.arc(0, cy, r * 1.15, 0, TAU);
  g.fill();
}
function renderStar(g: Ctx, r: number, worried: boolean): void {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  starPath(g, r);
  const body = g.createRadialGradient(-r * 0.25, -r * 0.26, r * 0.05, 0, r * STAR_CY, r * 1.12);
  body.addColorStop(0, '#fff8c8');
  body.addColorStop(0.45, '#ffdc4e');
  body.addColorStop(1, '#f7a928');
  g.fillStyle = body;
  g.fill();
  g.strokeStyle = '#d48a1c';
  g.lineWidth = Math.max(1.6, r * 0.06);
  g.stroke();
  // soft inner bevel
  starPath(g, r, 0.8);
  g.strokeStyle = 'rgba(255,250,220,0.6)';
  g.lineWidth = Math.max(1, r * 0.04);
  g.stroke();
  // shine on the upper-left arm
  g.save();
  g.translate(-r * 0.33, -r * 0.2);
  g.rotate(-0.6);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(0, 0, r * 0.075, r * 0.18, 0, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(-r * 0.04, -r * 0.62, r * 0.05, 0, TAU);
  g.fill();
  drawCuteFace(g, r, 0, r * 0.16, r * 0.2, 1, worried ? 'o' : 'smile');
}

// ---- jelly slime
const SLIME_BASE = 0.74;
function slimePath(g: Ctx, r: number): void {
  const b = r * SLIME_BASE;
  g.beginPath();
  g.moveTo(-r * 0.92, r * 0.5);
  g.bezierCurveTo(-r * 0.98, -r * 0.22, -r * 0.6, -r * 0.8, 0, -r * 0.8);
  g.bezierCurveTo(r * 0.6, -r * 0.8, r * 0.98, -r * 0.22, r * 0.92, r * 0.5);
  // gooey feet that spread out a little, and a soft dip between them
  g.quadraticCurveTo(r * 0.93, r * 0.65, r * 0.99, r * 0.68);
  g.quadraticCurveTo(r * 1.05, b, r * 0.88, b);
  g.quadraticCurveTo(r * 0.45, b + r * 0.02, 0, b - r * 0.03);
  g.quadraticCurveTo(-r * 0.45, b + r * 0.02, -r * 0.88, b);
  g.quadraticCurveTo(-r * 1.05, b, -r * 0.99, r * 0.68);
  g.quadraticCurveTo(-r * 0.93, r * 0.65, -r * 0.92, r * 0.5);
  g.closePath();
}
function renderSlime(g: Ctx, r: number, col: Duo, worried: boolean): void {
  const [fill, edge] = col;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  slimePath(g, r);
  const body = g.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.05, 0, 0, r * 1.05);
  body.addColorStop(0, rgba(mixHex(fill, '#ffffff', 0.6), 0.93));
  body.addColorStop(0.5, rgba(fill, 0.9));
  body.addColorStop(1, rgba(mixHex(fill, edge, 0.28), 0.93));
  g.fillStyle = body;
  g.fill();
  g.save();
  g.clip();
  // a lighter glow in the jelly's belly, and a few tiny bubbles inside
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.beginPath();
  g.ellipse(0, r * 0.62, r * 0.6, r * 0.16, 0, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  for (const [bx, by, br] of [[0.55, 0.38, 0.06], [0.66, 0.2, 0.035], [-0.6, 0.42, 0.045], [0.42, -0.42, 0.03]]) {
    g.moveTo((bx + br) * r, by * r);
    g.arc(bx * r, by * r, br * r, 0, TAU);
  }
  g.fill();
  g.restore();
  slimePath(g, r);
  g.strokeStyle = edge;
  g.lineWidth = Math.max(1.4, r * 0.05);
  g.stroke();
  // shine: a big curved gleam and a dot
  g.save();
  g.translate(-r * 0.46, -r * 0.4);
  g.rotate(0.85);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(0, 0, r * 0.09, r * 0.22, 0, 0, TAU);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.arc(-r * 0.12, -r * 0.62, r * 0.05, 0, TAU);
  g.fill();
  // cheeks a little lighter and stronger, so they stay pink on any jelly colour
  drawCuteFace(g, r, 0, r * 0.06, r * 0.27, 1.1, worried ? 'o' : 'open', 'rgba(255,170,195,0.85)');
  if (worried) {
    // a little sweat drop by its head
    g.save();
    g.translate(r * 0.6, -r * 0.42);
    g.rotate(0.35);
    g.beginPath();
    g.moveTo(0, -r * 0.13);
    g.bezierCurveTo(r * 0.03, -r * 0.06, r * 0.08, -r * 0.01, r * 0.08, r * 0.04);
    g.arc(0, r * 0.04, r * 0.08, 0, Math.PI);
    g.bezierCurveTo(-r * 0.08, -r * 0.01, -r * 0.03, -r * 0.06, 0, -r * 0.13);
    g.closePath();
    g.fillStyle = '#dff3ff';
    g.fill();
    g.strokeStyle = '#6fb0e6';
    g.lineWidth = Math.max(1, r * 0.03);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(-r * 0.025, r * 0.03, r * 0.022, 0, TAU);
    g.fill();
    g.restore();
  }
}

// ---- friendly ghost
function ghostPath(g: Ctx, r: number): void {
  const top = -r * 0.95;
  const hy = r * 0.64;
  const amp = r * 0.09;
  const xL = -r * 0.8;
  const xR = r * 0.8;
  g.beginPath();
  g.moveTo(xL, hy + amp);
  g.bezierCurveTo(-r * 0.86, r * 0.05, -r * 0.84, top, 0, top);
  g.bezierCurveTo(r * 0.84, top, r * 0.86, r * 0.05, xR, hy + amp);
  const n = 6;
  const step = (xR - xL) / n;
  let px = xR;
  let py = hy + amp;
  for (let i = 1; i <= n; i++) {
    const nx = xR - step * i;
    const ny = i % 2 ? hy - amp : hy + amp;
    g.bezierCurveTo(px - step * 0.5, py, nx + step * 0.5, ny, nx, ny);
    px = nx;
    py = ny;
  }
  g.closePath();
}
/** Where the ghost's right arm joins the sheet (it waves about this point). */
const GHOST_SHOULDER: readonly [number, number] = [0.66, 0.08];
/** A little mitten arm poking out, down and outward from the sheet (side -1 left, 1 right). */
function renderGhostArm(g: Ctx, r: number, side: number): void {
  const lw = Math.max(1.4, r * 0.05);
  const w = r * 0.22;
  const [sx, sy] = GHOST_SHOULDER;
  const x0 = side * sx * r;
  const y0 = sy * r;
  const x1 = side * r * 0.98;
  const y1 = r * 0.3;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [col, width] of [[GHOST_EDGE, w + lw * 2], ['#fbf9ff', w]] as const) {
    g.strokeStyle = col;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  // a soft shadow under the mitten
  g.strokeStyle = 'rgba(169,156,214,0.35)';
  g.lineWidth = Math.max(1, r * 0.04);
  g.beginPath();
  g.arc(x1, y1, w * 0.32, side > 0 ? 0.1 : Math.PI * 0.45, side > 0 ? Math.PI * 0.55 : Math.PI * 0.9);
  g.stroke();
}
function renderGhost(g: Ctx, r: number, worried: boolean): void {
  const lw = Math.max(1.4, r * 0.05);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // the left arm is baked in; the right one waves on its own layer
  renderGhostArm(g, r, -1);
  ghostPath(g, r);
  const body = g.createLinearGradient(0, -r * 0.95, 0, r * 0.75);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.6, '#f8f5ff');
  body.addColorStop(1, '#e6e0fa');
  g.fillStyle = body;
  g.fill();
  g.save();
  g.clip();
  // soft lilac shade down the right side
  const sh = g.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.3, -r * 0.1, -r * 0.1, r * 1.2);
  sh.addColorStop(0, 'rgba(200,190,240,0)');
  sh.addColorStop(0.7, 'rgba(200,190,240,0)');
  sh.addColorStop(1, 'rgba(180,168,230,0.4)');
  g.fillStyle = sh;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  ghostPath(g, r);
  g.strokeStyle = GHOST_EDGE;
  g.lineWidth = lw;
  g.stroke();
  // shine on the top of the head
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.ellipse(-r * 0.38, -r * 0.6, r * 0.1, r * 0.06, -0.7, 0, TAU);
  g.fill();
  drawCuteFace(g, r, 0, -r * 0.2, r * 0.25, 1.05, worried ? 'o' : 'smile');
}

// ---- wrapped present: the box and the lid (with its bow) are separate so the lid can hop
const BOX_TOP = -0.26;
const BOX_BOTTOM = 0.8;
const LID_TOP = -0.5;
const LID_BOTTOM = -0.22;
function paperFill(g: Ctx, r: number, w: Wrap, x0: number, x1: number): void {
  const [paper, edge] = w.paper;
  const pg = g.createLinearGradient(x0, 0, x1, 0);
  pg.addColorStop(0, mixHex(paper, '#ffffff', 0.25));
  pg.addColorStop(0.55, paper);
  pg.addColorStop(1, mixHex(paper, edge, 0.45));
  g.fillStyle = pg;
  g.fill();
  // pattern (clipped to the current path)
  g.save();
  g.clip();
  const pc = mixHex(paper, '#ffffff', 0.55);
  if (w.dots) {
    g.fillStyle = pc;
    g.beginPath();
    const sp = r * 0.3;
    for (let row = 0, yy = -r; yy < r; row++, yy += sp * 0.8) {
      for (let xx = -r + (row % 2) * sp * 0.5; xx < r; xx += sp) {
        g.moveTo(xx + r * 0.055, yy);
        g.arc(xx, yy, r * 0.055, 0, TAU);
      }
    }
    g.fill();
  } else {
    g.strokeStyle = pc;
    g.lineWidth = r * 0.08;
    g.beginPath();
    for (let xx = -r * 2; xx < r * 2; xx += r * 0.28) {
      g.moveTo(xx, -r);
      g.lineTo(xx + r * 2, r);
    }
    g.stroke();
  }
  g.restore();
}
function ribbonFill(g: Ctx, w: Wrap, x0: number, x1: number): void {
  const [rib, edge] = w.ribbon;
  const rg = g.createLinearGradient(x0, 0, x1, 0);
  rg.addColorStop(0, mixHex(rib, edge, 0.3));
  rg.addColorStop(0.4, mixHex(rib, '#ffffff', 0.35));
  rg.addColorStop(1, mixHex(rib, edge, 0.4));
  g.fillStyle = rg;
  g.fill();
  g.strokeStyle = edge;
  g.stroke();
}
function renderPresentBox(g: Ctx, r: number, w: Wrap): void {
  const lw = Math.max(1.3, r * 0.045);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const x0 = -r * 0.66;
  const y0 = r * BOX_TOP;
  const y1 = r * BOX_BOTTOM;
  g.beginPath();
  g.roundRect(x0, y0, -x0 * 2, y1 - y0, r * 0.07);
  paperFill(g, r, w, x0, -x0);
  // ribbon down the front
  const rw = r * 0.2;
  g.lineWidth = Math.max(0.8, r * 0.025);
  g.beginPath();
  g.rect(-rw / 2, y0, rw, y1 - y0);
  ribbonFill(g, w, -rw / 2, rw / 2);
  // shadow under the lid
  g.fillStyle = 'rgba(70,30,70,0.16)';
  g.fillRect(x0 + lw / 2, y0, -x0 * 2 - lw, r * 0.1);
  g.beginPath();
  g.roundRect(x0, y0, -x0 * 2, y1 - y0, r * 0.07);
  g.strokeStyle = w.paper[1];
  g.lineWidth = lw;
  g.stroke();
}
function renderPresentLid(g: Ctx, r: number, w: Wrap): void {
  const lw = Math.max(1.3, r * 0.045);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const [rib, ribEdge] = w.ribbon;
  const ky = r * (LID_TOP - 0.02);
  // bow loops, sitting on top of the lid
  g.lineWidth = Math.max(1.1, r * 0.035);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, ky);
    g.bezierCurveTo(s * r * 0.18, -r * 0.82, s * r * 0.62, -r * 1.02, s * r * 0.58, -r * 0.7);
    g.bezierCurveTo(s * r * 0.56, -r * 0.5, s * r * 0.22, -r * 0.5, 0, ky);
    g.closePath();
    ribbonFill(g, w, s * r * 0.6, 0);
    // fold inside the loop
    g.strokeStyle = rgba(ribEdge, 0.7);
    g.beginPath();
    g.moveTo(s * r * 0.1, ky - r * 0.04);
    g.quadraticCurveTo(s * r * 0.32, -r * 0.72, s * r * 0.46, -r * 0.72);
    g.stroke();
  }
  // lid
  const x0 = -r * 0.76;
  const y0 = r * LID_TOP;
  const y1 = r * LID_BOTTOM;
  g.beginPath();
  g.roundRect(x0, y0, -x0 * 2, y1 - y0, r * 0.06);
  paperFill(g, r, w, x0, -x0);
  g.beginPath();
  g.roundRect(x0, y0, -x0 * 2, y1 - y0, r * 0.06);
  g.strokeStyle = w.paper[1];
  g.lineWidth = lw;
  g.stroke();
  // light along the lid's top edge
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = Math.max(1, r * 0.03);
  g.beginPath();
  g.moveTo(x0 + r * 0.08, y0 + r * 0.05);
  g.lineTo(-x0 - r * 0.08, y0 + r * 0.05);
  g.stroke();
  // ribbon over the lid
  const rw = r * 0.22;
  g.lineWidth = Math.max(0.8, r * 0.025);
  g.beginPath();
  g.rect(-rw / 2, y0, rw, y1 - y0);
  ribbonFill(g, w, -rw / 2, rw / 2);
  // ribbon tails and the knot
  g.lineWidth = Math.max(1.1, r * 0.035);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.04, ky);
    g.quadraticCurveTo(s * r * 0.2, -r * 0.36, s * r * 0.24, -r * 0.2);
    g.lineTo(s * r * 0.15, -r * 0.24);
    g.lineTo(s * r * 0.1, -r * 0.16);
    g.quadraticCurveTo(s * r * 0.1, -r * 0.36, -s * r * 0.04, ky);
    g.closePath();
    ribbonFill(g, w, s * r * 0.24, 0);
  }
  g.beginPath();
  g.ellipse(0, ky, r * 0.12, r * 0.1, 0, 0, TAU);
  const kg = g.createRadialGradient(-r * 0.04, ky - r * 0.04, r * 0.01, 0, ky, r * 0.12);
  kg.addColorStop(0, mixHex(rib, '#ffffff', 0.5));
  kg.addColorStop(1, rib);
  g.fillStyle = kg;
  g.fill();
  g.strokeStyle = ribEdge;
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
      const col = PETALS[BALLOON_COLS[pick(seed, BALLOON_COLS.length)]].fill;
      drawDriftingSparkles(ctx, x, y, r, t, seed, urg, col);
    }
    return;
  }

  if (style === 'snowflake') {
    const glow = getPuffCache(0, r, 'snow-glow');
    const flake = getPuffCache(seed, r, 'snowflake');
    ctx.save();
    ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(t * 2.1 + ph);
    drawHeadImage(ctx, glow, r, breathe, breathe);
    ctx.restore();
    // slowly turning, one way or the other
    ctx.rotate((pick(seed, 2) ? 1 : -1) * t * 0.3 + ph + wob);
    ctx.save();
    drawHeadImage(ctx, flake, r, breathe, breathe);
    ctx.restore();
    // a twinkle hopping from tip to tip
    const tw = t * 0.8 + ph;
    const k = Math.floor(tw);
    const a = (pick(k, 6) * TAU) / 6 - Math.PI / 2;
    const s = Math.sin((tw - k) * Math.PI);
    drawSparkle(ctx, Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, r * 0.42 * s, t * 2, '#ffffff', s);
    ctx.restore();
    if (urg > 0.15) drawDriftingDots(ctx, x, y, r, t, seed, urg, '#ffffff', SNOW_DOT_EDGE, true);
    return;
  }

  if (style === 'bauble') {
    const cache = getPuffCache(seed, r, 'bauble');
    // swings from its loop like a pendulum
    const swing = Math.sin(t * 1.6 + ph) * 0.09 + sway * 0.4 + wob;
    ctx.translate(0, -r);
    ctx.rotate(swing);
    ctx.translate(0, r);
    ctx.save();
    drawHeadImage(ctx, cache, r, breathe, breathe);
    ctx.restore();
    // now and then a glint at the top end of the shine
    const gp = (t * 0.6 + ph) % 2;
    if (gp < 0.6) {
      const s = Math.sin((gp / 0.6) * Math.PI);
      drawSparkle(ctx, -r * 0.22, -r * 0.44, r * 0.32 * s, t, '#ffffff', s);
    }
    ctx.restore();
    if (urg > 0.15) drawDriftingSparkles(ctx, x, y, r, t, seed, urg, BAUBLE_COLS[pick(seed, BAUBLE_COLS.length)][0], 1.25, 0.33, 1);
    return;
  }

  if (style === 'star') {
    const glow = getPuffCache(0, r, 'star-glow');
    const star = getPuffCache(0, r, urg > WORRIED ? 'star-worried' : 'star');
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + ph);
    ctx.save();
    ctx.globalAlpha *= 0.55 + 0.45 * pulse;
    drawHeadImage(ctx, glow, r, 1 + 0.08 * pulse, 1 + 0.08 * pulse);
    ctx.restore();
    ctx.rotate(Math.sin(t * 1.4 + ph) * 0.1 + wob);
    ctx.save();
    const sc = breathe * (1 + 0.03 * pulse);
    drawHeadImage(ctx, star, r, sc, sc);
    ctx.restore();
    // two twinkles by the top points
    for (let i = 0; i < 2; i++) {
      const a = -Math.PI / 2 + (i ? 0.9 : -1.6);
      const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 2.5 + ph);
      drawSparkle(ctx, Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.18, r * (0.18 + 0.2 * tw), t + i, i ? '#ffffff' : '#fff1a8', tw);
    }
    ctx.restore();
    if (urg > 0.15) drawDriftingSparkles(ctx, x, y, r, t, seed, urg, '#ffd84a', 1.25, 0.33, 1);
    return;
  }

  if (style === 'slime') {
    const cache = getPuffCache(seed, r, urg > WORRIED ? 'slime-worried' : 'slime');
    // squash and stretch, sitting on its flat bottom
    const sq = Math.sin(t * 2.6 + ph) * 0.06 + wob * 0.5 + (urg > 0.15 ? Math.sin(t * 9 + ph) * 0.04 * urg : 0);
    const base = r * SLIME_BASE;
    ctx.rotate(sway * 0.3);
    ctx.translate(0, base);
    ctx.scale(breathe * (1 + sq), breathe * (1 - sq));
    ctx.translate(0, -base);
    drawHeadImage(ctx, cache, r, 1, 1);
    ctx.restore();
    if (urg > 0.15) {
      const [fill, edge] = SLIME_COLS[pick(seed, SLIME_COLS.length)];
      drawDriftingDots(ctx, x, y, r, t, seed, urg, mixHex(fill, '#ffffff', 0.45), edge, true);
    }
    return;
  }

  if (style === 'ghost') {
    const body = getPuffCache(0, r, urg > WORRIED ? 'ghost-worried' : 'ghost');
    const arm = getPuffCache(0, r, 'ghost-arm');
    // bobs, and the hem swishes from side to side while one arm waves along
    const swish = Math.sin(t * 1.5 + ph);
    const bob = Math.sin(t * 2.2 + ph) * r * 0.05;
    const lean = swish * 0.1 + wob;
    ctx.translate(0, bob - r * 0.9);
    ctx.transform(1, 0, lean, 1, 0, 0);
    ctx.translate(0, r * 0.9);
    ctx.scale(breathe, breathe);
    const [sx, sy] = GHOST_SHOULDER;
    ctx.save();
    ctx.translate(sx * r, sy * r);
    ctx.rotate(-0.15 - swish * 0.3);
    ctx.translate(-sx * r, -sy * r);
    drawHeadImage(ctx, arm, r, 1, 1);
    ctx.restore();
    drawHeadImage(ctx, body, r, 1, 1);
    ctx.restore();
    if (urg > 0.15) drawDriftingDots(ctx, x, y, r, t, seed, urg, '#ffffff', GHOST_EDGE, false);
    return;
  }

  if (style === 'present') {
    const box = getPuffCache(seed, r, 'present-box');
    const lid = getPuffCache(seed, r, 'present-lid');
    const wrap = PRESENT_WRAPS[pick(seed, PRESENT_WRAPS.length)];
    // every so often the lid hops (more often when about to drift away)
    const hopAt = (period: number) => {
      const hp = (t + ph) % period;
      return hp < 0.5 ? Math.sin((hp / 0.5) * Math.PI) : 0;
    };
    const hop = Math.max(hopAt(3.4), hopAt(1.2) * clamp01((urg - 0.15) / 0.2));
    const bottom = r * BOX_BOTTOM;
    ctx.translate(0, bottom);
    ctx.rotate(sway * 0.5 + wob);
    ctx.scale(breathe * (1 + hop * 0.04), breathe * (1 - hop * 0.04));
    ctx.translate(0, -bottom);
    ctx.save();
    drawHeadImage(ctx, box, r, 1, 1);
    ctx.restore();
    if (hop > 0.05) drawSparkle(ctx, 0, r * (BOX_TOP - 0.06) - hop * r * 0.1, r * 0.55 * hop, t * 3, '#ffe066', hop);
    const ly = r * (LID_TOP + LID_BOTTOM) / 2;
    ctx.translate(0, ly - hop * r * 0.18);
    ctx.rotate(hop * 0.14 * (pick(seed, 2) ? 1 : -1));
    ctx.translate(0, -ly);
    drawHeadImage(ctx, lid, r, 1, 1);
    ctx.restore();
    if (urg > 0.15) drawDriftingSparkles(ctx, x, y, r, t, seed, urg, wrap.ribbon[0], 1.25, 0.33, 1);
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

/** Little round drops leaving the puff from just outside its outline: rising, or falling (snow, slime) when `fall`. */
function drawDriftingDots(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, seed: number, urg: number, fill: string, stroke: string, fall: boolean): void {
  const n = Math.min(4, Math.ceil(urg * 4));
  const a0 = ctx.globalAlpha;
  ctx.save();
  ctx.lineWidth = Math.max(1, r * 0.025);
  for (let i = 0; i < n; i++) {
    const p = (t * 0.45 + i * 0.29 + seed * 0.13) % 1;
    // from the sides only, so they never cross the face or the word tag below
    const base = fall ? -0.25 - (i >> 1) * 0.3 : 0.35 + (i >> 1) * 0.2;
    const a = i % 2 ? Math.PI - base : base;
    const d = r * (1.25 + p * 0.5);
    const bx = x + Math.cos(a) * d + Math.sin(t * 3 + i) * r * 0.05;
    const by = y + Math.sin(a) * d + (fall ? 1 : -1) * p * r * 0.6;
    const br = r * (0.105 + 0.045 * (i % 2)) * (1 - p * 0.4);
    ctx.globalAlpha = a0 * Math.sin(p * Math.PI) * 0.9;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Sparkles drifting off an urgent puff, starting `from` radii out (squashed by `squash` vertically). */
function drawDriftingSparkles(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, seed: number, urg: number, col: string, from = 0.95, size = 0.22, squash = 0.8): void {
  const n = Math.min(4, Math.ceil(urg * 4));
  for (let i = 0; i < n; i++) {
    const p = ((t * 0.5 + i * 0.31 + seed * 0.17) % 1);
    const a = -0.6 - i * 0.7 + seed;
    const d = r * (from + p * 0.7);
    drawSparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * squash - p * r * 0.5, r * size * (1 - p * 0.4), t * 2 + i, i % 2 ? '#ffffff' : col, Math.sin(p * Math.PI) * 0.9);
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
