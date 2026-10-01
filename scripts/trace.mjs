// Records a Chrome trace while typing and summarises the heaviest events.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const browser = await chromium.launch({ headless: false, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5173/');
await page.waitForTimeout(1000);
await page.evaluate(() => { const g = window.__game; g.store._reset(); g.store.createProfile('Perf', '🐝', 20); g.startRound('summer'); });
await page.evaluate(() => setInterval(() => { const ch = window.__game.round?.nextChar; if (ch) window.dispatchEvent(new KeyboardEvent('keydown', { key: ch })); }, 120));
await page.waitForTimeout(6000);
const out = 'shots/trace.json';
await browser.startTracing(page, { path: out, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'gpu', 'cc', 'viz', 'v8'] });
await page.waitForTimeout(5000);
await browser.stopTracing();
await browser.close();

const ev = JSON.parse(fs.readFileSync(out, 'utf8')).traceEvents ?? [];
const threads = {};
for (const e of ev) if (e.name === 'thread_name') threads[`${e.pid}:${e.tid}`] = e.args.name;
const agg = {};
const long = [];
for (const e of ev) {
  if (e.ph !== 'X' || !e.dur) continue;
  const th = threads[`${e.pid}:${e.tid}`] ?? '?';
  const k = `${th} | ${e.name}`;
  (agg[k] ??= { n: 0, total: 0, max: 0 });
  agg[k].n++; agg[k].total += e.dur / 1000; agg[k].max = Math.max(agg[k].max, e.dur / 1000);
  if (e.dur > 9000) long.push(`${(e.dur / 1000).toFixed(1)}ms ${k}`);
}
const top = Object.entries(agg).sort((a, b) => b[1].max - a[1].max).slice(0, 25);
for (const [k, v] of top) console.log(`${v.max.toFixed(1).padStart(6)} max  ${v.total.toFixed(0).padStart(6)} total  n=${v.n}  ${k}`);
console.log('long events:', long.slice(0, 30).join('\n'));
