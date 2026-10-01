// Visual QA for the title-screen play-along. usage: node scripts/play-qa.mjs [outdir] [width] [height]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.argv[2] ?? 'shots';
const W = +(process.argv[3] ?? 1280), H = +(process.argv[4] ?? 800);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.waitForTimeout(1500);
const shot = (n) => page.screenshot({ path: `${out}/play-${n}-${W}.png` });
const R = () => page.evaluate(() => {
  const r = window.__game.renderer;
  return { sun: r.scenery.sunPos, bee: r.beePos, wake: r.scenery.sunWake, L: r.layout };
});

let s = await R();
await shot('0-before');
// Wake the sun.
await page.mouse.move(s.sun.x, s.sun.y, { steps: 5 });
await page.waitForTimeout(1200);
console.log('sun wake', (await R()).wake.toFixed(2));
await page.screenshot({ path: `${out}/play-1-sun-${W}.png`, clip: { x: Math.max(0, s.sun.x - 150), y: Math.max(0, s.sun.y - 150), width: 300, height: 300 } });

// Say hi to the bee and lead it around.
s = await R();
await page.mouse.move(s.bee.x, s.bee.y, { steps: 8 });
await page.waitForTimeout(200);
for (let i = 0; i < 30; i++) { await page.mouse.move(s.bee.x + i * 15, s.bee.y + 120 + Math.sin(i / 4) * 60); await page.waitForTimeout(16); }
  console.log("following", await page.evaluate(() => window.__game.renderer.bee.follow.toFixed(2)));
await page.waitForTimeout(500);
const after = await R();
console.log('bee moved to', Math.round(after.bee.x), Math.round(after.bee.y), 'mouse', Math.round(s.bee.x + 29 * 15), Math.round(s.bee.y + 120 + Math.sin(29 / 4) * 60));
await shot('2-bee');

// Brush through the flowers.
const gy = s.L.groundY;
for (let x = 100; x < 1200; x += 20) { await page.mouse.move(x, gy - 30); await page.waitForTimeout(16); }
await shot('3-flowers');

// Tickle a cloud: find one by probing the sky.
const spot = await page.evaluate(() => {
  const r = window.__game.renderer;
  for (let y = 60; y < 300; y += 10) for (let x = 40; x < innerWidth - 40; x += 20) if (r.scenery.cloudAt(x, y, r.time)) return { x, y };
  return null;
});
console.log('cloud at', spot);
if (spot) {
  for (let i = 0; i < 60; i++) { await page.mouse.move(spot.x + (i % 2 ? 25 : -25), spot.y + (i % 3) * 4); await page.waitForTimeout(16); }
  await page.waitForTimeout(250);
  await shot('4-tickle');
  await page.waitForTimeout(1200);
  await shot('5-rainbow');
  console.log('rainbow', await page.evaluate(() => window.__game.renderer.rainbow.toFixed(2)));
}
console.log('errors', errors);
await browser.close();
