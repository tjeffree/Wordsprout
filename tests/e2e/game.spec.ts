import { test, expect, type Page } from '@playwright/test';

declare global { interface Window { __game: any } }

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

async function fresh(page: Page) {
  await page.goto('/');
  await page.evaluate(() => window.__game.store._reset());
  await page.reload();
  await page.waitForFunction(() => !!window.__game);
}

async function newGardener(page: Page, name: string, placement: string) {
  await page.getByRole('button', { name: /let.s play/i }).click();
  await page.getByLabel('Your name').fill(name);
  await page.locator(`.placements button[data-id="${placement}"]`).click();
  await page.getByRole('button', { name: /plant my garden/i }).click();
  await expect(page.getByRole('button', { name: /^Start/ })).toBeVisible();
}

/** Press the key the game currently wants, `n` times. */
async function typeNext(page: Page, n: number, gap = 60) {
  for (let i = 0; i < n; i++) {
    const ch: string | null = await page.evaluate(() => window.__game.round?.nextChar ?? null);
    if (ch) await page.keyboard.press(ch === ' ' ? 'Space' : ch);
    await page.waitForTimeout(gap);
  }
}

test('title screen renders without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page);
  await expect(page.getByRole('heading', { name: 'Wordsprout' })).toBeVisible();
  // The canvas really drew something (not a blank colour).
  const varied = await page.evaluate(() => {
    const c = document.getElementById('scene') as HTMLCanvasElement;
    const g = document.createElement('canvas'); g.width = 40; g.height = 40;
    const x = g.getContext('2d')!; x.drawImage(c, 0, 0, 40, 40);
    const d = x.getImageData(0, 0, 40, 40).data; const set = new Set<number>();
    for (let i = 0; i < d.length; i += 16) set.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
    return set.size;
  });
  expect(varied).toBeGreaterThan(20);
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('creating a gardener persists across reloads', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Nova', 'sprout');
  await expect(page.getByText('Level 1 · First Keys')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /let.s play/i }).click();
  await expect(page.locator('.pcard', { hasText: 'Nova' })).toBeVisible();
});

test('a little learner grows ten flowers and lands on the leaderboard', async ({ page }) => {
  const errors = watchErrors(page);
  await fresh(page);
  await newGardener(page, 'Pip', 'sprout');
  // This week's Spelling Bee is picked to start with.
  await expect(page.locator('.mode.spell')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.mode[data-id="ten"]').click();
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(page.locator('.hud')).toBeVisible();
  // Keyboard guide is shown for beginners.
  await expect(page.locator('.kb-root:not(.kb-hidden)')).toBeVisible();
  // Patient puffs never escape, even if we wait.
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => window.__game.round.stats.escapes)).toBe(0);
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__game.screen)) === 'play'; i++) await typeNext(page, 1, 700);
  await expect(page.getByText(/You grew 10 flowers/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /leaderboard/i }).click();
  await page.getByRole('tab', { name: /ten flowers/i }).click();
  await expect(page.locator('.board tr', { hasText: 'Pip' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Spelling Bee reads each word aloud and lists the words at the end', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  const clips: string[] = [];
  page.on('response', (r) => { if (r.url().includes('/spelling/') && r.ok()) clips.push(r.url()); });
  await fresh(page);
  await newGardener(page, 'Nova', 'sprout');
  await page.locator('.mode[data-id="spelling"]').click();
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect(page.locator('.hud')).toContainText(/0 of \d+ words/);
  await expect.poll(() => page.evaluate(() => !!window.__game.round.puffs.find((p: any) => p.hidden))).toBe(true);
  await expect.poll(() => clips.length).toBeGreaterThan(0);
  await page.keyboard.press('Enter'); // hear it again
  const total: number = await page.evaluate(() => window.__game.round.spelling.total);
  while ((await page.evaluate(() => window.__game.screen)) === 'play') await typeNext(page, 1, 100);
  await expect(page.locator('.spell-word')).toHaveCount(total, { timeout: 10_000 });
  await expect(page.getByText('Every word spelled first time!')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Spelling Bee labels the tricky words that come back at the end', async ({ page }) => {
  test.setTimeout(120_000);
  await fresh(page);
  await newGardener(page, 'Nova', 'sprout');
  await page.locator('.mode[data-id="spelling"]').click();
  await page.getByRole('button', { name: /^Start/ }).click();
  await expect.poll(() => page.evaluate(() => !!window.__game.round.puffs.find((p: any) => p.hidden))).toBe(true);
  // Two wrong letters on the first word: it comes back once at the end.
  const first: string = await page.evaluate(() => window.__game.round.nextChar);
  const wrong = first === 'z' ? 'x' : 'z';
  await page.keyboard.press(wrong);
  await page.keyboard.press(wrong);
  const total: number = await page.evaluate(() => window.__game.round.spelling.total);
  while ((await page.evaluate(() => window.__game.round.spellingDone)) < total) await typeNext(page, 1, 100);
  await expect(page.locator('.hud')).toContainText('Tricky words: 1 of 1');
});

test('touch keyboards that compose words still type letter by letter', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Tester', 'bloom');
  await page.locator('.mode[data-id="stroll"]').click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.round?.nextChar);
  await page.locator('#type-input').focus();
  // Like Gboard: each letter grows an in-progress composition instead of sending a key.
  const cdp = await page.context().newCDPSession(page);
  let text = '';
  for (let i = 1; i <= 3; i++) {
    text += await page.evaluate(() => window.__game.round.nextChar);
    await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    await expect.poll(() => page.evaluate(() => window.__game.round.stats.correct)).toBe(i);
  }
  await cdp.send('Input.insertText', { text }); // the keyboard commits the word
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__game.round.stats.correct)).toBe(3);
  expect(await page.evaluate(() => window.__game.round.stats.wrong ?? 0)).toBe(0);
});

