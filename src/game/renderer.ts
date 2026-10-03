// Draws the whole scene each frame: scenery, garden, puffs + labels, Bumble,
// butterflies and particles. Game rules live in round.ts; this file only
// visualises them and reacts to round events.

import { Scenery, type Tickleable } from '../art/scenery';
import { drawBee, drawButterfly, drawPuff, drawSeed, drawSparkle, type BeeMood } from '../art/characters';
import { drawFlower, flowerSwayAngle, FLOWER_RARITY, type FlowerKind } from '../art/flowers';
import { INK, PETALS, clamp01, easeOutBack, easeOutCubic, lerp } from '../art/palette';
import type { Puff, Round, RoundEvent } from './round';

const TYPED = '#2f9b78';
const NEXT = '#e2557a';
const LABEL_FONT = "'Andika', 'Fredoka', system-ui, sans-serif";
const UI_FONT = "'Fredoka', system-ui, sans-serif";

interface Layout {
  w: number; h: number;
  groundY: number;
  skyTop: number;    // top of the lane band
  skyBottom: number; // bottom of the lane band
  bottomInset: number;
}

interface Planted { nx: number; row: number; kind: FlowerKind; seed: number; t0: number; sway: number; scale: number; push?: number; pushV?: number }

interface Particle {
  kind: 'seed' | 'sparkle' | 'plant' | 'text' | 'petal';
  x: number; y: number; vx: number; vy: number;
  rot: number; vr: number;
  size: number; life: number; age: number;
  color: string;
  text?: string;
  img?: HTMLCanvasElement;
  // plant-seed flight
  sx?: number; sy?: number; tx?: number; ty?: number; flower?: FlowerKind; row?: number; nx?: number;
}

interface LabelLayout { font: number; lines: { start: number; end: number; y: number }[]; xs: Float32Array; width: number; height: number; emojiW: number }

