// Procedural storybook scenery: sky, sun, clouds, hills, cottage, garden bed,
// foreground fringe and rainbow. Static layers are pre-rendered on resize.

import { SKY, HILLS, SOIL, SOIL_DARK, rng, clamp01, lerp } from './palette';

export interface SceneryLayout {
  width: number;
  height: number;
  /** y of the garden soil line where flower stems start (about height*0.8). */
  groundY: number;
}

// ---------------------------------------------------------------- colour utils
function hexToRgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
function rgba(c: string, a: number): string {
  const [r, g, b] = hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

interface Surface {
  c: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number; // css px
  h: number;
}

function makeSurface(w: number, h: number, dpr: number): Surface {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { c, ctx, w: c.width / dpr, h: c.height / dpr };
}

// ---------------------------------------------------------------- ridges
interface Ridge {
  base: number;
  amp: number;
  f: [number, number, number];
  p: [number, number, number];
}
function makeRidge(rand: () => number, base: number, amp: number, period: number): Ridge {
  const tau = Math.PI * 2;
  return {
    base,
    amp,
    f: [tau / (period * (0.95 + rand() * 0.2)), tau / (period * 0.43), tau / (period * 0.21)],
    p: [rand() * tau, rand() * tau, rand() * tau],
  };
}
function ridgeY(r: Ridge, x: number): number {
  return (
    r.base -
    r.amp * (0.55 * Math.sin(x * r.f[0] + r.p[0]) + 0.3 * Math.sin(x * r.f[1] + r.p[1]) + 0.15 * Math.sin(x * r.f[2] + r.p[2]))
  );
}

function ridgePath(ctx: CanvasRenderingContext2D, r: Ridge, w: number, bottom: number) {
  ctx.beginPath();
  ctx.moveTo(-2, bottom);
  for (let x = -2; x <= w + 6; x += 6) ctx.lineTo(x, ridgeY(r, x));
  ctx.lineTo(w + 2, bottom);
  ctx.closePath();
}

// ---------------------------------------------------------------- clouds
interface CloudShape {
  bumps: number[][]; // cx, cy, r in a 320x150 box
  base: [number, number, number, number]; // x1, y1, x2, y2
}
const CLOUD_SHAPES: CloudShape[] = [
  { bumps: [[62, 100, 30], [112, 78, 42], [172, 64, 50], [232, 86, 38], [272, 106, 26]], base: [40, 102, 292, 132] },
  { bumps: [[72, 104, 28], [126, 88, 38], [186, 92, 34], [236, 106, 24]], base: [46, 104, 262, 132] },
  { bumps: [[82, 100, 34], [132, 72, 44], [178, 52, 40], [218, 78, 40], [258, 102, 30]], base: [52, 104, 288, 132] },
];

function buildCloud(shape: CloudShape, dpr: number, dusk: boolean): HTMLCanvasElement {
  const s = makeSurface(320, 150, dpr);
  const c = s.ctx;
  const path = new Path2D();
  for (const [x, y, r] of shape.bumps) {
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
  }
  path.roundRect(shape.base[0], shape.base[1], shape.base[2] - shape.base[0], shape.base[3] - shape.base[1], 16);
  const g = c.createLinearGradient(0, 28, 0, 134);
  if (dusk) {
    g.addColorStop(0, '#fff1e4');
    g.addColorStop(0.6, '#ffd9dc');
    g.addColorStop(1, '#f1bcd6');
  } else {
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#f4f8ff');
    g.addColorStop(1, '#d8e5fb');
  }
  c.fillStyle = g;
  c.fill(path);
  c.globalCompositeOperation = 'source-atop';
  for (const [x, y, r] of shape.bumps) {
    const rg = c.createRadialGradient(x - r * 0.25, y - r * 0.35, 0, x - r * 0.25, y - r * 0.35, r * 0.95);
    rg.addColorStop(0, dusk ? 'rgba(255,248,240,0.85)' : 'rgba(255,255,255,0.95)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return s.c;
}

interface Cloud {
  shape: number;
  depth: number;
  x0: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
  bob: number;
}

// ---------------------------------------------------------------- Scenery
export class Scenery {
  private L: SceneryLayout;
  private seed: number;
  private dpr = 1;

  private skyStrip!: Surface;
  private skyDay = -1;
  private skyGrad: CanvasGradient | null = null;

  private hills: { s: Surface; pad: number; yTop: number; speed: number; ph: number }[] = [];
  protected ground!: Surface;
  private groundTop = 0;
  private front!: Surface;
  private frontTop = 0;

  private cloudsDay: HTMLCanvasElement[] = [];
  private cloudsDusk: HTMLCanvasElement[] = [];
  private clouds: Cloud[] = [];

  private cottage = { x: 0, chimneyX: 0, chimneyY: 0, u: 1 };

  private tuft = {
    n: 0,
    x: new Float32Array(0),
    hh: new Float32Array(0),
    lean: new Float32Array(0),
    ph: new Float32Array(0),
    bw: new Float32Array(0),
    groups: [[], [], [], []] as number[][],
  };

  constructor(layout: SceneryLayout, seed = 7) {
    this.L = layout;
    this.seed = seed;
    this.resize(layout);
  }

  resize(layout: SceneryLayout): void {
    this.L = layout;
    this.dpr = Math.min(2, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    this.skyDay = -1;
    this.skyGrad = null;
    this.skyStrip = makeSurface(4, 512, 1);
    this.buildClouds();
    this.buildHills();
    this.buildGround();
    this.buildFront();
  }

  // ------------------------------------------------------------ builders
  private buildClouds() {
    const { width: w, height: h, groundY: g } = this.L;
    this.cloudsDay = CLOUD_SHAPES.map((s) => buildCloud(s, this.dpr, false));
    this.cloudsDusk = CLOUD_SHAPES.map((s) => buildCloud(s, this.dpr, true));
    const rand = rng(this.seed * 31 + 5);
    const n = Math.max(5, Math.min(11, Math.round(w / 240)));
    const depthScale = [0.62, 0.92, 1.3];
    const depthAlpha = [0.55, 0.75, 0.92];
    const depthSpeed = [2.5, 5, 9];
    this.clouds = [];
    const unit = Math.max(110, Math.min(330, h * 0.25));
    for (let i = 0; i < n; i++) {
      const depth = i % 3;
      const cw = unit * depthScale[depth] * (0.8 + rand() * 0.45);
      const yr: [number, number] = [[0.2, 0.46], [0.1, 0.38], [0.04, 0.26]][depth] as [number, number];
      this.clouds.push({
        shape: Math.floor(rand() * 3),
        depth,
        x0: (i / n) * (w + cw * 2) + rand() * 40,
        y: g * lerp(yr[0], yr[1], rand()),
        w: cw,
        h: cw * (150 / 320),
        speed: depthSpeed[depth] * Math.max(0.7, Math.min(1.6, w / 1100)),
        alpha: depthAlpha[depth],
        bob: rand() * 6.28,
      });
    }
    // draw far ones first
    this.clouds.sort((a, b) => a.depth - b.depth);
  }

  private drawTree(
    c: CanvasRenderingContext2D,
    x: number,
    baseY: number,
    r: number,
    hillCol: string,
    haze: string,
    hz: number,
    kind: number,
  ) {
    const leaf = mix(mix(hillCol, '#3f8a4a', 0.5), haze, hz);
    const leafDark = mix(leaf, '#2f6b47', 0.3);
    const leafHi = mix(mix(leaf, '#e2f5a8', 0.45), haze, hz * 0.5);
    const trunk = mix('#9a7358', haze, hz);
    c.fillStyle = rgba('#2f6b3a', 0.16 * (1 - hz * 0.6));
    c.beginPath();
    c.ellipse(x + r * 0.15, baseY + r * 0.02, r * 0.95, r * 0.17, 0, 0, Math.PI * 2);
    c.fill();
    if (kind === 2) {
      // low hedge / bush cluster
      const rr = r * 0.55;
      const pts = [[-1.1, 0.55], [-0.4, 0.8], [0.4, 0.75], [1.1, 0.5]];
      for (const [dx, k] of pts) {
        c.fillStyle = leaf;
        c.beginPath();
        c.arc(x + dx * rr, baseY - rr * k * 0.9, rr * (0.85 + k * 0.2), 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = rgba(leafHi, 0.55);
      c.beginPath();
      c.arc(x - rr * 0.1, baseY - rr * 1.25, rr * 0.5, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.fillStyle = trunk;
    c.beginPath();
    c.roundRect(x - r * 0.1, baseY - r * 0.95, r * 0.2, r * 0.97, r * 0.08);
    c.fill();
    if (kind === 1) {
      // tall rounded cypress
      c.fillStyle = leaf;
      c.beginPath();
      c.ellipse(x, baseY - r * 1.5, r * 0.62, r * 1.25, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = rgba(leafDark, 0.35);
      c.beginPath();
      c.ellipse(x + r * 0.22, baseY - r * 1.35, r * 0.4, r * 1.05, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = rgba(leafHi, 0.55);
      c.beginPath();
      c.ellipse(x - r * 0.22, baseY - r * 1.85, r * 0.25, r * 0.55, 0.15, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.fillStyle = leaf;
    c.beginPath();
    c.arc(x, baseY - r * 1.45, r, 0, Math.PI * 2);
    c.arc(x - r * 0.62, baseY - r * 1.05, r * 0.66, 0, Math.PI * 2);
    c.arc(x + r * 0.62, baseY - r * 1.08, r * 0.64, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = rgba(leafDark, 0.3);
    c.beginPath();
    c.ellipse(x + r * 0.25, baseY - r * 0.95, r * 0.6, r * 0.28, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = rgba(leafHi, 0.6);
    c.beginPath();
    c.arc(x - r * 0.3, baseY - r * 1.78, r * 0.48, 0, Math.PI * 2);
    c.fill();
  }

  private buildHills() {
    const { width: w, height: h, groundY: g } = this.L;
    const rand = rng(this.seed * 17 + 3);
    const yTop = Math.max(0, g - 0.37 * h);
    const sh = g + 0.04 * h - yTop;
    const pads = [14, 20, 28];
    const speeds = [0.07, 0.1, 0.13];
    const bases = [g - 0.205 * h, g - 0.125 * h, g - 0.062 * h];
    const amps = [0.05 * h, 0.045 * h, 0.03 * h];
    const periods = [1.35, 1.0, 0.8].map((k) => Math.max(w, h * 1.0) * k);
    const haze = '#dcebf5';
    const colors = [
      mix(HILLS[0], '#cfe3f3', 0.42),
      mix(HILLS[1], '#e4efc6', 0.28),
      mix(HILLS[2], HILLS[1], 0.25),
    ];
    const hzs = [0.5, 0.22, 0.04];
    this.hills = [];
    this.ridges = [];

    // cottage x in world coords
    const portrait = w < h;
    const cottageWorldX = w * (portrait ? 0.66 : 0.71);
    const u = Math.max(5, Math.min(15, h * 0.0225));
    let ridge1: Ridge | null = null;

    for (let i = 0; i < 3; i++) {
      const pad = pads[i];
      const sw = w + pad * 2;
      const s = makeSurface(sw, sh, this.dpr);
      const c = s.ctx;
      c.translate(0, -yTop);
      const ridge = makeRidge(rand, bases[i], amps[i], periods[i]);
      this.ridges.push(ridge);
      if (i === 1) ridge1 = ridge;
      const col = colors[i];
      const grad = c.createLinearGradient(0, bases[i] - amps[i], 0, g + 0.04 * h);
      grad.addColorStop(0, mix(col, '#ffffff', 0.12));
      grad.addColorStop(0.35, col);
      grad.addColorStop(1, mix(col, i === 2 ? '#4f8f3f' : haze, i === 2 ? 0.25 : 0.2));
      c.fillStyle = grad;
      ridgePath(c, ridge, sw, g + 0.04 * h);
      c.fill();

      // soft rim light along the crest
      c.save();
      ridgePath(c, ridge, sw, g + 0.04 * h);
      c.clip();
      c.strokeStyle = rgba('#ffffff', 0.28);
      c.lineWidth = 5;
      c.lineJoin = 'round';
      c.beginPath();
      for (let x = -2; x <= sw + 6; x += 6) {
        const y = ridgeY(ridge, x) + 2.5;
        if (x === -2) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();

      // pasture furrows following the ridge
      if (i > 0) {
        c.strokeStyle = rgba(mix(col, '#4a7a3a', 0.55), i === 1 ? 0.14 : 0.18);
        c.lineWidth = i === 1 ? 1.5 : 2;
        const rows = i === 1 ? 5 : 4;
        for (let k = 1; k <= rows; k++) {
          const off = h * 0.011 * (k + k * k * 0.22) * (i === 1 ? 0.9 : 1.15);
          c.beginPath();
          for (let x = -2; x <= sw + 6; x += 8) {
            const y = ridgeY(ridge, x) + off + Math.sin(x * 0.012 + k) * 1.5;
            if (x === -2) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }
      }
      c.restore();

      // trees / hedges
      const treeR = h * [0.016, 0.024, 0.032][i];
      const count = Math.round((sw / (h * 0.14)) * [0.7, 0.8, 0.45][i]);
      const cx = cottageWorldX + pad;
      const xs: number[] = [];
      for (let k = 0; k < count; k++) xs.push(((k + 0.15 + rand() * 0.7) / count) * sw);
      for (const x of xs) {
        if (i === 1 && Math.abs(x - cx) < u * 4.5) continue;
        if (i === 2 && Math.abs(x - cx) < u * 5) continue;
        const kind = rand() < 0.25 ? 1 : rand() < 0.3 ? 2 : 0;
        const r = treeR * (0.75 + rand() * 0.6);
        this.drawTree(c, x, ridgeY(ridge, x) + r * 0.22, r, col, haze, hzs[i], kind);
      }

      // tiny meadow flowers on the nearest hill
      if (i === 2) {
        const dots = ['#fffdf7', '#ff9ec7', '#ffd45c', '#b99cff'];
        for (let k = 0; k < sw / 14; k++) {
          const x = rand() * sw;
          const y = ridgeY(ridge, x) + h * 0.012 + rand() * (g - ridgeY(ridge, x)) * 0.8;
          c.fillStyle = rgba(dots[Math.floor(rand() * 4)], 0.75);
          c.beginPath();
          c.arc(x, y, 1.3 + rand() * 0.9, 0, Math.PI * 2);
          c.fill();
        }
      }
      this.hills.push({ s, pad, yTop, speed: speeds[i], ph: rand() * 6.28 });
    }

    // cottage on hill 1
    if (ridge1) {
      const hl = this.hills[1];
      const c = hl.s.ctx;
      const cx = cottageWorldX + hl.pad;
      const y0 = ridgeY(ridge1, cx) + u * 0.5;
      this.drawCottage(c, cx, y0, u);
      this.cottage = { x: cx - hl.pad, chimneyX: cx - hl.pad + u * 1.15, chimneyY: y0 - u * 4.2, u };
    }

    // winding path on hill 2 leading up toward the cottage
    {
      const hl = this.hills[2];
      const c = hl.s.ctx;
      void hl; void c;
    }
  }

  protected drawPath(
    c: CanvasRenderingContext2D,
    hl: { pad: number },
    worldX: number,
    h: number,
    g: number,
    _base: number,
    _amp: number,
    rand: () => number,
  ) {
    const w = this.L.width;
    const x0 = worldX + hl.pad;
    const portrait = w < h;
    const x1 = x0 - w * (portrait ? 0.38 : 0.2);
    const yStart = this.hillsRidgeProbe(2, x0);
    const yEnd = g + 0.02 * h;
    const pts: { x: number; y: number; hw: number }[] = [];
    const N = 40;
    const wob = h * 0.05;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const e = t * t * (3 - 2 * t);
      pts.push({
        x: lerp(x0, x1, e) + Math.sin(t * Math.PI * 2.1) * wob * (0.3 + t),
        y: lerp(yStart, yEnd, Math.pow(t, 0.85)),
        hw: lerp(1.2, h * 0.055, Math.pow(t, 1.4)),
      });
    }
    c.beginPath();
    for (let i = 0; i <= N; i++) (i ? c.lineTo : c.moveTo).call(c, pts[i].x - pts[i].hw, pts[i].y);
    for (let i = N; i >= 0; i--) c.lineTo(pts[i].x + pts[i].hw, pts[i].y);
    c.closePath();
    const grad = c.createLinearGradient(0, yStart, 0, yEnd);
    grad.addColorStop(0, '#f2e4c3');
    grad.addColorStop(1, '#ecd5a8');
    c.fillStyle = grad;
    c.fill();
    c.strokeStyle = rgba('#b9976a', 0.35);
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = rgba('#b9976a', 0.35);
    for (let i = 4; i <= N; i += 3) {
      const p = pts[i];
      c.beginPath();
      c.arc(p.x + (rand() - 0.5) * p.hw, p.y, 0.6 + p.hw * 0.05, 0, Math.PI * 2);
      c.fill();
    }
  }

  private ridges: Ridge[] = [];
  private hillsRidgeProbe(i: number, x: number): number {
    return ridgeY(this.ridges[i], x) + 1;
  }

  private drawCottage(c: CanvasRenderingContext2D, cx: number, y0: number, u: number) {
    // gentle shadow
    c.fillStyle = rgba('#3f7a45', 0.2);
    c.beginPath();
    c.ellipse(cx + u * 0.3, y0 + u * 0.05, u * 2.6, u * 0.45, 0, 0, Math.PI * 2);
    c.fill();
    // chimney
    c.fillStyle = '#e3b9a8';
    c.strokeStyle = rgba('#b58472', 0.7);
    c.lineWidth = Math.max(1, u * 0.08);
    c.beginPath();
    c.roundRect(cx + u * 0.9, y0 - u * 4.2, u * 0.55, u * 1.5, u * 0.08);
    c.fill();
    c.stroke();
    // wall
    c.fillStyle = '#fdf0df';
    c.strokeStyle = rgba('#c9a98a', 0.8);
    c.beginPath();
    c.roundRect(cx - u * 1.7, y0 - u * 2.0, u * 3.4, u * 2.0, u * 0.12);
    c.fill();
    c.stroke();
    // roof
    c.lineJoin = 'round';
    c.fillStyle = '#ee9d92';
    c.strokeStyle = rgba('#c4525a', 0.75);
    c.beginPath();
    c.moveTo(cx - u * 2.25, y0 - u * 1.7);
    c.lineTo(cx, y0 - u * 3.55);
    c.lineTo(cx + u * 2.25, y0 - u * 1.7);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = rgba('#ffffff', 0.25);
    c.beginPath();
    c.moveTo(cx - u * 1.6, y0 - u * 1.85);
    c.lineTo(cx - u * 0.1, y0 - u * 3.2);
    c.lineTo(cx - u * 0.4, y0 - u * 1.85);
    c.closePath();
    c.fill();
    // door
    c.fillStyle = '#b98a6a';
    c.beginPath();
    c.roundRect(cx - u * 0.9, y0 - u * 1.15, u * 0.7, u * 1.15, [u * 0.35, u * 0.35, 0, 0]);
    c.fill();
    // window
    c.fillStyle = '#ffe9a8';
    c.strokeStyle = rgba('#c9a98a', 0.9);
    c.beginPath();
    c.roundRect(cx + u * 0.3, y0 - u * 1.5, u * 0.9, u * 0.8, u * 0.1);
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(cx + u * 0.75, y0 - u * 1.5);
    c.lineTo(cx + u * 0.75, y0 - u * 0.7);
    c.stroke();
    // little bush
    c.fillStyle = '#7ab85a';
    c.beginPath();
    c.arc(cx + u * 2.0, y0 - u * 0.2, u * 0.5, 0, Math.PI * 2);
    c.arc(cx + u * 2.5, y0 - u * 0.1, u * 0.38, 0, Math.PI * 2);
    c.fill();
  }

  private buildGround() {
    const { width: w, height: h, groundY: g } = this.L;
    const rand = rng(this.seed * 53 + 11);
    const yTop = Math.max(0, g - 0.1 * h);
    this.groundTop = yTop;
    const s = makeSurface(w, h - yTop + 1, this.dpr);
    const c = s.ctx;
    c.translate(0, -yTop);
    this.ground = s;
    const per = Math.max(w, h);
    const tau = Math.PI * 2;
    const p1 = rand() * tau;
    const p2 = rand() * tau;

    // grassy bank (back)
    const bankY = (x: number) =>
      g - 0.05 * h + 0.012 * h * Math.sin((x / per) * tau * 1.1 + p1) + 0.006 * h * Math.sin((x / per) * tau * 2.7 + p2);
    const bg = c.createLinearGradient(0, g - 0.07 * h, 0, g + 0.02 * h);
    bg.addColorStop(0, mix(HILLS[2], HILLS[1], 0.15));
    bg.addColorStop(1, HILLS[3]);
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(-2, h + 2);
    for (let x = -2; x <= w + 6; x += 6) c.lineTo(x, bankY(x));
    c.lineTo(w + 2, h + 2);
    c.closePath();
    c.fill();
    // bank rim light
    c.strokeStyle = rgba('#d6efa0', 0.7);
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    for (let x = -2; x <= w + 6; x += 6) (x === -2 ? c.moveTo : c.lineTo).call(c, x, bankY(x) + 2);
    c.stroke();
    // daisies on the bank
    for (let k = 0; k < w / 38; k++) {
      const x = rand() * w;
      const y = bankY(x) + h * 0.008 + rand() * h * 0.02;
      if (y > g - 0.012 * h) continue;
      const rr = 1.6 + rand() * 1.2;
      c.fillStyle = rgba('#fffdf7', 0.85);
      c.beginPath();
      c.arc(x, y, rr, 0, tau);
      c.fill();
      c.fillStyle = rgba('#ffd45c', 0.95);
      c.beginPath();
      c.arc(x, y, rr * 0.4, 0, tau);
      c.fill();
    }

    // soil bed
    const soilTop = (x: number) => g - 0.006 * h + 0.003 * h * Math.sin((x / per) * tau * 3 + p2);
    const soilBot = g + 0.06 * h;
    const sg = c.createLinearGradient(0, g - 0.01 * h, 0, soilBot);
    sg.addColorStop(0, mix(SOIL, '#c9a07c', 0.25));
    sg.addColorStop(0.3, SOIL);
    sg.addColorStop(1, SOIL_DARK);
    c.fillStyle = sg;
    c.beginPath();
    c.moveTo(-2, soilBot);
    for (let x = -2; x <= w + 6; x += 6) c.lineTo(x, soilTop(x));
    c.lineTo(w + 2, soilBot);
    c.closePath();
    c.fill();
    c.save();
    c.clip();
    // soil texture
    for (let k = 0; k < w / 6; k++) {
      const x = rand() * w;
      const y = g + (rand() - 0.1) * 0.065 * h;
      c.fillStyle = rgba(rand() < 0.5 ? '#6a4430' : '#c9a07c', 0.28);
      c.beginPath();
      c.ellipse(x, y, 1.5 + rand() * 2.8, 1 + rand() * 1.4, rand() * 3, 0, tau);
      c.fill();
    }
    c.strokeStyle = rgba('#6a4430', 0.22);
    c.lineWidth = 1.5;
    for (let k = 0; k < w / 70; k++) {
      const x = rand() * w;
      const y = g + (0.008 + rand() * 0.04) * h;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + 14, y - 4, x + 30 + rand() * 20, y + 1);
      c.stroke();
    }
    c.restore();
    // turf lip overhanging the soil
    const lipR = Math.max(5, h * 0.011);
    for (let pass = 0; pass < 2; pass++) {
      c.fillStyle = pass === 0 ? HILLS[3] : mix(HILLS[2], '#a8d672', 0.4);
      c.beginPath();
      for (let x = -lipR; x < w + lipR; x += lipR * 1.5) {
        const y = soilTop(x) - lipR * 0.15 - pass * lipR * 0.28 + (pass ? 0 : lipR * 0.15);
        const r = lipR * (pass ? 0.85 : 1.0) * (0.85 + 0.3 * ((Math.sin(x * 12.9) + 1) / 2));
        c.moveTo(x + r, y);
        c.arc(x, y, r, 0, tau);
      }
      c.fill();
    }
    // shadow under the lip
    const sh = c.createLinearGradient(0, g - 0.006 * h, 0, g + 0.012 * h);
    sh.addColorStop(0, 'rgba(70,40,30,0.30)');
    sh.addColorStop(1, 'rgba(70,40,30,0)');
    c.fillStyle = sh;
    c.fillRect(0, g - 0.006 * h, w, 0.018 * h);

    // lawn in front of the soil
    const lawnTop = (x: number) =>
      soilBot - 0.004 * h + 0.006 * h * Math.sin((x / per) * tau * 2.2 + p1 + 1) + 0.003 * h * Math.sin((x / per) * tau * 5.3);
    const lg = c.createLinearGradient(0, soilBot, 0, h);
    lg.addColorStop(0, '#86c25a');
    lg.addColorStop(0.5, '#72b24f');
    lg.addColorStop(1, '#5a9a46');
    c.fillStyle = lg;
    c.beginPath();
    c.moveTo(-2, h + 2);
    for (let x = -2; x <= w + 6; x += 6) c.lineTo(x, lawnTop(x));
    c.lineTo(w + 2, h + 2);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#d6efa0', 0.6);
    c.lineWidth = 3;
    c.beginPath();
    for (let x = -2; x <= w + 6; x += 6) (x === -2 ? c.moveTo : c.lineTo).call(c, x, lawnTop(x) + 2);
    c.stroke();
    // soft shadow on soil from the lawn edge
    // lawn blade marks and clover dots
    c.lineCap = 'round';
    for (let k = 0; k < w / 20; k++) {
      const x = rand() * w;
      const y = lawnTop(x) + h * 0.02 + rand() * (h - lawnTop(x) - h * 0.03);
      c.strokeStyle = rgba(rand() < 0.5 ? '#4f8f3f' : '#b6e07c', 0.35);
      c.lineWidth = 1.6;
      const bl = 4 + rand() * 5;
      c.beginPath();
      c.moveTo(x - 3, y);
      c.quadraticCurveTo(x - 2, y - bl * 0.6, x - 4 - rand() * 2, y - bl);
      c.moveTo(x, y);
      c.quadraticCurveTo(x, y - bl * 0.7, x + 1, y - bl * 1.2);
      c.moveTo(x + 3, y);
      c.quadraticCurveTo(x + 3, y - bl * 0.6, x + 5 + rand() * 2, y - bl);
      c.stroke();
    }
  }

  private buildFront() {
    const { width: w, height: h, groundY: g } = this.L;
    const rand = rng(this.seed * 71 + 29);
    const tau = Math.PI * 2;
    const yTop = Math.max(0, g - 0.06 * h);
    this.frontTop = yTop;
    const s = makeSurface(w, h - yTop, this.dpr);
    const c = s.ctx;
    c.translate(0, -yTop);
    this.front = s;

    // dim base strip to anchor the tufts
    const bg = c.createLinearGradient(0, h - 0.035 * h, 0, h);
    bg.addColorStop(0, 'rgba(70,130,60,0)');
    bg.addColorStop(1, 'rgba(70,130,60,0.9)');
    c.fillStyle = bg;
    c.fillRect(0, h - 0.035 * h, w, 0.035 * h);

    // pebbles
    const pebbles = Math.max(3, Math.round(w / 260));
    for (let k = 0; k < pebbles; k++) {
      const x = (k + 0.2 + rand() * 0.6) * (w / pebbles);
      const y = h - h * (0.008 + rand() * 0.015);
      const r = h * (0.007 + rand() * 0.008);
      c.fillStyle = rgba('#4f6a40', 0.22);
      c.beginPath();
      c.ellipse(x + r * 0.2, y + r * 0.55, r * 1.25, r * 0.35, 0, 0, tau);
      c.fill();
      const pg = c.createLinearGradient(0, y - r, 0, y + r * 0.7);
      pg.addColorStop(0, '#ece6f2');
      pg.addColorStop(1, '#bfb3cc');
      c.fillStyle = pg;
      c.strokeStyle = '#9d90ad';
      c.lineWidth = 1.2;
      c.beginPath();
      c.ellipse(x, y, r * 1.2, r * 0.8, 0, 0, tau);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.ellipse(x - r * 0.4, y - r * 0.28, r * 0.35, r * 0.16, -0.4, 0, tau);
      c.fill();
    }

    // tiny mushrooms
    const mush = Math.max(2, Math.round(w / 700) + 1);
    for (let k = 0; k < mush; k++) {
      const x = w * (0.1 + 0.8 * ((k + 0.25 + rand() * 0.5) / mush));
      const y = h - h * 0.006;
      const m = h * (0.011 + rand() * 0.004);
      c.fillStyle = rgba('#4f6a40', 0.2);
      c.beginPath();
      c.ellipse(x + m * 0.2, y, m * 1.4, m * 0.3, 0, 0, tau);
      c.fill();
      // stem
      c.fillStyle = '#fff3e0';
      c.strokeStyle = '#d3b896';
      c.lineWidth = 1.2;
      c.beginPath();
      c.roundRect(x - m * 0.42, y - m * 1.3, m * 0.84, m * 1.3, m * 0.3);
      c.fill();
      c.stroke();
      // cap
      c.fillStyle = '#ff8c84';
      c.strokeStyle = '#c4525a';
      c.beginPath();
      c.moveTo(x - m * 1.5, y - m * 1.2);
      c.quadraticCurveTo(x, y - m * 3.1, x + m * 1.5, y - m * 1.2);
      c.quadraticCurveTo(x, y - m * 0.8, x - m * 1.5, y - m * 1.2);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#fffdf7';
      for (const [dx, dy, rr] of [[-0.7, -1.45, 0.24], [0.2, -2.0, 0.3], [0.85, -1.5, 0.2]]) {
        c.beginPath();
        c.arc(x + dx * m, y + dy * m * 0.95, rr * m, 0, tau);
        c.fill();
      }
    }

    // edge bushes (the only things that rise a little above the soil line)
    const bushW = Math.min(Math.max(h * 0.09, w * 0.05), w * 0.11);
    const bushH = Math.min(h - g + 0.015 * h, w * 0.3);
    for (const side of [-1, 1]) {
      const edge = side < 0 ? 0 : w;
      const cols = [mix(HILLS[3], '#3f7a45', 0.35), HILLS[3], HILLS[2], '#a8d672'];
      for (let layer = 0; layer < 4; layer++) {
        const k = 1 - layer * 0.17;
        const n = 5;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const r = bushH * (0.2 + 0.2 * (1 - t)) * k * (0.9 + rand() * 0.2);
          const x = edge - side * (t * bushW * k - r * 0.35);
          const y = h - r * (0.8 + (1 - t) * 0.9 * k) + (layer === 0 ? 0 : layer * 3) * 0;
          c.fillStyle = cols[layer];
          c.beginPath();
          c.arc(x, Math.max(y, h - bushH * 0.9 * k), r, 0, tau);
          c.fill();
        }
      }
      // blossoms
      const bl = ['#fffdf7', '#ff9ec7', '#ffd45c'];
      for (let i = 0; i < 7; i++) {
        const x = edge - side * (rand() * bushW * 0.8);
        const y = h - rand() * bushH * 0.6 - 4;
        c.fillStyle = bl[i % 3];
        c.beginPath();
        c.arc(x, y, 2 + rand() * 1.8, 0, tau);
        c.fill();
        c.fillStyle = '#ffd45c';
        if (i % 3 === 0) {
          c.beginPath();
          c.arc(x, y, 1, 0, tau);
          c.fill();
        }
      }
    }

    // grass tuft data
    const spacing = Math.max(9, h * 0.011);
    const nT = Math.ceil(w / spacing) * 3;
    const T = this.tuft;
    T.n = nT;
    T.x = new Float32Array(nT);
    T.hh = new Float32Array(nT);
    T.lean = new Float32Array(nT);
    T.ph = new Float32Array(nT);
    T.bw = new Float32Array(nT);
    T.groups = [[], [], [], []];
    const edgeW = Math.max(h * 0.06, w * 0.045);
    for (let i = 0; i < nT; i++) {
      const x = (i / nT) * (w + 20) - 10;
      const e = clamp01(1 - Math.min(x, w - x) / edgeW);
      T.x[i] = x;
      T.hh[i] = h * (0.014 + rand() * 0.022) + e * e * h * (0.07 + rand() * 0.06);
      T.lean[i] = (rand() - 0.5) * 0.5 + (x < w / 2 ? 0.12 : -0.12) * e * 2;
      T.ph[i] = rand() * 6.28;
      T.bw[i] = Math.max(1.8, h * 0.0038) * (0.8 + rand() * 0.6);
      T.groups[Math.floor(rand() * 4)].push(i);
    }
  }

  // ------------------------------------------------------------ drawing
  private updateSky(day: number) {
    if (Math.abs(day - this.skyDay) <= 0.01) return;
    this.skyDay = day;
    const { height: h, groundY: g } = this.L;
    const c = this.skyStrip.ctx;
    const d = clamp01(day);
    const top = mix(SKY.top, SKY.duskTop, d);
    const mid = mix(SKY.mid, SKY.duskMid, d);
    const hor = mix(SKY.horizon, SKY.duskHorizon, d);
    const gold = mix(SKY.horizon, '#ffd6a0', d);
    const k = g / h;
    const gr = c.createLinearGradient(0, 0, 0, h);
    this.skyGrad = gr;
    gr.addColorStop(0, top);
    gr.addColorStop(clamp01(0.3 * k), mid);
    gr.addColorStop(clamp01(0.6 * k), hor);
    gr.addColorStop(clamp01(0.78 * k), gold);
    gr.addColorStop(1, gold);
    c.fillStyle = gr;
    c.fillRect(0, 0, 4, 512);
  }

  private drawSun(ctx: CanvasRenderingContext2D, time: number, day: number) {
    const { width: w, height: h, groundY: g } = this.L;
    const d = clamp01(day);
    const sx = w * lerp(0.14, 0.84, d);
    const sy = g * (0.19 + 0.42 * Math.pow(d, 1.6));
    const r = Math.max(26, Math.min(72, Math.min(w, h) * 0.082)) * (1 + 0.14 * d) * (1 + 0.012 * Math.sin(time * 0.9));
    const halo = mix('#fff1b0', '#ffb070', d);
    const [hr, hg, hb] = hexToRgb(halo);

    // wide glow
    const wr = r * (5 + 3 * d);
    const wg = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, wr);
    wg.addColorStop(0, `rgba(${hr},${hg},${hb},${0.4 + 0.1 * d})`);
    wg.addColorStop(0.3, `rgba(${hr},${hg},${hb},0.16)`);
    wg.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
    ctx.fillStyle = wg;
    ctx.fillRect(sx - wr, sy - wr, wr * 2, wr * 2);

    // slowly turning soft rays
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(time * 0.035);
    ctx.strokeStyle = `rgba(255,${Math.round(244 - 30 * d)},${Math.round(200 - 50 * d)},0.2)`;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const rays = 12;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      const r0 = r * 1.28;
      const r1 = r * (i % 2 ? 1.65 : 1.95);
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    }
    ctx.stroke();
    ctx.restore();

    // disc
    const core = mix('#fffbe6', '#ffe8c0', d);
    const edge = mix('#ffe27a', '#ffa05c', d);
    const dg = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.32, r * 0.1, sx, sy, r);
    dg.addColorStop(0, core);
    dg.addColorStop(1, edge);
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(mix('#f5b840', '#e07a40', d), 0.55);
    ctx.lineWidth = Math.max(1.5, r * 0.04);
    ctx.stroke();

    // sleepy kind face (subtle)
    const faceCol = rgba(mix('#c9772e', '#b8502e', d), 0.5);
    ctx.strokeStyle = faceCol;
    ctx.lineWidth = r * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const sg of [-1, 1]) {
      const ex = sx + sg * r * 0.34;
      const ey = sy - r * 0.08;
      ctx.moveTo(ex + r * 0.15, ey);
      ctx.arc(ex, ey, r * 0.15, 0, Math.PI, false);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx, sy + r * 0.02, r * 0.3, Math.PI * 0.2, Math.PI * 0.8, false);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,110,0.26)';
    ctx.beginPath();
    for (const sg of [-1, 1]) {
      ctx.moveTo(sx + sg * r * 0.56 + r * 0.17, sy + r * 0.22);
      ctx.ellipse(sx + sg * r * 0.56, sy + r * 0.22, r * 0.17, r * 0.1, 0, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  private drawClouds(ctx: CanvasRenderingContext2D, time: number, day: number) {
    const w = this.L.width;
    const d = clamp01(day);
    for (const cl of this.clouds) {
      const span = w + cl.w * 2;
      let x = (cl.x0 - time * cl.speed) % span;
      if (x < 0) x += span;
      x -= cl.w;
      const y = cl.y + Math.sin(time * 0.25 + cl.bob) * 2.5;
      if (d < 0.98) {
        ctx.globalAlpha = cl.alpha * (1 - d);
        ctx.drawImage(this.cloudsDay[cl.shape], Math.round(x), Math.round(y), cl.w, cl.h);
      }
      if (d > 0.02) {
        ctx.globalAlpha = cl.alpha * d;
        ctx.drawImage(this.cloudsDusk[cl.shape], Math.round(x), Math.round(y), cl.w, cl.h);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawBack(ctx: CanvasRenderingContext2D, time: number, day: number): void {
    const { width: w, height: h, groundY: g } = this.L;
    const d = clamp01(day);
    this.updateSky(d);
    ctx.fillStyle = this.skyGrad!;
    ctx.fillRect(0, 0, w, h);
    this.drawClouds(ctx, time, d);
    this.drawSun(ctx, time, d);

    let dx1 = 0;
    for (let i = 0; i < this.hills.length; i++) {
      const hl = this.hills[i];
      const dx = Math.round(Math.sin(time * hl.speed + hl.ph) * hl.pad * 0.85);
      if (i === 1) dx1 = dx;
      ctx.drawImage(hl.s.c, -hl.pad + dx, Math.round(hl.yTop), hl.s.w, hl.s.h);
      if (i === 1) this.drawSmoke(ctx, time, dx1, d);
    }

    // warm light over the distance
    if (d > 0.01) {
      const y0 = h * 0.3;
      const og = ctx.createLinearGradient(0, y0, 0, g);
      og.addColorStop(0, 'rgba(255,170,120,0)');
      og.addColorStop(1, `rgba(255,160,110,${0.26 * d})`);
      ctx.fillStyle = og;
      ctx.fillRect(0, y0, w, g - y0 + 0.04 * h);
    }
    ctx.drawImage(this.ground.c, 0, Math.round(this.groundTop), this.ground.w, this.ground.h);
  }

  private drawSmoke(ctx: CanvasRenderingContext2D, time: number, dx: number, d: number) {
    const ck = this.cottage;
    const hl = this.hills[1];
    if (!hl) return;
    const baseX = ck.chimneyX + dx + hl.pad * 0 - 0;
    for (let i = 0; i < 3; i++) {
      const ph = (time * 0.12 + i / 3) % 1;
      const x = baseX + Math.sin(ph * 5 + i) * ck.u * 0.3 + ph * ck.u * 1.4;
      const y = ck.chimneyY - ph * ck.u * 3.2;
      ctx.fillStyle = `rgba(255,255,255,${0.42 * (1 - ph) * (1 - 0.3 * d)})`;
      ctx.beginPath();
      ctx.arc(x, y, ck.u * (0.22 + ph * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawFront(ctx: CanvasRenderingContext2D, time: number): void {
    const { width: w, height: h } = this.L;
    ctx.drawImage(this.front.c, 0, this.frontTop, this.front.w, this.front.h);
    const T = this.tuft;
    const cols = ['#4f8f3f', '#5fa04a', '#79b956', '#9bcf68'];
    const yb = h + 2;
    for (let gi = 0; gi < 4; gi++) {
      ctx.fillStyle = cols[gi];
      ctx.beginPath();
      const list = T.groups[gi];
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        const x = T.x[i];
        const hh = T.hh[i];
        const bw = T.bw[i];
        const sway = Math.sin(time * 1.3 + T.ph[i] * 0.4 + x * 0.006) * 0.12 + Math.sin(time * 2.3 + T.ph[i]) * 0.03;
        const tx = x + (T.lean[i] + sway) * hh;
        const ty = yb - hh;
        const mx = (tx - x) * 0.35;
        ctx.moveTo(x - bw, yb);
        ctx.quadraticCurveTo(x - bw * 0.4 + mx, yb - hh * 0.55, tx, ty);
        ctx.quadraticCurveTo(x + bw * 0.4 + mx, yb - hh * 0.55, x + bw, yb);
        ctx.closePath();
      }
      ctx.fill();
    }
    void w;
  }

  drawRainbow(ctx: CanvasRenderingContext2D, intensity: number, time: number): void {
    const k = clamp01(intensity);
    if (k <= 0.001) return;
    const { width: w, height: h, groundY: g } = this.L;
    const outer = Math.min(w * 0.47, g * 0.72);
    const cx = w * 0.5;
    const cy = g - 0.02 * h;
    const bands = ['#ff9aa8', '#ffbf9a', '#ffe99c', '#b4e8a6', '#a2d6ff', '#c3b2ff'];
    const bw = outer * 0.052;
    const sweep = 1 - Math.pow(1 - k, 3);
    const a0 = Math.PI;
    const a1 = Math.PI + Math.PI * sweep;
    const alpha = Math.min(1, k * 2.2) * (0.46 + 0.04 * Math.sin(time * 1.2));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'butt';
    ctx.lineWidth = bw + 0.8;
    for (let i = 0; i < bands.length; i++) {
      ctx.strokeStyle = bands[i];
      ctx.beginPath();
      ctx.arc(cx, cy, outer - bw * (i + 0.5), a0, a1);
      ctx.stroke();
    }
    ctx.restore();
    // cloud puffs at the feet
    const cw = outer * 0.5;
    ctx.globalAlpha = k;
    const wob = Math.sin(time * 0.6) * 2;
    const left = cx - outer + bw * 3;
    const right = cx + outer - bw * 3;
    ctx.drawImage(this.cloudsDay[0], left - cw * 0.62, cy - cw * 0.34 + wob, cw, cw * (150 / 320));
    ctx.globalAlpha = k * Math.min(1, sweep * 1.4);
    ctx.drawImage(this.cloudsDay[1], right - cw * 0.38, cy - cw * 0.34 - wob, cw, cw * (150 / 320));
    ctx.globalAlpha = 1;
  }
}