test('wrong keys do not advance and lower accuracy', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Tester', 'bloom');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.round?.nextChar);
  const before = await page.evaluate(() => window.__game.round.nextChar);
  const wrong = before === 'z' ? 'x' : 'z';
  await page.keyboard.press(wrong);
  expect(await page.evaluate(() => window.__game.round.accuracy)).toBeLessThan(1);
  // Typing the right letter afterwards still works.
  await typeNext(page, 1);
  expect(await page.evaluate(() => window.__game.round.stats.correct)).toBe(1);
});

test('Escape pauses and resumes; time stands still while paused', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Tester', 'bloom');
  await page.locator('.mode[data-id="stroll"]').click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  const t0 = await page.evaluate(() => window.__game.round.time);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__game.round.time)).toBeCloseTo(t0, 3);
  await page.getByRole('button', { name: /keep going/i }).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game.round.time)).toBeGreaterThan(t0);
});

test('a timed round ends on the clock and records a score', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Speedy', 'speedy');
  await page.locator('.mode[data-id="stroll"]').click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await typeNext(page, 30, 50);
  await page.evaluate(() => { window.__game.round.time = 59.6; });
  await expect(page.locator('.results')).toBeVisible({ timeout: 8000 });
  const top = await page.evaluate(() => window.__game.store.leaderboard('stroll', 'score', 5));
  expect(top.length).toBe(1);
  expect(top[0].name).toBe('Speedy');
  expect(top[0].wpm).toBeGreaterThan(0);
  // Enter plays again (once the card is armed).
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  await expect(page.locator('.hud')).toBeVisible();
});

test('a fast, accurate typist is promoted mid-round', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Ace', 'bloom');
  await page.locator('.mode[data-id="summer"]').click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const start = await page.evaluate(() => window.__game.round.level.id);
  await typeNext(page, 160, 45);
  const now = await page.evaluate(() => window.__game.round.level.id);
  expect(now).toBeGreaterThan(start);
});

