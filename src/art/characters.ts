// Procedural characters: Bumble the bee, dandelion puffs, seeds, butterflies, sparkles.
// Pure Canvas 2D. Static parts are cached to offscreen canvases (rendered at 2x).
import { INK, CREAM, PETALS, rng, clamp01, lerp, type PetalColor } from './palette';

export type BeeMood = 'idle' | 'happy' | 'cheer' | 'oops' | 'sleepy';
export interface BeeOpts {
  x: number;
  y: number;
  size: number;
  time: number;
  mood: BeeMood;
  facing: 1 | -1;
  tilt?: number;
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
  ctx.strokeStyle = BEE.stripeDark;
  ctx.lineWidth = lw * 1.3;
  for (const s of [0, 1]) {
    const bx = 0.18 + s * 0.42;
    const by = -0.82;
    const dir = s === 0 ? 0.2 : 0.55;
    const ex = bx + dir * 0.5 + wob * (s ? 1 : -1) + (mood === 'oops' ? -0.05 : 0);
    const ey = by - 0.45 - perk * 0.2 + (perk < 0 ? 0.25 * -perk : 0);
    const cx = bx + (perk < 0 ? 0.0 : 0.02);
    const cy = by - 0.35 - Math.max(0, perk) * 0.25 + (perk < 0 ? -perk * 0.1 : 0);
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

export interface PuffOpts {
  x: number;
  y: number;
  radius: number;
  time: number;
  seed: number;
  target?: number;
  shake?: number;
  urgency?: number;
}

const CACHE_SCALE = 2;
const puffCache = new Map<string, { c: Cvs; half: number; r: number }>();

function getPuffCache(seed: number, radius: number) {
  const bucket = Math.max(12, Math.round(radius / 6) * 6);
  const sd = (seed | 0) % 64; // limit variety so cache stays small
  const key = sd + ':' + bucket;
  let e = puffCache.get(key);
  if (e) return e;
  const half = Math.ceil(bucket * 1.25);
  const px = half * 2 * CACHE_SCALE;
  const { c, g } = makeCanvas(px, px);
  g.scale(CACHE_SCALE, CACHE_SCALE);
  g.translate(half, half);
  renderPuff(g, bucket, sd);
  e = { c, half, r: bucket };
  puffCache.set(key, e);
  if (puffCache.size > 120) {
    const first = puffCache.keys().next().value;
    if (first !== undefined) puffCache.delete(first);
  }
  return e;
}

const FIL = '#d8c9b0';
const FIL_LIGHT = '#fffdf6';

function renderPuff(g: Ctx, r: number, seed: number): void {
  const rand = rng(seed * 7919 + 13);
  g.lineCap = 'round';
  g.lineJoin = 'round';

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
  // filaments
  g.lineWidth = Math.max(0.7, r * 0.018);
  g.strokeStyle = FIL;
  for (const f of fs) {
    const ca = Math.cos(f.a);
    const sa = Math.sin(f.a);
    const ex = ca * f.len;
    const ey = sa * f.len;
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
    g.lineWidth = Math.max(0.6, r * 0.014);
    g.strokeStyle = FIL;
    g.fillStyle = FIL_LIGHT;
    g.beginPath();
    for (let k = 0; k < rays; k++) {
      const ra = f.a + ((k - (rays - 1) / 2) / (rays - 1)) * 2.5;
      g.moveTo(ex, ey);
      g.lineTo(ex + Math.cos(ra) * tl, ey + Math.sin(ra) * tl);
    }
    g.stroke();
    // white wisp overlay to soften
    g.strokeStyle = 'rgba(255,255,255,0.9)';
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
    g.strokeStyle = FIL;
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

export function drawPuff(ctx: CanvasRenderingContext2D, o: PuffOpts): void {
  const { x, y, radius: r, time: t, seed } = o;
  const target = o.target ?? 0;
  const shake = o.shake ?? 0;
  const urg = o.urgency ?? 0;
  const ph = seed * 1.37;

  const sway = Math.sin(t * 1.1 + ph) * (0.05 + urg * 0.05) + Math.sin(t * 2.7 + ph) * 0.015 * urg;
  const wob = shake > 0 ? Math.sin(t * 48) * shake * 0.16 : 0;
  const breathe = 1 + Math.sin(t * 1.7 + ph) * 0.025;
  const shakeX = shake > 0 ? Math.sin(t * 61) * shake * r * 0.07 : 0;

  ctx.save();
  ctx.translate(x + shakeX, y);
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
  const cache = getPuffCache(seed, r);
  const sc = (r / cache.r) * breathe;
  ctx.rotate(sway + wob);
  ctx.scale(sc, sc);
  ctx.drawImage(cache.c as CanvasImageSource, -cache.half, -cache.half, cache.half * 2, cache.half * 2);
  ctx.restore();

  // loosening seeds when urgent
  if (urg > 0.15) {
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