const ROWS = 3;

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scenery: Scenery;
  private L: Layout = { w: 1, h: 1, groundY: 1, skyTop: 0, skyBottom: 1, bottomInset: 0 };
  private dpr = 1;
  private particles: Particle[] = [];
  private garden: Planted[] = [];
  private labelCache = new WeakMap<Puff, LabelLayout>();
  private bee = { x: 120, y: 160, vx: 0, vy: 0, mood: 'idle' as BeeMood, moodT: 0, facing: 1 as 1 | -1, loop: 0, follow: 0 };
  private butterflies: { x: number; y: number; seed: number; tx: number; ty: number; t: number }[] = [];
  private rainbow = 0;
  private time = 0;
  reducedMotion = false;
  /** Called when a seed lands and sprouts (for sound). */
  onSprout: (() => void) | null = null;
  private pendingResize = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.scenery = new Scenery({ width: 800, height: 600, groundY: 480 }, 11);
    for (let i = 0; i < 3; i++) this.butterflies.push({ x: Math.random(), y: 0.7, seed: i * 17 + 3, tx: Math.random(), ty: 0.7, t: Math.random() * 10 });
  }

  get layout(): Layout { return this.L; }

  /** Space reserved at the bottom (e.g. the keyboard guide), in CSS px. */
  setBottomInset(px: number) {
    if (Math.abs(px - this.L.bottomInset) > 1) { this.L.bottomInset = px; this.pendingResize = true; this.labelCache = new WeakMap(); }
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    const groundH = Math.max(86, Math.min(240, h * 0.2));
    const groundY = Math.round(h - groundH);
    const topInset = Math.max(64, Math.min(96, h * 0.1));
    this.L = { ...this.L, w, h, groundY, skyTop: topInset, skyBottom: groundY - 24 };
    this.scenery.resize({ width: w, height: h, groundY });
    this.resetAtlas();
    this.labelCache = new WeakMap();
    this.pendingResize = true;
  }

  private bandTop: number | null = null;
  /** Override the top of the puff band (e.g. below the title-screen buttons). */
  setBandTop(px: number | null) {
    if (px !== null) px = Math.round(px);
    if (px !== this.bandTop) { this.bandTop = px; this.pendingResize = true; this.labelCache = new WeakMap(); }
  }

  private updateBand() {
    const L = this.L;
    const topInset = Math.max(64, Math.min(96, L.h * 0.1));
    L.skyTop = this.bandTop ?? topInset;
    const kbTop = L.bottomInset > 0 ? L.h - L.bottomInset - 12 : Infinity;
    L.skyBottom = Math.max(L.skyTop + 90, Math.min(L.groundY - Math.min(56, L.h * 0.05), kbTop));
    this.pendingResize = false;
  }

  clearGarden() { this.garden = []; this.particles = []; this.rainbow = 0; }

  /** Re-measure labels (e.g. once web fonts have loaded). */
  invalidateLabels() { this.labelCache = new WeakMap(); }

  get flowerCount() { return this.garden.length; }

  // ---------------------------------------------------------- play-along --
  // On the title screen the scene plays with the pointer: Bumble tags along,
  // the sun wakes up, flowers and grass get brushed aside, and tickling a
  // cloud makes the rainbow paint itself again.
  interactive = false;
  /** Little interactions worth a sound. */
  onFun: ((what: 'bee' | 'sun' | 'giggle' | 'rainbow') => void) | null = null;
  private ptr = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, on: false };
  private sunAwake = 0;
  private rainbowBoost = 0;

  pointerMove(x: number, y: number) {
    const p = this.ptr;
    if (!p.on) { p.px = x; p.py = y; p.vx = p.vy = 0; }
    p.x = x; p.y = y; p.on = true;
  }

  pointerLeave() { this.ptr.on = false; }

  /** Keep the sun out from behind something (CSS px x of its left edge), or null. */
  setSunClearOf(x: number | null) { this.scenery.sunClearOf = x; }

  /** A click or tap on the scene. Returns true if it landed on something playful. */
  poke(x: number, y: number): boolean {
    if (!this.interactive) return false;
    this.pointerMove(x, y);
    const b = this.bee;
    if (Math.hypot(x - b.x, y - b.y) < this.beeSize) {
      b.loop = 1; b.mood = 'cheer'; b.moodT = 1.4; b.follow = 4;
      this.onFun?.('bee');
      for (let i = 0; i < 6; i++) this.addSparkle(b.x, b.y, 0.8, '#ffe066');
      return true;
    }
    const s = this.scenery;
    if (s.hitSun(x, y)) {
      if (s.sunWake < 0.5) this.onFun?.('sun');
      s.sunBounce = 1; this.sunAwake = 4;
      for (let i = 0; i < 8; i++) this.addSparkle(s.sunPos.x, s.sunPos.y, 1, '#fff1b0', s.sunPos.r * 2);
      return true;
    }
    const c = s.cloudAt(x, y, this.time);
    if (c) { this.tickle(c, 400); return true; }
    return false;
  }

  /** True while the pointer is over something that reacts to a click. */
  get hot(): boolean {
    const p = this.ptr;
    if (!this.interactive || !p.on) return false;
    return Math.hypot(p.x - this.bee.x, p.y - this.bee.y) < this.beeSize || this.scenery.hitSun(p.x, p.y) || !!this.scenery.cloudAt(p.x, p.y, this.time);
  }

  private get beeSize() { return clamp(Math.min(this.L.w * 0.055, this.L.h * 0.08), 40, 84); }

  private updatePlay(dt: number) {
    const p = this.ptr, s = this.scenery;
    // Raw distance, not velocity: a back-and-forth wiggle averages to zero velocity.
    const moved = Math.hypot(p.x - p.px, p.y - p.py);
    if (dt > 0) {
      const k = Math.min(1, dt * 15);
      p.vx += ((p.x - p.px) / dt - p.vx) * k;
      p.vy += ((p.y - p.py) / dt - p.vy) * k;
    }
    p.px = p.x; p.py = p.y;
    const on = this.interactive && p.on;

    // The sun wakes when you visit, and dozes off a while after you leave.
    if (on && s.hitSun(p.x, p.y)) {
      if (this.sunAwake <= 0 && s.sunWake < 0.3) this.onFun?.('sun');
      this.sunAwake = 2.5;
    }
    this.sunAwake -= dt;
    const awake = this.sunAwake > 0;
    s.sunWake += ((awake ? 1 : 0) - s.sunWake) * Math.min(1, dt * (awake ? 3 : 0.7));
    const look = on ? p : this.bee;
    const sp = s.sunPos;
    const ld = Math.hypot(look.x - sp.x, look.y - sp.y) || 1;
    s.sunLook.x += ((look.x - sp.x) / ld - s.sunLook.x) * Math.min(1, dt * 6);
    s.sunLook.y += ((look.y - sp.y) / ld - s.sunLook.y) * Math.min(1, dt * 6);

    // Wiggling over a cloud tickles it.
    if (on && dt > 0 && moved / dt > 120) {
      const c = s.cloudAt(p.x, p.y, this.time);
      if (c) this.tickle(c, Math.min(moved, 60));
    }
    s.update(dt);
    this.rainbowBoost = Math.max(0, this.rainbowBoost - dt);
    if (!this.interactive) this.bee.follow = 0;
  }

  private tickle(c: Tickleable, amount: number) {
    if (c.jiggle < 0.3) this.onFun?.('giggle');
    c.jiggle = 1;
    c.tickle += amount;
    // Let a fresh rainbow finish painting before it can be redrawn.
    if (c.tickle > 700) { c.tickle = 0; if (this.rainbowBoost < 4.5) this.redrawRainbow(); }
  }

  /** Wipe the rainbow and paint it fresh across the sky. */
  private redrawRainbow() {
    this.rainbow = 0;
    this.rainbowBoost = 7;
    this.onFun?.('rainbow');
    const cols = Object.values(PETALS);
    // Feet are only measured once the rainbow has been drawn; fall back to its span.
    const L = this.L;
    const outer = Math.min(L.w * 0.47, L.groundY * 0.72);
    for (const sg of [-1, 1]) {
      const x = L.w / 2 + sg * outer * 0.9, y = L.groundY - 0.02 * L.h - outer * 0.08;
      for (let i = 0; i < 10; i++) this.addSparkle(x, y, 1.2, cols[i % cols.length].fill, 40);
    }
  }

  /** Flowers lean away from a hovering pointer and wobble when brushed. */
  private pushFlower(f: Planted, x: number, y: number, size: number, dt: number) {
    let lean = 0, brush = 0;
    const p = this.ptr;
    if (this.interactive && p.on) {
      const dx = x - p.x;
      const top = y - size * 1.05;
      const reach = size * 0.4;
      if (Math.abs(dx) < reach && p.y > top && p.y < y + 4) {
        const near = 1 - Math.abs(dx) / reach;
        lean = Math.sign(dx || 1) * near * 0.3;
        brush = p.vx * near * 0.025;
      }
    }
    let a = f.push ?? 0, v = f.pushV ?? 0;
    v += (-(a - lean) * 45 - v * 4.5 + brush) * dt;
    a = clamp(a + v * dt, -0.7, 0.7);
    f.push = a; f.pushV = v;
    // drawFlower turns `sway` into a lean of sway * 0.14 radians.
    return a / 0.14;
  }

  // ------------------------------------------------------------ geometry --
  private laneY(p: Puff, labelH: number): number {
    const L = this.L;
    const r = this.puffRadius(p);
    // Each lane needs room for the puff above and its label below.
    const top = L.skyTop + r * 1.05;
    const bottom = L.skyBottom - labelH - r * 0.7;
    if (p.laneCount <= 1) return lerp(top, Math.max(top, bottom), p.patient ? 0.45 : 0.4);
    return lerp(top, Math.max(top, bottom), p.lane / (p.laneCount - 1));
  }

  private bandHeight() { return this.L.skyBottom - this.L.skyTop; }

  /** How many puff lanes fit comfortably in the sky band. */
  get laneCapacity(): number {
    if (this.pendingResize) this.updateBand();
    return Math.max(1, Math.floor(this.bandHeight() / 100));
  }

  private puffRadius(p: Puff): number {
    const L = this.L;
    if (p.patient) return clamp(Math.min(L.w * 0.09, this.bandHeight() * 0.2), 34, 82);
    const per = this.bandHeight() / Math.max(1, p.laneCount);
    return clamp(per * 0.26, 20, 54);
  }

  private label(p: Puff): LabelLayout {
    let lay = this.labelCache.get(p);
    if (lay) return lay;
    const ctx = this.ctx;
    const L = this.L;
    const per = this.bandHeight() / Math.max(1, p.laneCount);
    let font = p.patient
      ? clamp(Math.min(L.w * 0.11, this.bandHeight() * 0.24), 46, 110) * (p.kind === 'letters' ? 1 : 0.62)
      : clamp(per * 0.3, 18, 40);
    const maxW = L.w * 0.86;
    const emojiFactor = p.emoji ? 1.25 : 0;
    const measure = (f: number) => { ctx.font = `700 ${f}px ${LABEL_FONT}`; return ctx.measureText(p.text).width + emojiFactor * f; };
    while (font > 15 && measure(font) > maxW) font -= 1;
    ctx.font = `700 ${font}px ${LABEL_FONT}`;
    const xs = new Float32Array(p.text.length + 1);
    // Measure prefix widths (accurate kerning) once per puff.
    for (let i = 0; i <= p.text.length; i++) xs[i] = ctx.measureText(p.text.slice(0, i)).width;
    const lines: LabelLayout['lines'] = [];
    const full = xs[p.text.length] + emojiFactor * font;
    if (full <= maxW) lines.push({ start: 0, end: p.text.length, y: 0 });
    else {
      // Wrap after the last space that fits. Every pass must shrink `e`, and
      // every line must advance, or a long sentence would loop forever.
      let s = 0;
      while (s < p.text.length) {
        let e = p.text.length;
        while (e > s + 1 && xs[e] - xs[s] > maxW) {
          const sp = p.text.lastIndexOf(' ', e - 2);
          e = sp >= s ? sp + 1 : e - 1;
        }
        if (e <= s) e = s + 1;
        lines.push({ start: s, end: e, y: lines.length * font * 1.25 });
        s = e;
      }
    }
    let width = 0;
    for (const ln of lines) width = Math.max(width, xs[ln.end] - xs[ln.start]);
    width += emojiFactor * font;
    lay = { font, lines, xs, width, height: lines.length * font * 1.25, emojiW: emojiFactor * font };
    this.labelCache.set(p, lay);
    return lay;
  }

  private puffPos(p: Puff, t: number): { x: number; y: number; r: number; lay: LabelLayout } {
    const L = this.L;
    const lay = this.label(p);
    const r = this.puffRadius(p);
    const half = Math.max(r * 1.1, lay.width / 2 + 18);
    const x0 = L.w - half - 6, x1 = half + 6;
    let x = lerp(x0, x1, p.progress);
    if (p.patient) x = lerp(L.w + r * 2, L.w / 2, Math.min(1, p.progress * 2));
    const bob = this.reducedMotion ? 0 : Math.sin(t * 1.3 + p.seed) * r * 0.12;
    let y = this.laneY(p, lay.height + 22) + bob;
    // fade-in: blown in from slightly right/below
    const fin = easeOutCubic(clamp01(p.age / 0.45));
    if (!p.patient) x += (1 - fin) * 40;
    y += (1 - fin) * 10;
    if (p.shake > 0) x += Math.sin(t * 60) * p.shake * 7;
    return { x, y, r, lay };
  }

  // -------------------------------------------------------------- events --
  handle(events: RoundEvent[], round: Round): void {
    for (const e of events) {
      switch (e.type) {
        case 'key': {
          const { x, y, r } = this.puffPos(e.puff, this.time);
          for (let i = 0; i < 2; i++) this.addSparkle(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.6, 0.5);
          break;
        }
        case 'wrong':
          this.bee.mood = 'oops'; this.bee.moodT = 0.7;
          break;
        case 'complete': this.burst(e.puff, e.flower, e.combo, e.points); break;
        case 'escape': this.bee.mood = 'oops'; this.bee.moodT = 1; break;
        case 'streak': this.bee.loop = 1; this.bee.mood = 'cheer'; this.bee.moodT = 1.6; break;
        case 'level':
          if (e.dir > 0) { this.bee.loop = 1; this.bee.mood = 'cheer'; this.bee.moodT = 2; }
          break;
        case 'ending': this.bee.mood = 'happy'; this.bee.moodT = 3; break;
      }
    }
    void round;
  }

  private burst(p: Puff, flower: FlowerKind, combo: number, points: number): void {
    const { x, y, r } = this.puffPos(p, this.time);
    const n = this.reducedMotion ? 6 : 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const sp = rand(40, 120) * (r / 40);
      this.particles.push({ kind: 'seed', x: x + Math.cos(a) * r * 0.5, y: y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, rot: a + Math.PI / 2, vr: rand(-1, 1), size: r * rand(0.35, 0.55), life: rand(1.4, 2.4), age: 0, color: '' });
    }
    const cols = Object.values(PETALS);
    const sparkles = 8 + Math.min(16, combo);
    for (let i = 0; i < sparkles; i++) this.addSparkle(x, y, 1, cols[i % cols.length].fill, r);
    // The seed that will grow.
    const slot = this.pickSlot(x / this.L.w, flower);
    if (slot) {
      const g = this.slotPos(slot.nx, slot.row);
      this.particles.push({ kind: 'plant', x, y, sx: x, sy: y, tx: g.x, ty: g.y, vx: 0, vy: 0, rot: 0, vr: 0, size: r * 0.7, life: 1.15, age: 0, color: '', flower, row: slot.row, nx: slot.nx });
    }
    this.particles.push({ kind: 'text', x, y: y - r * 0.4, vx: 0, vy: -46, rot: 0, vr: 0, size: clamp(r * (p.golden ? 0.75 : 0.55), 16, 40), life: p.golden ? 1.5 : 1.1, age: 0, color: p.golden ? '#ffe066' : combo >= 10 ? PETALS.coral.fill : PETALS.butter.fill, text: p.golden ? `+${points} ×2` : `+${points}` });
    if (p.golden) for (let i = 0; i < 16; i++) this.addSparkle(x, y, 1.6, '#ffd84a', r * 1.4);
    this.bee.mood = combo >= 10 ? 'cheer' : 'happy';
    this.bee.moodT = 0.9;
    // Gust: nearby flowers sway.
    for (const f of this.garden) {
      const d = Math.abs(f.nx * this.L.w - x) / this.L.w;
      if (d < 0.25) f.sway = Math.max(f.sway, 1 - d * 4);
    }
  }

  private addSparkle(x: number, y: number, scale: number, color = '#fff6c9', spread = 20) {
    const a = Math.random() * Math.PI * 2;
    const sp = rand(30, 140) * scale;
    this.particles.push({ kind: 'sparkle', x: x + Math.cos(a) * spread * 0.3, y: y + Math.sin(a) * spread * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rand(0, 3), vr: rand(-4, 4), size: rand(8, 18) * Math.max(0.6, scale), life: rand(0.5, 0.9), age: 0, color });
  }

  // -------------------------------------------------------------- garden --
  private slotPos(nx: number, row: number) {
    const L = this.L;
    const span = L.h - L.groundY;
    const y = L.groundY + span * (0.1 + row * 0.27);
    return { x: nx * L.w, y };
  }

  private flowerSize(row: number, kind: FlowerKind) {
    const L = this.L;
    const base = clamp(Math.min(L.h * 0.13, L.w * 0.12), 46, 128);
    const rowScale = [0.72, 0.86, 1][row] ?? 1;
    const k = kind === 'sprout' ? 0.55 : kind === 'sunflower' || kind === 'rainbowbloom' ? 1.18 : 1;
    return base * rowScale * k;
  }

  private avoid: [number, number] | null = null;
  /** Keep new flowers out of this x-range (CSS px), e.g. under the keyboard guide. */
  setAvoid(range: [number, number] | null) { this.avoid = range; }

  /** Find a free spot near `nx` (0..1). Gardens fill up, then rarer flowers replace common ones. */
  private pickSlot(nx: number, kind: FlowerKind): { nx: number; row: number } | null {
    const L = this.L;
    const spacing = (row: number) => this.flowerSize(row, 'daisy') * 0.42 / L.w;
    let best: { nx: number; row: number; score: number } | null = null;
    const av = this.avoid;
    for (let tries = 0; tries < 40; tries++) {
      const row = Math.floor(Math.random() * ROWS);
      const cx = clamp(nx + rand(-0.35, 0.35) * (1 + tries / 20), 0.03, 0.97);
      if (av && cx * L.w > av[0] && cx * L.w < av[1]) continue;
      const sp = spacing(row);
      let ok = true;
      for (const f of this.garden) if (f.row === row && Math.abs(f.nx - cx) < sp) { ok = false; break; }
      if (ok) for (const q of this.particles) if (q.kind === 'plant' && q.row === row && Math.abs(q.nx! - cx) < sp) { ok = false; break; }
      if (ok) {
        const score = Math.abs(cx - nx) + row * -0.02 + Math.random() * 0.05;
        if (!best || score < best.score) best = { nx: cx, row, score };
        if (tries > 6) break;
      }
    }
    if (best) return best;
    // Full: replace the commonest flower nearest to nx.
    const rarity = FLOWER_RARITY[kind];
    let victim = -1, vScore = Infinity;
    this.garden.forEach((f, i) => {
      const r = FLOWER_RARITY[f.kind];
      if (r > rarity) return;
      const s = r * 10 + Math.abs(f.nx - nx);
      if (s < vScore) { vScore = s; victim = i; }
    });
    if (victim < 0) return null;
    const v = this.garden.splice(victim, 1)[0];
    return { nx: v.nx, row: v.row };
  }

  private plant(nx: number, row: number, kind: FlowerKind) {
    this.garden.push({ nx, row, kind, seed: Math.floor(Math.random() * 1e6), t0: this.time, sway: 0.6, scale: rand(0.9, 1.08) });
    this.garden.sort((a, b) => a.row - b.row);
    this.onSprout?.();
    const g = this.slotPos(nx, row);
    for (let i = 0; i < 5; i++) {
      this.particles.push({ kind: 'sparkle', x: g.x, y: g.y - 4, vx: rand(-50, 50), vy: rand(-90, -30), rot: 0, vr: rand(-3, 3), size: rand(6, 11), life: 0.7, age: 0, color: '#fff3b0' });
    }
  }

  // Fully grown flowers only sway rigidly about their base, so each one is
  // rendered once to a bitmap (an immutable, GPU-resident ImageBitmap once
  // ready) and blitted with a rotation. That takes hundreds of vector paths
  // per frame off the GPU.
  private sprites = new Map<string, { img: CanvasImageSource; ox: number; oy: number; w: number; h: number }>();
  private drawFlowerSprite(f: Planted, x: number, y: number, size: number, t: number, impulse: number) {
    const key = `${f.kind}|${f.seed}|${Math.round(size)}`;
    let s = this.sprites.get(key);
    if (!s) {
      const w = Math.ceil(size * 1.7), h = Math.ceil(size * 1.5);
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * this.dpr); c.height = Math.ceil(h * this.dpr);
      const g = c.getContext('2d')!;
      g.scale(this.dpr, this.dpr);
      const ox = w / 2, oy = h - size * 0.18;
      drawFlower(g, { kind: f.kind, x: ox, y: oy, size, growth: 1, time: 0, seed: f.seed, still: true });
      const entry = { img: c as CanvasImageSource, ox, oy, w, h };
      s = entry;
      if (this.sprites.size > 300) { let n = 0; for (const k of this.sprites.keys()) { if (n++ > 80) break; this.sprites.delete(k); } }
      this.sprites.set(key, entry);
      if (typeof createImageBitmap === 'function') createImageBitmap(c).then((b) => { entry.img = b; }).catch(() => {});
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.reducedMotion ? 0 : flowerSwayAngle(f.seed, t, impulse));
    ctx.drawImage(s.img, -s.ox, -s.oy, s.w, s.h);
    ctx.restore();
  }

  private resetAtlas() { this.sprites.clear(); }

  /** Plant instantly (used to pre-fill the title-screen garden). */
  seedGarden(n: number) {
    const kinds: FlowerKind[] = ['daisy', 'tulip', 'poppy', 'buttercup', 'bluebell', 'lavender', 'sunflower', 'pansy', 'rose', 'forgetmenot', 'starbloom', 'dahlia'];
    for (let i = 0; i < n; i++) {
      const s = this.pickSlot(rand(0.03, 0.97), 'daisy');
      if (s) this.garden.push({ nx: s.nx, row: s.row, kind: kinds[i % kinds.length], seed: i * 97 + 5, t0: -10, sway: 0, scale: rand(0.9, 1.08) });
    }
    this.garden.sort((a, b) => a.row - b.row);
  }

  // -------------------------------------------------------------- render --
  render(dt: number, round: Round | null, opts: { day: number; combo: number; showBee?: boolean }): void {
    if (this.pendingResize) this.updateBand();
    this.time += dt;
    const t = this.time;
    const ctx = this.ctx;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.updatePlay(dt);

    this.scenery.drawBack(ctx, t, opts.day);
    const rainbowTarget = Math.max(opts.combo >= 8 ? clamp01((opts.combo - 6) / 14) : 0, this.rainbowBoost > 0 ? 1 : 0);
    this.rainbow += (rainbowTarget - this.rainbow) * Math.min(1, dt * 1.5);
    if (this.rainbow > 0.01) this.scenery.drawRainbow(ctx, this.rainbow, t);

    // garden
    for (const f of this.garden) {
      f.sway = Math.max(0, f.sway - dt * 0.8);
      const g = this.slotPos(f.nx, f.row);
      const growth = clamp01((t - f.t0) / 1.5);
      const size = this.flowerSize(f.row, f.kind) * f.scale;
      const impulse = this.reducedMotion ? 0 : Math.sin(t * 5 + f.nx * 20) * f.sway + this.pushFlower(f, g.x, g.y, size, dt);
      if (growth >= 1 && FLOWER_RARITY[f.kind] < 4) this.drawFlowerSprite(f, g.x, g.y, size, t, impulse);
      else drawFlower(ctx, { kind: f.kind, x: g.x, y: g.y, size, growth, time: t, seed: f.seed, sway: impulse });
    }
    this.drawButterflies(dt);
    this.scenery.drawFront(ctx, t, this.interactive && this.ptr.on && !this.reducedMotion ? this.ptr : null);

    // puffs
    if (round) {
      for (const p of round.puffs) this.drawPuffAndLabel(p, t, round.target === p);
    }
    this.updateParticles(dt);
    if (opts.showBee !== false) this.drawBumble(dt, round);
    void L;
  }

  private drawPuffAndLabel(p: Puff, t: number, targeted: boolean) {
    const ctx = this.ctx;
    const { x, y, r, lay } = this.puffPos(p, t);
    const fin = clamp01(p.age / 0.45);
    let alpha = fin;
    let dy = 0;
    let labelAlpha = fin;
    if (p.state === 'pop') {
      alpha = 0;
      labelAlpha = 1 - clamp01(p.stateT / 0.45);
      dy = -easeOutCubic(clamp01(p.stateT / 0.45)) * 18;
    } else if (p.state === 'escape' || p.state === 'leave') {
      const k = clamp01(p.stateT / 1.3);
      alpha = 1 - k;
      labelAlpha = 1 - clamp01(p.stateT / 0.5);
      dy = -easeOutCubic(k) * 120;
    }
    const urgency = p.patient || p.state !== 'fly' ? 0 : clamp01((p.progress - 0.72) / 0.28);
    if (alpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const ex = p.state === 'escape' || p.state === 'leave' ? -easeOutCubic(clamp01(p.stateT / 1.3)) * 60 : 0;
      if (p.golden) this.drawGoldenAura(x + ex, y + dy, r, t);
      drawPuff(ctx, { x: x + ex, y: y + dy, radius: r, time: t, seed: p.seed, target: targeted ? 1 : 0, shake: p.shake, urgency });
      ctx.restore();
    }
    if (labelAlpha > 0.01) this.drawLabel(p, x, y + r * 1.02 + dy, lay, labelAlpha, t, targeted, urgency);
  }

  private drawLabel(p: Puff, cx: number, top: number, lay: LabelLayout, alpha: number, t: number, targeted: boolean, urgency: number) {
    const ctx = this.ctx;
    const padX = lay.font * 0.42, padY = lay.font * 0.26;
    let w = lay.width + padX * 2;
    let h = lay.height + padY * 2 - lay.font * 0.25 * (lay.lines.length > 1 ? 1 : 0);
    // Single letters sit in a round badge.
    if (p.text.length === 1 && !p.emoji) { h *= 0.9; w = h; }
    const x = cx - w / 2;
    const pop = p.state === 'pop' ? 1 + easeOutBack(clamp01(p.stateT / 0.3)) * 0.08 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, top + h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-cx, -(top + h / 2));
    // string from puff to tag
    ctx.strokeStyle = 'rgba(122, 96, 140, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, top - lay.font * 0.35); ctx.lineTo(cx, top + 2); ctx.stroke();
    // tag
    roundRect(ctx, x, top, w, h, Math.min(h / 2, lay.font * 0.55));
    ctx.fillStyle = targeted ? 'rgba(255, 252, 240, 0.97)' : 'rgba(255, 250, 240, 0.9)';
    ctx.fill();
    ctx.lineWidth = targeted ? 3 : 2;
    ctx.strokeStyle = p.golden ? '#f2b705' : targeted ? '#ffc94a' : urgency > 0 ? mixHex('#d9c7e8', '#ff9a8a', urgency) : 'rgba(185, 156, 210, 0.7)';
    if (p.golden) ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.font = `700 ${lay.font}px ${LABEL_FONT}`;
    ctx.textBaseline = 'alphabetic';
    let tx = cx - lay.width / 2;
    if (p.emoji) {
      ctx.font = `${lay.font * 0.95}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
      ctx.fillText(p.emoji, tx, top + padY + lay.font * 0.86);
      tx += lay.emojiW;
      ctx.font = `700 ${lay.font}px ${LABEL_FONT}`;
    }
    const baseY = top + padY + lay.font * 0.82;
    for (const ln of lay.lines) {
      const lineW = lay.xs[ln.end] - lay.xs[ln.start];
      const ox = lay.lines.length > 1 ? x + (w - lineW) / 2 - lay.xs[ln.start] : tx - lay.xs[ln.start];
      for (let i = ln.start; i < ln.end; i++) {
        const ch = p.text[i];
        const cxp = ox + lay.xs[i];
        const cy = baseY + ln.y;
        if (i < p.typed) {
          ctx.fillStyle = TYPED;
          ctx.fillText(ch, cxp, cy);
        } else if (p.hidden && p.state === 'fly') {
          this.drawHiddenSlot(p, ch, i, cxp, cy, lay, alpha, t);
        } else if (i === p.typed && p.state === 'fly') {
          const cw = lay.xs[i + 1] - lay.xs[i];
          const hop = this.reducedMotion ? 0 : Math.sin(t * 6) * lay.font * 0.03;
          ctx.fillStyle = targeted || p.typed === 0 ? NEXT : INK;
          if (ch === ' ') {
            ctx.globalAlpha = alpha * 0.8;
            ctx.beginPath(); ctx.arc(cxp + cw / 2, cy - lay.font * 0.28, lay.font * 0.09, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = alpha;
          } else ctx.fillText(ch, cxp, cy + hop);
          // caret underline
          ctx.fillStyle = NEXT;
          ctx.globalAlpha = alpha * (0.55 + 0.45 * Math.sin(t * 6));
          roundRect(ctx, cxp + cw * 0.08, cy + lay.font * 0.12, Math.max(cw * 0.84, lay.font * 0.3), Math.max(2.5, lay.font * 0.08), 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
        } else {
          ctx.fillStyle = INK;
          ctx.fillText(ch, cxp, cy);
        }
      }
    }
    ctx.restore();
  }

  /**
   * Spelling Bee: a letter still to spell is a blank slot. The next one has the
   * blinking caret, a brief coral flash of a wrong guess, and, when the player
   * is stuck, its letter slowly fading in.
   */
  private drawHiddenSlot(p: Puff, ch: string, i: number, x: number, y: number, lay: LabelLayout, alpha: number, t: number) {
    const ctx = this.ctx;
    const cw = lay.xs[i + 1] - lay.xs[i];
    const lineH = Math.max(2.5, lay.font * 0.08);
    const lineX = x + cw * 0.1, lineW = Math.max(cw * 0.8, lay.font * 0.3), lineY = y + lay.font * 0.12;
    if (i !== p.typed) {
      ctx.fillStyle = INK;
      ctx.globalAlpha = alpha * 0.3;
      roundRect(ctx, lineX, lineY, lineW, lineH, 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      return;
    }
    const hint = p.hint ?? 0;
    if (hint > 0) {
      ctx.fillStyle = NEXT;
      ctx.globalAlpha = alpha * 0.85 * easeInOut(hint);
      ctx.fillText(ch, x, y);
    }
    const wt = p.wrongT ?? Infinity;
    if (p.wrongCh && wt < 0.7) {
      ctx.fillStyle = PETALS.coral.fill;
      ctx.globalAlpha = alpha * (1 - wt / 0.7);
      ctx.fillText(p.wrongCh.toLowerCase(), x, y - wt * lay.font * 0.4);
    }
    ctx.fillStyle = NEXT;
    ctx.globalAlpha = alpha * (0.55 + 0.45 * Math.sin(t * 6));
    roundRect(ctx, lineX, lineY, lineW, lineH, 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }

  private updateParticles(dt: number) {
    const ctx = this.ctx;
    const out: Particle[] = [];
    for (const q of this.particles) {
      q.age += dt;
      if (q.age >= q.life) {
        if (q.kind === 'plant' && q.flower !== undefined) this.plant(q.nx!, q.row!, q.flower);
        continue;
      }
      const k = q.age / q.life;
      switch (q.kind) {
        case 'seed':
          q.vx *= 1 - dt * 1.4; q.vy = q.vy * (1 - dt * 1.4) - 14 * dt;
          q.x += q.vx * dt + Math.sin(q.age * 3 + q.rot) * 12 * dt; q.y += q.vy * dt;
          q.rot += q.vr * dt;
          drawSeed(ctx, q.x, q.y, q.size, Math.sin(q.age * 2 + q.rot) * 0.5, 1 - k);
          break;
        case 'sparkle':
          q.vx *= 1 - dt * 3; q.vy *= 1 - dt * 3; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
          this.drawSparkleSprite(q.x, q.y, q.size * (1 - k * 0.6), q.rot, q.color, 1 - k * k);
          break;
        case 'plant': {
          const e = easeInOut(k);
          const x = lerp(q.sx!, q.tx!, e) + Math.sin(k * Math.PI * 2.5) * 24 * (1 - k);
          const y = lerp(q.sy!, q.ty!, e) - Math.sin(k * Math.PI) * 30;
          drawSeed(ctx, x, y, q.size, Math.sin(k * 9) * 0.4, 1);
          break;
        }
        case 'text': {
          q.y += q.vy * dt; q.vy *= 1 - dt * 1.5;
          const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
          const s = 0.7 + easeOutBack(clamp01(k * 4)) * 0.3;
          // Rendered once to a bitmap: animating font sizes would re-rasterise glyphs every frame.
          q.img ??= this.textSprite(q.text!, q.size, q.color);
          const iw = q.img.width / this.dpr, ih = q.img.height / this.dpr;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(q.x, q.y - q.size * 0.35);
          ctx.scale(s, s);
          ctx.drawImage(q.img, -iw / 2, -ih / 2, iw, ih);
          ctx.restore();
          break;
        }
      }
      out.push(q);
    }
    this.particles = out;
  }

  private auraSprite: HTMLCanvasElement | null = null;
  /** Warm, breathing halo with orbiting twinkles for golden dandelions. */
  private drawGoldenAura(x: number, y: number, r: number, t: number) {
    if (!this.auraSprite) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(128, 128, 20, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255, 222, 100, 1)');
      grad.addColorStop(0.5, 'rgba(255, 200, 60, 0.6)');
      grad.addColorStop(1, 'rgba(255, 190, 60, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      this.auraSprite = c;
    }
    const ctx = this.ctx;
    const s = r * (2.1 + Math.sin(t * 3) * 0.15);
    ctx.drawImage(this.auraSprite, x - s, y - s, s * 2, s * 2);
    for (let i = 0; i < 3; i++) {
      const a = t * 1.6 + (i * Math.PI * 2) / 3;
      this.drawSparkleSprite(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 1.25, r * 0.35 * (0.8 + 0.4 * Math.sin(t * 5 + i)), a, '#ffd84a', 0.95);
    }
  }

  private sparkleCache = new Map<string, HTMLCanvasElement>();
  private drawSparkleSprite(x: number, y: number, size: number, rot: number, color: string, alpha: number) {
    if (alpha <= 0.01 || size <= 0.5) return;
    let c = this.sparkleCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      drawSparkle(c.getContext('2d')!, 32, 32, 60, 0, color, 1);
      this.sparkleCache.set(color, c);
    }
    const ctx = this.ctx;
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    const cos = Math.cos(rot) * size / 60, sin = Math.sin(rot) * size / 60;
    ctx.setTransform(this.dpr * cos, this.dpr * sin, -this.dpr * sin, this.dpr * cos, this.dpr * x, this.dpr * y);
    ctx.drawImage(c, -32, -32);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = prev;
  }

  private textSprite(text: string, size: number, color: string): HTMLCanvasElement {
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    const font = `700 ${size}px ${UI_FONT}`;
    g.font = font;
    const w = Math.ceil(g.measureText(text).width + 14), h = Math.ceil(size * 1.5);
    c.width = Math.ceil(w * this.dpr); c.height = Math.ceil(h * this.dpr);
    g.scale(this.dpr, this.dpr);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(61,44,78,0.85)';
    g.strokeText(text, w / 2, h / 2);
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
    return c;
  }

  private drawButterflies(dt: number) {
    const L = this.L;
    const p = this.ptr;
    for (const b of this.butterflies) {
      b.t += dt;
      // Shy: flutter off when the pointer comes close.
      if (this.interactive && p.on && Math.hypot(b.x * L.w - p.x, b.y * L.h - p.y) < 60) {
        const dx = b.x * L.w - p.x || 1;
        b.tx = clamp(b.x + Math.sign(dx) * rand(0.15, 0.3), 0.05, 0.95);
        b.ty = rand((L.groundY - 90) / L.h, (L.groundY - 30) / L.h);
      }
      if (Math.hypot(b.tx - b.x, (b.ty - b.y) * (L.h / L.w)) < 0.02) {
        b.tx = rand(0.05, 0.95);
        b.ty = rand((L.groundY - 70) / L.h, (L.groundY + 10) / L.h);
      }
      const px = b.x;
      b.x += (b.tx - b.x) * dt * 0.35;
      b.y += (b.ty - b.y) * dt * 0.35;
      const x = b.x * L.w, y = b.y * L.h + Math.sin(b.t * 2.4) * 12;
      drawButterfly(this.ctx, { x, y, size: clamp(L.w * 0.022, 18, 30), time: b.t, seed: b.seed, facing: b.x >= px ? 1 : -1 });
    }
  }

  private drawBumble(dt: number, round: Round | null) {
    const L = this.L;
    const b = this.bee;
    const size = this.beeSize;
    let tx = L.w * 0.1 + Math.sin(this.time * 0.5) * L.w * 0.03;
    let ty = L.skyTop + size * 0.6 + Math.sin(this.time * 0.9) * 14;
    const tgt = round?.target;
    if (tgt && tgt.state === 'fly') {
      const pp = this.puffPos(tgt, this.time);
      tx = pp.x - pp.r - size * 0.9;
      ty = pp.y - pp.r * 0.3;
      if (tx < size) tx = pp.x + pp.r + size * 0.9;
    } else if (round && round.puffs.length && round.phase === 'play') {
      const first = round.puffs.find((p) => p.state === 'fly');
      if (first && first.patient) {
        const pp = this.puffPos(first, this.time);
        tx = pp.x - pp.r - size * 1.2;
        ty = pp.y - pp.r * 0.6;
      }
    }
    // Say hello to Bumble and it tags along until you stop moving.
    const p = this.ptr;
    if (this.interactive && p.on) {
      const near = Math.hypot(p.x - b.x, p.y - b.y) < size;
      if (near && b.follow <= 0 && Math.hypot(p.vx, p.vy) > 30) { b.follow = 3; b.mood = 'happy'; b.moodT = 1; this.onFun?.('bee'); }
      if (b.follow > 0 && Math.hypot(p.vx, p.vy) > 30) b.follow = Math.max(b.follow, 3);
    }
    const following = b.follow > 0 && this.interactive;
    if (following) {
      b.follow -= dt;
      const side = b.x < p.x ? -1 : 1;
      tx = p.x + side * size * 0.85;
      ty = p.y - size * 0.35 + Math.sin(this.time * 3) * size * 0.12;
      if (b.moodT <= 0) { b.mood = 'happy'; b.moodT = 0.5; }
    }
    if (b.loop > 0) {
      b.loop = Math.max(0, b.loop - dt * 0.9);
      const a = (1 - b.loop) * Math.PI * 2;
      tx += Math.sin(a) * size * 1.2;
      ty -= (1 - Math.cos(a)) * size * 0.8;
    }
    // critically damped spring
    const k = following ? 6 : 9, d = 2 * Math.sqrt(k);
    b.vx += ((tx - b.x) * k - b.vx * d) * dt;
    b.vy += ((ty - b.y) * k - b.vy * d) * dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (following && Math.abs(b.vx) < 60) b.facing = p.x > b.x ? 1 : -1;
    else if (Math.abs(b.vx) > 25) b.facing = b.vx > 0 ? 1 : -1;
    b.moodT -= dt;
    if (b.moodT <= 0) b.mood = round && round.stats.combo >= 10 ? 'happy' : 'idle';
    drawBee(this.ctx, { x: b.x, y: b.y, size, time: this.time, mood: b.mood, facing: b.facing, tilt: clamp(b.vx / 900, -0.35, 0.35) });
  }

  /** Bee position (for DOM speech bubbles). */
  get beePos() { return { x: this.bee.x, y: this.bee.y }; }
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
function rand(a: number, b: number) { return a + Math.random() * (b - a); }
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mixHex(a: string, b: string, t: number) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(lerp((A >> s) & 255, (B >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

