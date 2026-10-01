import { drawFlower, FLOWER_RARITY, type FlowerKind } from '../src/art/flowers';
import { HILLS, INK, CREAM } from '../src/art/palette';

const KINDS: FlowerKind[] = ['sprout', 'daisy', 'clover', 'tulip', 'poppy', 'bluebell', 'lavender', 'sunflower', 'rose', 'starbloom', 'rainbowbloom'];
const ROWS = [0.2, 0.45, 0.7, 1.0, -1, -2]; // -1 = animating at growth 1 (sway), -2 = looping growth
const params = new URLSearchParams(location.search);
const stress = params.get('stress') === '1';
const frozen = params.get('t');

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 0, H = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const stressList = Array.from({ length: 120 }, (_, i) => ({
  kind: KINDS[(i * 7 + (i >> 2)) % KINDS.length],
  x: Math.random(), y: Math.random(),
  size: 30 + Math.random() * 130, seed: (Math.random() * 1e6) | 0,
}));

let frames = 0, fps = 0, last = performance.now(), acc = 0;
(window as unknown as { __fps: number }).__fps = 0;

function ground(y: number, x0: number, x1: number) {
  ctx.fillStyle = HILLS[1];
  ctx.fillRect(x0, y, x1 - x0, 6);
  ctx.fillStyle = HILLS[0];
  ctx.fillRect(x0, y, x1 - x0, 2);
}

function frame(now: number) {
  const dt = now - last; last = now; acc += dt; frames++;
  if (acc > 500) { fps = Math.round((frames * 1000) / acc); (window as unknown as { __fps: number }).__fps = fps; frames = 0; acc = 0; }
  const time = frozen ? parseFloat(frozen) : now / 1000;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);

  if (stress) {
    for (const f of stressList) {
      drawFlower(ctx, { kind: f.kind, x: 30 + f.x * (W - 60), y: 180 + f.y * (H - 200), size: f.size, growth: 1, time, seed: f.seed });
    }
  } else {
    const labelW = 70, top = 34;
    const cw = (W - labelW) / KINDS.length;
    const rh = (H - top) / ROWS.length;
    ctx.font = '600 12px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.fillStyle = INK;
    KINDS.forEach((k, i) => ctx.fillText(`${k} (${FLOWER_RARITY[k]})`, labelW + cw * (i + 0.5), 20));
    ROWS.forEach((g, r) => {
      const gy = top + rh * (r + 1) - 14;
      ground(gy, labelW - 10, W);
      ctx.textAlign = 'left'; ctx.fillStyle = INK;
      ctx.fillText(g >= 0 ? `growth ${g}` : g === -1 ? 'sway' : 'loop', 8, gy - 10);
      const size = Math.min(rh * 0.82, cw * 1.15);
      KINDS.forEach((k, i) => {
        let growth = g;
        if (g === -1) growth = 1;
        if (g === -2) growth = ((time + i * 0.25) % 4) / 3; // 0..1.33 -> holds at 1
        if (growth > 1) growth = 1;
        drawFlower(ctx, { kind: k, x: labelW + cw * (i + 0.5), y: gy, size, growth, time, seed: 11 + i * 5 + r * 2 });
      });
    });
  }
  ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = '600 14px Fredoka, system-ui, sans-serif';
  ctx.fillText(`${fps} fps${stress ? ' (stress: 120 flowers)' : ''}`, W - 10, H - 8);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
