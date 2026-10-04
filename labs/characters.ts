import { drawBee, drawPuff, drawSeed, drawButterfly, drawSparkle, PUFF_STYLES, type BeeMood, type PuffStyle } from '../src/art/characters';
import { HATS, EXTRAS, type HatId, type ExtraId } from '../src/art/outfits';
import { INK } from '../src/art/palette';

// ?view=orig|hats|extras|combos|puffs  (default orig)   ?t=<seconds> freezes time
const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'orig';
const fixedT = params.has('t') ? Number(params.get('t')) : null;

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 0;
let H = 0;
let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
}
window.addEventListener('resize', resize);
resize();

const moods: BeeMood[] = ['idle', 'happy', 'cheer', 'oops', 'sleepy'];
let frames = 0;
let fpsT = performance.now();
let fps = 0;

function label(s: string, x: number, y: number) {
  ctx.fillStyle = INK;
  ctx.font = '600 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s, x, y);
}

function outfitGrid<T extends string>(items: readonly T[], t: number, wear: (v: T) => { hat?: HatId; extra?: ExtraId }) {
  const cw = Math.min(200, W / items.length);
  items.forEach((it, i) => {
    const cx = cw * (i + 0.5);
    const o = wear(it);
    label(it, cx, 22);
    drawBee(ctx, { x: cx, y: 120, size: 120, time: t, mood: 'idle', facing: 1, ...o });
    drawBee(ctx, { x: cx, y: 300, size: 120, time: t + 0.7, mood: 'cheer', facing: -1, ...o });
    drawBee(ctx, { x: cx - 45, y: 440, size: 60, time: t + 0.3, mood: 'happy', facing: 1, ...o });
    drawBee(ctx, { x: cx + 45, y: 440, size: 60, time: t + 1.1, mood: 'oops', facing: -1, ...o });
    drawBee(ctx, { x: cx - 45, y: 540, size: 60, time: t + 0.5, mood: 'sleepy', facing: 1, ...o });
    drawBee(ctx, { x: cx + 45, y: 540, size: 44, time: t + 2, mood: 'idle', facing: -1, tilt: 0.15, ...o });
    drawBee(ctx, { x: cx, y: 680, size: 84, time: t + 0.2, mood: 'happy', facing: 1, tilt: -0.12, ...o });
    drawBee(ctx, { x: cx, y: 800, size: 40, time: t + 0.9, mood: 'cheer', facing: 1, ...o });
  });
}

const COMBOS: { hat: HatId; extra: ExtraId }[] = [
  { hat: 'crown', extra: 'cape' },
  { hat: 'graduation', extra: 'specs' },
  { hat: 'party', extra: 'bowtie' },
  { hat: 'sunhat', extra: 'heartglasses' },
  { hat: 'wizard', extra: 'scarf' },
  { hat: 'flowercrown', extra: 'lei' },
  { hat: 'tophat', extra: 'bowtie' },
];

function fakeTag(x: number, top: number, word: string, targeted: boolean) {
  ctx.font = '700 20px sans-serif';
  const w = ctx.measureText(word).width + 18;
  const h = 30;
  ctx.strokeStyle = 'rgba(122, 96, 140, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, top - 7); ctx.lineTo(x, top + 2); ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, h, 11);
  ctx.fillStyle = 'rgba(255, 250, 240, 0.92)';
  ctx.fill();
  ctx.lineWidth = targeted ? 3 : 2;
  ctx.strokeStyle = targeted ? '#ffc94a' : 'rgba(185, 156, 210, 0.7)';
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.fillText(word, x, top + 22);
}

function puffGrid(t: number) {
  const cw = Math.min(250, W / PUFF_STYLES.length);
  const rows: { r: number; target: number; urgency?: number; shake?: number; name: string }[] = [
    { r: 30, target: 0, name: 'r30' },
    { r: 30, target: 1, name: 'r30 target' },
    { r: 54, target: 0, name: 'r54' },
    { r: 54, target: 1, name: 'r54 target' },
    { r: 54, target: 0, urgency: 0.9, name: 'r54 urgency' },
    { r: 54, target: 1, shake: (Math.sin(t * 2) + 1) / 2, name: 'r54 shake' },
  ];
  let y = 60;
  rows.forEach((row, ri) => {
    y += row.r * 1.5;
    PUFF_STYLES.forEach((st: PuffStyle, i) => {
      const cx = cw * (i + 0.5);
      if (ri === 0) label(st, cx, 20);
      drawPuff(ctx, { x: cx, y, radius: row.r, time: t, seed: i * 3 + ri + 1, target: row.target, urgency: row.urgency, shake: row.shake, style: st });
      fakeTag(cx, y + row.r * 1.02, row.r < 40 ? 'cat' : 'flower', row.target > 0);
    });
    label(row.name, 40, y - row.r);
    y += row.r * 1.02 + 50;
  });
}

