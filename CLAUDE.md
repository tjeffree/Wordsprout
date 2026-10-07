# Wordsprout

A whimsical typing game for children. See README.md for the full feature list, code map and commands.
A child plays it: keep every word, sentence and message kind, simple and kid-safe.

## Weekly spelling list (Spelling Bee)

Each week the user pastes their daughter's new school spelling list (usually Capitalised,
one per line). To update the game:

1. Add the week(s) to `spelling/words.txt` (keep the header comment), each under a heading
   with its test date, `[Week 7: 04.11.26]`. The game switches to the next week at 3pm
   on test day by itself. Use the format `word | sentence`, lowercase. Write a short, simple sentence for each word that a
   6-year-old in the UK would understand, using British spelling and vocabulary (pyjamas, mum).
   Words must be letters only.
2. `npm run spelling` (edge-tts, en-GB-SoniaNeural, needs internet; the user is happy with this voice).
   It also adds any new words to `src/engine/spelling-bank.json`, so they turn up in the other
   games too (past weeks' words stay; this week's come up more often).
3. `npm test` (checks every word has `public/spelling/<word>.mp3` and `<word>-say.mp3`,
   and that every spelling word is in the other games' word lists).
4. Commit `spelling/`, `public/spelling/`, `src/engine/spelling.json` and
   `src/engine/spelling-bank.json`, then push when asked.

## Conventions

- Tests: `npm test` (Vitest) and `npm run e2e` (Playwright: builds and serves on port 4173).
- The project has no `@types/node`, so don't import `node:*` in files that `tsc` checks (src/, tests/unit/).
- Feature work has gone through a branch and a pull request into `master`.
