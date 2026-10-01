// Measures frame times in a real (headed, GPU) Chromium during a busy round.
// usage: node scripts/perf.mjs [width] [height] [dpr]
import { chromium } from '@playwright/test';

const [W = '1920', H = '1080', DPR = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ headless: false, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +DPR });
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.waitForTimeout(1000);
const FULL = !!process.env.FULL;
if (process.env.NOP) await page.evaluate(() => { window.__noP = 1; });
if (process.env.NOS) await page.evaluate(() => { window.__noS = 1; });
if (process.env.NOD) await page.evaluate(() => { window.__noD = 1; });
if (process.env.NOHUD) await page.addStyleTag({ content: '.hud{display:none!important}' });
await page.evaluate(([FULL, MUTE]) => {
  const g = window.__game; g.store._reset();
  if (MUTE) g.store.updateSettings({ sound: false, music: false });
  g.store.createProfile('Perf', 'B', 20); g.startRound('summer');
  if (FULL) g.renderer.seedGarden(110);
}, [FULL, !!process.env.MUTE]);
const gpu = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl');
  const d = c && c.getExtension('WEBGL_debug_renderer_info');
  return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('GPU:', gpu);
// Type for 25s to fill the garden and keep particles busy.
const end = Date.now() + 25000;
await page.evaluate(() => {
  window.__frames = []; window.__prof = {};
  let last = performance.now();
  const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
while (Date.now() < end && !process.env.IDLE && !process.env.INPAGE) {
  const ch = await page.evaluate(() => window.__game.round?.nextChar ?? null);
  if (ch) await page.keyboard.press(ch === ' ' ? 'Space' : ch);
  await page.waitForTimeout(40);
}
if (process.env.INPAGE) await page.evaluate(() => { setInterval(() => { const r = window.__game.round; const ch = r?.nextChar; if (ch) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); }, 40); });
if (process.env.IDLE || process.env.INPAGE) await page.waitForTimeout(15000);
const stats = await page.evaluate(() => {
  const f = window.__frames.slice(30).sort((a, b) => a - b);
  const pct = (p) => f[Math.floor(f.length * p)].toFixed(1);
  console.log(JSON.stringify(window.__prof));
  return { prof: window.__prof, frames: f.length, median: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: f[f.length - 1].toFixed(1), flowers: window.__game.renderer.flowerCount };
});
console.log(JSON.stringify(stats));
await browser.close();
