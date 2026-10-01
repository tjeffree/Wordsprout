# Build log

Wordsprout was built in one autonomous session on 2026-10-01. **Claude Opus 5.5**
orchestrated: it chose the concept, the architecture and the interface contracts,
and wrote the adaptive engine, round simulation, renderer, app/UI and tests. It
also did the integration and visual QA, and all the iteration.
**Sonnet 5.5 subagents** built well-defined modules in parallel against
written contracts, and each one checked its own work visually with Playwright
screenshots.

## Timeline (local time)

| Time | Milestone |
|---|---|
| 09:22 | Tooling: Vite, TypeScript 7, Vitest, Playwright + Chromium |
| 09:29 | Concept, palette and module contracts written; 6 Sonnet subagents launched in parallel |
| 09:29–09:41 | Opus writes levels, adaptive engine, content picker, round simulation, storage, renderer and app shell while the subagents work |
| 09:45 | Adaptive simulations (1 → 110 WPM virtual typists) pass |
| 09:50 | First full visual pass: title, onboarding, kid mode, adult mode, results, leaderboard, level toast |
| 09:55 | First playable commit |
| 10:00–10:12 | Performance: real-GPU frame timing and Chrome tracing, then sprite caches for grown flowers, sparkles and score pop-ups (p95 frame time 25 ms → 8.5 ms at 120 Hz) |
| 10:14 | **Little Words** mode (user request, for Nova) |
| 10:15 | Sound-mix audit subagent (objective loudness/clipping measurement) |
| 10:20 | **No capitals** toggle for every game (user request); Playwright e2e suite, 12 tests |
| 10:24 | HUD, toast and streak relocation; puff band follows the HUD height |
| 10:28 | Golden dandelions (×2 points, rare flower), Bumble's cheer bubbles |
| 10:24–10:34 | Read-only bug-hunt subagent: 9 confirmed bugs, each with a live repro |
| 10:34–10:44 | All 9 fixed, plus 6 hardening items; regression tests added (16 e2e + 28 unit tests green) |
| 10:45 | Final visual sweep (phone, tablet, laptop, 1440p) |

## Subagent usage (Sonnet 5.5)

Tracked separately from the orchestrator. Raw data: [`agent-usage.json`](agent-usage.json).

| Batch | Task | Tokens | Tool calls | Wall time |
|---|---|---:|---:|---:|
| 1 | On-screen keyboard component | 62,360 | 16 | 2m 49s |
| 1 | WebAudio sound engine | 52,537 | 13 | 2m 50s |
| 1 | Bee, dandelion, seed, butterfly, sparkle art | 71,123 | 23 | 3m 26s |
| 1 | Curated kid-safe word library | 64,009 | 14 | 4m 19s |
| 1 | Procedural flowers (11 kinds, growth animation) | 123,164 | 33 | 9m 36s |
| 1 | Storybook scenery | 108,503 | 42 | 9m 42s |
| 2 | Sound-mix audit and tuning | 65,456 | 13 | 8m 32s |
| 3 | Bug-hunt code review (read-only, live repros) | 145,177 | 37 | 9m 31s |
| | **Total (8 subagents)** | **692,329** | **191** | **50m 42s** |

Batch 1 ran its six agents concurrently: 9m 42s of wall time for 32m 42s of
agent work. Batches 2 and 3 each ran in the background while the orchestrator
built features: the e2e suite, Little Words and No capitals, golden puffs.

The whole build took about 1h 25m of wall-clock time, from an empty folder to
the final sweep.

## Notable findings along the way

- **The GPU was the bottleneck, not JavaScript.** JS stayed under 4 ms for 98%
  of frames. A Chrome trace showed the GPU process replaying canvas vector paths
  at 120 Hz. Three things fixed it: caching grown flowers as bitmaps (they only
  sway rigidly), turning sparkles into sprites, and pre-rendering the score text.
  The last one mattered because animating font sizes forces glyph re-rasterisation.
- **A text-wrap infinite loop** in the label layout could freeze the tab, but
  only for long sentences on phones under about 360 px wide. The review agent
  found it and it now has a regression test.
- **The kid curve was too strict at first.** Simulated 1 WPM children at 85%
  accuracy could stall at level 1. The patient levels now promote at 85% over
  6 items.
