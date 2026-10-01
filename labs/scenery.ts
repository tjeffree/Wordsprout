import { Scenery } from '../src/art/scenery';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const daySlider = document.getElementById('day') as HTMLInputElement;
const dayV = document.getElementById('dayv')!;
const rb = document.getElementById('rb') as HTMLInputElement;
const anim = document.getElementById('anim') as HTMLInputElement;
const fpsEl = document.getElementById('fps')!;

const params = new URLSearchParams(location.search);
if (params.has('day')) daySlider.value = params.get('day')!;
if (params.get('rainbow') === '1') rb.checked = true;
anim.checked = false;
if (params.get('hideui') === '1') document.getElementById('ui')!.style.display = 'none';
const fixedTime = params.has('t') ? Number(params.get('t')) : null;

let scenery: Scenery | null = null;
let W = 0;
let H = 0;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const layout = { width: W, height: H, groundY: H * 0.8 };
  if (scenery) scenery.resize(layout);
  else scenery = new Scenery(layout);
}
window.addEventListener('resize', resize);
resize();

let rainbowK = rb.checked ? 1 : 0;
let last = performance.now();
let frames = 0;
let acc = 0;
const t0 = last;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frames++;
  acc += dt;
  if (acc >= 0.5) {
    fpsEl.textContent = `${Math.round(frames / acc)} fps`;
    frames = 0;
    acc = 0;
  }
  if (anim.checked) {
    let v = Number(daySlider.value) + dt / 30;
    if (v > 1) v = 0;
    daySlider.value = String(v);
  }
  const day = Number(daySlider.value);
  dayV.textContent = day.toFixed(2);
  rainbowK += ((rb.checked ? 1 : 0) - rainbowK) * Math.min(1, dt * 1.5);
  const time = fixedTime ?? (now - t0) / 1000;

  const dpr = canvas.width / W;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scenery!.drawBack(ctx, time, day);
  if (rainbowK > 0.003) scenery!.drawRainbow(ctx, rainbowK, time);
  scenery!.drawFront(ctx, time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
