// Visual QA helper: drives the game in Chromium and saves screenshots.
// usage: node scripts/shoot.mjs <scenario> [width] [height] [outdir]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [scenario = 'title', W = '1440', H = '900', out = 'shots'] = process.argv.slice(2);
const URL = process.env.URL ?? 'http://localhost:5173/';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: +(process.env.DPR ?? 1), hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL);
await page.waitForTimeout(1200);
const shot = async (name) => { await page.screenshot({ path: `${out}/${scenario}-${name}-${W}x${H}.png` }); console.log('saved', `${out}/${scenario}-${name}-${W}x${H}.png`); };

async function makeProfile(name, placement) {
  await page.evaluate(([n, p]) => { const g = window.__game; g.store._reset(); g.store.createProfile(n, '🐰', p); }, [name, placement]);
}

/** Types the game's current next char `n` times with a delay. */
async function typeAlong(n, delay, errorRate = 0) {
  for (let i = 0; i < n; i++) {
    const ch = await page.evaluate(() => window.__game.round?.nextChar ?? null);
    if (ch) await page.keyboard.press(Math.random() < errorRate ? 'q' : ch === ' ' ? 'Space' : ch);
    await page.waitForTimeout(delay);
  }
}

if (scenario === 'title') {
  await page.waitForTimeout(2500);
  await shot('a');
} else if (scenario === 'flow') {
  await page.evaluate(() => window.__game.store._reset());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(700);
  await shot('new');
  await page.fill('.text-in', 'Maisie');
  await page.click('.placements button[data-id="sprout"]');
  await shot('new-filled');
  await page.click('text=Plant my garden');
  await page.waitForTimeout(700);
  await shot('modes');
} else if (scenario === 'kid') {
  await makeProfile('Maisie', 1);
  await page.evaluate(() => window.__game.startRound('ten'));
  await page.waitForTimeout(2600);
  await shot('start');
  await typeAlong(1, 400);
  await page.keyboard.press('k');
  await page.waitForTimeout(150);
  await shot('wrong');
  await typeAlong(5, 900);
  await page.waitForTimeout(500);
  await shot('mid');
  await page.waitForTimeout(8500);
  await shot('hint');
} else if (scenario === 'adult') {
  await makeProfile('Tony', 16);
  await page.evaluate(() => window.__game.startRound('stroll'));
  await page.waitForTimeout(2500);
  await shot('start');
  await typeAlong(60, 90, 0.03);
  await shot('mid');
  await typeAlong(90, 80, 0.0);
  await shot('later');
} else if (scenario === 'results') {
  await makeProfile('Tony', 14);
  await page.evaluate(() => window.__game.startRound('stroll'));
  await page.waitForTimeout(1500);
  const end = Date.now() + 64000;
  while (Date.now() < end && (await page.evaluate(() => window.__game.screen)) === 'play') await typeAlong(10, 70, 0.02);
  await page.waitForTimeout(2500);
  await shot('results');
  await page.click('text=Leaderboard');
  await page.waitForTimeout(800);
  await shot('board');
} else if (scenario === 'nova') {
  await page.evaluate(() => { const g = window.__game; g.store._reset(); const p = g.store.createProfile('Nova', '🦄', 11); p.littleWords = true; g.store.updateProfile(p); g.showModes(); });
  await page.waitForTimeout(800);
  await shot('modes');
  await page.evaluate(() => window.__game.startRound('ten'));
  await page.waitForTimeout(2600);
  await shot('start');
  for (let i = 0; i < 6; i++) { await typeAlong(4, 500); await page.waitForTimeout(900); }
  await shot('mid');
} else if (scenario === 'golden') {
  await makeProfile('Tony', 14);
  await page.evaluate(() => window.__game.startRound('summer'));
  await page.waitForTimeout(2500);
  await typeAlong(40, 110);
  await page.evaluate(() => { for (const p of window.__game.round.puffs) if (p.state === 'fly') p.golden = true; });
  await page.waitForTimeout(400);
  await shot('aura');
  for (let i = 0; i < 30; i++) {
    await typeAlong(1, 90);
    if (await page.$('.bubble.cheer')) { await shot('cheer'); break; }
  }
} else if (scenario === 'kidresults') {
  await makeProfile('Nova', 1);
  await page.evaluate(() => window.__game.startRound('ten'));
  await page.waitForTimeout(2000);
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__game.screen)) === 'play'; i++) await typeAlong(1, 650, 0.1);
  await page.waitForTimeout(2500);
  await shot('results');
} else if (scenario === 'misc') {
  await makeProfile('Tony', 14);
  await page.click('.corner button[aria-label="Settings"]');
  await page.waitForTimeout(600);
  await shot('settings');
  await page.evaluate(() => window.__game.startRound('stroll'));
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  await shot('pause');
  await page.click('text=Leave the garden');
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game.showBoard('modes'));
  await page.waitForTimeout(700);
  await shot('emptyboard');
} else if (scenario === 'level') {
  await makeProfile('Tony', 4);
  await page.evaluate(() => window.__game.startRound('summer'));
  await page.waitForTimeout(2000);
  for (let i = 0; i < 40; i++) {
    await typeAlong(1, 250);
    const t = await page.$('.toast');
    if (t) { await page.waitForTimeout(500); await shot('toast'); break; }
    if (i % 10 === 9) console.log('level', await page.evaluate(() => window.__game.round.level.id), await page.evaluate(() => window.__game.round.stats.items));
  }
}
const fps = await page.evaluate(() => window.__fps);
console.log('fps', fps);
if (errors.length) console.log('CONSOLE:\n' + errors.join('\n'));
await browser.close();