test('Little Words only shows 2-4 letter lowercase words', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Nova', 'bud');
  // The toggles are switched off while the Spelling Bee is picked.
  await page.locator('.mode[data-id="ten"]').click();
  await page.locator('.t-little').click();
  await expect(page.locator('.t-little')).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await page.getByRole('button', { name: /let.s play/i }).click();
  await page.locator('.pcard', { hasText: 'Nova' }).click();
  await page.locator('.mode[data-id="ten"]').click();
  await expect(page.locator('.t-little')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /^Start/ }).click();
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    for (const t of await page.evaluate(() => window.__game.round.puffs.map((p: any) => p.text))) seen.add(t);
    await typeNext(page, 4, 120);
  }
  expect(seen.size).toBeGreaterThan(3);
  for (const t of seen) expect(t).toMatch(/^[a-z]{2,4}$/);
});

test('No capitals toggle makes a speedy game all lowercase', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Lowercase', 'speedy');
  await page.locator('.mode[data-id="stroll"]').click();
  await page.locator('.t-caps').click();
  await expect(page.locator('.t-caps')).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.t-little')).toHaveAttribute('aria-checked', 'false');
  await page.evaluate(() => { const g = window.__game; const p = g.store.current; p.skill.level = 21; g.store.updateProfile(p); });
  // Enter on a focused toggle flips it (native button behaviour), so start with the button.
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.waitForFunction(() => window.__game.round?.puffs);
  const seen = new Set<string>();
  for (let i = 0; i < 10; i++) {
    for (const t of await page.evaluate(() => window.__game.round.puffs.map((p: any) => p.text))) seen.add(t);
    await typeNext(page, 6, 60);
  }
  expect(seen.size).toBeGreaterThan(2);
  for (const t of seen) expect(t).toBe(t.toLowerCase());
});

test('the gardener toggles are switched off for the Spelling Bee', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Bee', 'bud');
  await expect(page.locator('.mode.spell')).toHaveAttribute('aria-pressed', 'true');
  for (const t of ['.t-little', '.t-caps', '.t-steady']) await expect(page.locator(t)).toBeDisabled();
  await page.locator('.mode[data-id="ten"]').click();
  for (const t of ['.t-little', '.t-caps', '.t-steady']) await expect(page.locator(t)).toBeEnabled();
});

test('Slow & Steady keeps one word still in the middle and marks the leaderboard', async ({ page }) => {
  await fresh(page);
  await newGardener(page, 'Steady', 'speedy');
  await page.locator('.mode[data-id="ten"]').click();
  await page.locator('.t-steady').click();
  await expect(page.locator('.t-steady')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /^Start/ }).click();
  await page.waitForFunction(() => window.__game.round?.puffs.length > 0);
  await page.waitForTimeout(3000);
  const puffs = await page.evaluate(() => window.__game.round.puffs.filter((p: any) => p.state === 'fly').map((p: any) => ({ patient: p.patient, progress: p.progress })));
  expect(puffs).toHaveLength(1);
  expect(puffs[0].patient).toBe(true);
  expect(puffs[0].progress).toBeCloseTo(0.5, 2);
  while (await page.evaluate(() => window.__game.screen === 'play' && window.__game.round.phase === 'play')) await typeNext(page, 5, 40);
  await expect(page.getByRole('button', { name: /play again/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /leaderboard/i }).click();
  await page.getByRole('tab', { name: /ten flowers/i }).click();
  await expect(page.locator('.board td.name', { hasText: 'Steady' }).locator('span[title="Slow & Steady"]')).toBeVisible();
});

test('regression: long sentences wrap on narrow phones without freezing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await fresh(page);
  await page.evaluate(() => { const g = window.__game; g.store.createProfile('Narrow', 'N', 19); g.startRound('summer'); });
  await page.waitForFunction(() => window.__game.round?.puffs.length > 0);
  await page.evaluate(() => {
    const p = window.__game.round.puffs[0];
    p.text = 'Marshmallow clouds floated across the sky while the little snail sang softly.';
  });
  const t0 = await page.evaluate(() => window.__game.round.time);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__game.round.time)).toBeGreaterThan(t0);
});

test('regression: Enter in the name field opens the games screen (does not start a round)', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /let.s play/i }).click();
  await page.getByLabel('Your name').fill('Enterprise');
  await page.getByLabel('Your name').press('Enter');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__game.screen)).toBe('modes');
});

