// Records a short demo video (webm) of the title screen and a round.
// usage: node scripts/record.mjs [out-dir]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.argv[2] ?? 'shots/video';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, recordVideo: { dir: out, size: { width: 1280, height: 760 } } });
const page = await ctx.newPage();
await page.goto(process.env.URL ?? 'http://localhost:5173/');
await page.evaluate(() => window.__game.store._reset());
await page.waitForTimeout(4000);
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
await page.keyboard.type('Nova', { delay: 120 });
await page.click('.placements button[data-id="bloom"]');
await page.waitForTimeout(400);
await page.click('text=Plant my garden');
await page.waitForTimeout(1200);
await page.click('.mode[data-id="stroll"]');
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
// Type like a quick human: ~75 WPM with natural jitter and the odd slip.
const until = Date.now() + 62000;
while (Date.now() < until && (await page.evaluate(() => window.__game.screen)) === 'play') {
  const ch = await page.evaluate(() => window.__game.round?.nextChar ?? null);
  if (ch) await page.keyboard.press(Math.random() < 0.02 ? 'q' : ch === ' ' ? 'Space' : ch);
  await page.waitForTimeout(110 + Math.random() * 90);
}
await page.waitForTimeout(4000);
await ctx.close();
await browser.close();
console.log('video saved in', out);
