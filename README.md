# 🌷 Wordsprout

**A whimsical typing garden where every word you type grows a flower.**

Dandelion puffs drift across a storybook sky, each carrying a word. Type the word,
the puff bursts into seeds, and one floats down and sprouts in your garden. Keep a
streak going and Bumble the bee does loops, rarer flowers bloom and a rainbow fades in.
If a puff drifts away, it just floats off. Nothing scolds you.

It works for a six-year-old pressing one key every twelve seconds and for a
120 WPM typist, and it moves each player smoothly between those extremes.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (works from any sub-path)
npm test           # unit tests: adaptive engine, content, simulations
npm run e2e        # Playwright end-to-end tests (builds + serves automatically)
```

## Deploying to GitHub Pages

`.github/workflows/pages.yml` is ready to use:

1. **test**: `npm ci`, typecheck, Vitest (every push and pull request)
2. **e2e**: Playwright end-to-end tests in headless Chromium
3. **build**: `npm run build`, uploaded as the Pages artifact
4. **deploy**: publishes to GitHub Pages, from the default branch only and once tests and e2e pass

One-time setup:

```bash
git remote add origin git@github.com:<you>/wordsprout.git
git push -u origin master
```

Then in the repo go to **Settings → Pages → Build and deployment → Source** and choose
**GitHub Actions**. The site appears at `https://<you>.github.io/wordsprout/`.
Asset paths are relative, so it works from any sub-path or a custom domain.
Leaderboards and gardeners live in each visitor's own browser (localStorage).

## What's in it

| | |
|---|---|
| **Adaptive difficulty** | 24 levels from *First Keys* (F and J) to *Legend of the Garden* (sentences, five puffs at once). It climbs when you're accurate and fast and steps down when you struggle. A separate pace controller fits drift speed to *your* measured speed. |
| **Little learners** | Patient puffs that never escape, giant letters in round badges, a glowing on-screen keyboard with finger colours, hand diagrams, and Bumble's gentle hints ("Find the **F** key, left pointer finger!") after 8 s of no typing. |
| **🐣 Little Words** | A per-gardener toggle: only 2, 3 and 4 letter lowercase words, many with a picture emoji. Special names such as *nova* 🌟 pop up now and then. |
| **🔡 No capitals** | A per-gardener toggle that turns every game, sentences included, into lowercase. It's on by default for beginners. |
| **Weak-key practice** | Per-key error tracking (with decay) biases letters and words toward the keys you miss and the keys you just unlocked. |
| **Four games** | *Ten Flowers* (no clock), *Morning Stroll* (1 min), *Sunny Day* (2 min), *Long Summer* (5 min). The sun travels across the sky to sunset as the round goes on. |
| **Golden dandelions** | Now and then a glowing golden puff drifts by, worth double points and guaranteed to grow a rare flower. Bumble cheers on streaks. |
| **Local leaderboard** | The "Garden of Fame": per game, by score or by speed, with medals, your own rows highlighted, and personal-best badges. Several gardeners can share one computer. |
| **Collection** | 11 flower kinds with rarities, from sprout to rainbow bloom. Streaks raise the odds of rare blooms. Each gardener keeps a collection of the kinds they've discovered. |
| **Sound** | Fully synthesized WebAudio. Every keystroke plucks a kalimba note, so a word plays a little melody. There are also chimes, fanfares and generative music-box music. No audio files. |
| **Everything procedural** | All the art is drawn in code with Canvas 2D: sky, sun, hills, cottage, flowers, bee, dandelions and butterflies. There are no image files. |
| **Responsive** | From 360 px phones (portrait and landscape, with the touch keyboard via an input proxy) to 2560 px desktops. The number of puff lanes adapts to the available sky. |

## How the adaptation works

There are two independent loops (`src/engine/adaptive.ts`):

1. **Level (what you type).** A rolling window of recent items, reset after
   every change, decides promotion and demotion:
   - **Up:** at least 90% accuracy with no recent escapes, at or above the
     level's WPM bar, and every newly introduced key practised. There's also
     a fast track for flawless typists.
   - **Down:** 2 escapes in the last 4 items, accuracy below 74% (60% at the
     patient levels), or speed far below what earned the level.
2. **Pace (how fast it drifts).** Each puff's travel time is
   `reading time + slack × (its length ÷ your chars/sec) + the work queued ahead of it`.
   After every puff, `slack` nudges itself so you finish puffs about 55% of
   the way across the sky. That feels the same at 10 WPM and at 120 WPM.
   Higher levels lower the minimum slack, which adds gentle pressure.

`tests/unit/adaptive.test.ts` runs virtual typists from 1 to 110 WPM through
full rounds. The 1 WPM child never loses a puff, a fast typist placed low
climbs quickly, and a slow typist placed high is brought down.

## Code map

```
src/
  main.ts              app shell: screens, HUD, input, the frame loop
  game/round.ts        deterministic round simulation (puffs, typing, scoring, events)
  game/renderer.ts     draws a round: scenery, garden, puffs + labels, Bumble, particles
  game/bot.ts          the title screen's demo typist
  engine/levels.ts     the 24-level ladder
  engine/adaptive.ts   skill model: level decisions, pace controller, key stats
  engine/content.ts    picks what each puff says (weak keys, new keys, Little Words)
  engine/words.ts      curated, kid-safe word, phrase and sentence lists
  art/*.ts             procedural art: scenery, flowers, characters, palette
  audio/sound.ts       synthesized sound effects and music
  storage/store.ts     gardeners, leaderboard, settings (localStorage)
  ui/                  styles, keyboard guide, DOM helpers
labs/                  standalone pages for each art/sound module (npm run dev → /labs/*.html)
scripts/               visual-QA screenshot, perf and trace tools
```

## Performance

Fully grown flowers, sparkles and score pop-ups are cached as bitmaps. Flowers
sway rigidly about their base, so a rotated blit looks identical to the vector
original. The 95th-percentile frame time is under 9.5 ms at 120 Hz with a full
meadow and 100 WPM typing (RTX 3080, Chromium, 1080p).
See `scripts/perf.mjs`.

---

Built end to end by Claude Opus 5.5, with Sonnet 5.5 subagents for parallel
modules. See [docs/BUILD_LOG.md](docs/BUILD_LOG.md).