function frame(now: number) {
  const t = fixedT ?? now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8fc8ff');
  g.addColorStop(1, '#ffe3c9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (view !== 'orig') {
    if (view === 'hats') outfitGrid(HATS, t, (h) => ({ hat: h }));
    else if (view === 'extras') outfitGrid(EXTRAS, t, (e) => ({ extra: e }));
    else if (view === 'combos') outfitGrid(COMBOS.map((c) => c.hat + '+' + c.extra), t, (k) => { const [hat, extra] = k.split('+') as [HatId, ExtraId]; return { hat, extra }; });
    else if (view === 'puffs') puffGrid(t);
    if (fixedT === null) requestAnimationFrame(frame);
    return;
  }

  // bees: big row (facing right then left alternating), small row
  const cw = W / 5;
  moods.forEach((m, i) => {
    const cx = cw * (i + 0.5);
    drawBee(ctx, { x: cx - 50, y: 100, size: 110, time: t, mood: m, facing: 1 });
    drawBee(ctx, { x: cx + 55, y: 100, size: 50, time: t + 1, mood: m, facing: -1, tilt: 0.15 });
    label(m, cx, 175);
  });

  // puffs
  const rows: [number, number[]][] = [
    [30, [0, 0.5, 1]],
    [50, [0, 0.5, 1]],
    [80, [0, 0.5, 1]],
  ];
  let px = 90;
  rows.forEach(([r, targets], ri) => {
    targets.forEach((tg, ti) => {
      const x = px + ti * (r * 2 + 40);
      drawPuff(ctx, { x, y: 330 + (ri === 2 ? 20 : 0), radius: r, time: t, seed: ri * 3 + ti + 1, target: tg });
      label(`r${r} target ${tg}`, x, 330 + r * 2 + 40);
    });
    px += targets.length * (r * 2 + 40) + 20;
  });
  const sx = px + 20;
  drawPuff(ctx, { x: sx + 20, y: 330, radius: 50, time: t, seed: 21, shake: (Math.sin(t * 2) + 1) / 2 });
  label('shake', sx + 20, 330 + 140);
  drawPuff(ctx, { x: sx + 170, y: 330, radius: 50, time: t, seed: 22, urgency: 0.9 });
  label('urgency', sx + 170, 330 + 140);

  // seeds
  const sy = 650;
  for (let i = 0; i < 8; i++) {
    drawSeed(ctx, 60 + i * 70, sy, i < 4 ? 30 : 56, (i - 3.5) * 0.45 + Math.sin(t + i) * 0.1, 1);
  }
  label('seeds', 60 + 3.5 * 70, sy + 50);

  // butterflies
  drawButterfly(ctx, { x: 760, y: 640, size: 60, time: t, seed: 1.3, facing: 1 });
  drawButterfly(ctx, { x: 880, y: 680, size: 44, time: t, seed: 4.7, facing: -1 });
  drawButterfly(ctx, { x: 1000, y: 640, size: 70, time: t, seed: 9.1, facing: 1 });

  // sparkles
  const cols = ['#fff3a8', '#ffd45c', '#ff9ec7', '#ffffff', '#b99cff', '#7ee0c3'];
  for (let i = 0; i < 12; i++) {
    const s = 10 + (i % 4) * 8;
    drawSparkle(ctx, 80 + i * 50, 780, s, t * 0.8 + i, cols[i % cols.length], 0.6 + 0.4 * Math.sin(t * 3 + i));
  }

  frames++;
  if (now - fpsT > 500) {
    fps = (frames * 1000) / (now - fpsT);
    frames = 0;
    fpsT = now;
  }
  ctx.fillStyle = 'rgba(61,44,78,0.8)';
  ctx.fillRect(W - 90, 8, 82, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '600 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(fps.toFixed(0) + ' fps', W - 49, 25);

  if (fixedT === null) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