test('regression: a focused button activates itself on Enter', async ({ page }) => {
  await fresh(page);
  await page.getByRole('button', { name: /leaderboard/i }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__game.screen)).toBe('board');
});

test('regression: typing on past the end does not restart the round', async ({ page }) => {
  await fresh(page);
  // Parallel headless runs can blur the page, which (correctly) auto-pauses; suppress that here.
  await page.evaluate(() => window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true));
  await newGardener(page, 'Keeper', 'bloom');
  await page.locator('.mode[data-id="stroll"]').click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await typeNext(page, 10, 60);
  await page.evaluate(() => { window.__game.round.time = 59.9; });
  // Keep hammering keys through the end of the round and the card's arrival.
  let i = 0;
  while ((await page.evaluate(() => window.__game.screen)) === 'play' && i < 200) { await page.keyboard.press(i++ % 2 ? 'Space' : 'Enter'); await page.waitForTimeout(50); }
  // The card ignores keys for ~1.8 s after the round ends (0.9 s settle + 0.9 s arm).
  const until = Date.now() + 1200;
  while (Date.now() < until) { await page.keyboard.press('Space'); await page.keyboard.press('Enter'); await page.waitForTimeout(60); }
  expect(await page.evaluate(() => window.__game.screen)).toBe('results');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Enter');
  await expect(page.locator('.hud')).toBeVisible();
});

test('no horizontal overflow on menus at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await fresh(page);
  const check = async () => expect(await page.evaluate(() => {
    const ui = document.getElementById('ui')!;
    return [...ui.querySelectorAll<HTMLElement>('.card, .title-screen')].every((el) => el.getBoundingClientRect().right <= innerWidth + 1 && el.getBoundingClientRect().left >= -1);
  })).toBe(true);
  await check();
  await newGardener(page, 'Tiny', 'bloom');
  await check();
  await page.evaluate(() => window.__game.showBoard('modes'));
  await check();
});

test('touch keyboards (input events) can play @mobile', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => { const g = window.__game; g.store.createProfile('Thumbs', '🐢', 13); g.startRound('stroll'); });
  await page.waitForFunction(() => window.__game.round?.nextChar);
  // Android keyboards send keydown "Unidentified" + an input event with the text.
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__game.round.stats.correct)) < 8; i++) {
    const ch = await page.evaluate(() => window.__game.round.nextChar);
    if (!ch) { await page.waitForTimeout(100); continue; }
    await page.evaluate((c) => {
      const el = document.getElementById('type-input') as HTMLInputElement;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Unidentified', bubbles: true }));
      el.value = c; el.dispatchEvent(new InputEvent('input', { data: c, bubbles: true }));
    }, ch);
    await page.waitForTimeout(80);
  }
  expect(await page.evaluate(() => window.__game.round.stats.correct)).toBe(8);
});

test('phones and tablets open their keyboard and never show the helper over it @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'needs a touch screen');
  await fresh(page);
  await page.evaluate(() => { const g = window.__game; g.store.createProfile('Thumbs', '🐢', 1); g.startRound('stroll'); });
  await page.waitForFunction(() => window.__game.round?.nextChar);
  await expect(page.locator('#type-input')).toBeFocused();
  // iOS on-screen keyboards send real keydowns while squashing the visible page.
  await page.evaluate(() => Object.defineProperty(window.visualViewport, 'height', { get: () => window.innerHeight * 0.55 }));
  for (let i = 0; i < 3; i++) {
    const ch = await page.evaluate(() => window.__game.round.nextChar);
    if (ch) await page.keyboard.press(ch);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(200);
  await expect(page.locator('.kb-root:not(.kb-hidden)')).toHaveCount(0);
  // The HUD's keyboard button brings the keyboard back after it's dismissed.
  await page.locator('#type-input').blur();
  await page.getByRole('button', { name: 'Show the keyboard' }).click();
  await expect(page.locator('#type-input')).toBeFocused();
});
