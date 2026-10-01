import { drawBee, drawPuff, drawSeed, drawButterfly, drawSparkle, type BeeMood } from '../src/art/characters';
import { INK } from '../src/art/palette';

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

function frame(now: number) {
  const t = now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8fc8ff');
  g.addColorStop(1, '#ffe3c9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

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

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
