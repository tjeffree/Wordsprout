// Builds the Spelling Bee lists from spelling/words.txt (every week of the term,
// each with its test date): speaks each word in British English with a neural
// voice and writes
//   public/spelling/<word>.mp3       the word on its own (for "hear it again")
//   public/spelling/<word>-say.mp3   word, sentence, word (like a spelling test)
//   src/engine/spelling.json         the weeks the game imports
// and adds any new words to src/engine/spelling-bank.json, which feeds the
// other games' word lists. Words already spoken (same sentence, same voice)
// keep their clips; clips for words no longer listed are removed.
//
// Usage: npm run spelling            (needs Python with: pip install edge-tts)
// Env:   SPELLING_VOICE=en-GB-LibbyNeural to try another voice.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const voice = process.env.SPELLING_VOICE ?? 'en-GB-SoniaNeural';
const outDir = join(root, 'public', 'spelling');
const listFile = join(root, 'src', 'engine', 'spelling.json');

// [Week 5: 14.10.26] starts a week; the lines after it are its words.
const weeks = [];
for (const raw of readFileSync(join(root, 'spelling', 'words.txt'), 'utf8').split(/\r?\n/)) {
  const l = raw.replace(/#.*$/, '').trim();
  if (!l) continue;
  const head = l.match(/^\[\s*(.+?)\s*:\s*(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\s*\]$/);
  if (head) {
    const [, name, d, m, y] = head;
    const test = `${y.length === 2 ? `20${y}` : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    weeks.push({ name, test, words: [] });
    continue;
  }
  if (l.startsWith('[')) throw new Error(`Can't read the week heading "${l}" (try [Week 5: 14.10.26])`);
  if (!weeks.length) throw new Error(`"${l}" comes before the first week heading, like [Week 1: 16.09.26]`);
  const [w, ...rest] = l.split('|');
  weeks.at(-1).words.push({ word: w.trim().toLowerCase(), sentence: rest.join('|').trim() });
}
weeks.sort((a, b) => a.test.localeCompare(b.test));

const words = weeks.flatMap((w) => w.words);
const bad = words.filter((w) => !/^[a-z]+$/.test(w.word));
if (bad.length) throw new Error(`Words must be letters only: ${bad.map((w) => w.word).join(', ')}`);
const empty = weeks.filter((w) => !w.words.length);
if (empty.length) throw new Error(`No words for ${empty.map((w) => w.name).join(', ')}`);
if (!words.length) throw new Error('spelling/words.txt has no words');
// One pair of clips per word, so a word on two weeks' lists needs the same sentence on both.
const sentences = new Map();
for (const { word, sentence } of words) {
  if (sentences.has(word) && sentences.get(word) !== sentence) throw new Error(`"${word}" is listed twice with different sentences`);
  sentences.set(word, sentence);
}

// What was spoken last time, so unchanged words keep their clips.
const old = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : {};
const oldWords = (old.weeks ?? [{ words: old.words ?? [] }]).flatMap((w) => w.words);
const spoken = new Map(old.voice === voice ? oldWords.map((w) => [w.word, w.sentence]) : []);
const has = (f) => existsSync(join(outDir, f));
const todo = [...sentences].filter(([word, sentence]) =>
  spoken.get(word) !== sentence || !has(`${word}.mp3`) || !has(`${word}-say.mp3`));

mkdirSync(outDir, { recursive: true });
const keep = new Set([...sentences.keys()].flatMap((w) => [`${w}.mp3`, `${w}-say.mp3`]));
for (const f of readdirSync(outDir)) if (f.endsWith('.mp3') && !keep.has(f)) rmSync(join(outDir, f));

// Find the real interpreter once: on Windows `python` is often a shim (pyenv)
// or a Store alias that only resolves through the shell.
const python = !todo.length ? '' : process.env.PYTHON
  ?? spawnSync('python -c "import sys; print(sys.executable)"', { encoding: 'utf8', shell: true }).stdout.trim();
if (todo.length && !python) throw new Error('Python not found (set PYTHON=path/to/python)');

function speak(text, file, rate) {
  const r = spawnSync(python, ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', join(outDir, file)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`edge-tts failed for "${text}":\n${r.stderr || r.error}`);
}

for (const [word, sentence] of todo) {
  const say = sentence ? `${word}. ... ${sentence} ... ${word}.` : `${word}.`;
  speak(`${word}.`, `${word}.mp3`, '-15%');
  speak(say, `${word}-say.mp3`, '-10%');
  console.log(`🔊 ${word}${sentence ? `  (${sentence})` : ''}`);
}

writeFileSync(listFile, JSON.stringify({ voice, weeks }, null, 2) + '\n');
console.log(`\n${sentences.size} words in ${weeks.length} weeks ready for the Spelling Bee (${todo.length} newly spoken):`);
for (const w of weeks) console.log(`  ${w.name}, test ${w.test}: ${w.words.map((x) => x.word).join(', ')}`);

// Every week's words also join the other games' word lists, and stay there.
const bankFile = join(root, 'src', 'engine', 'spelling-bank.json');
const bank = new Set(existsSync(bankFile) ? JSON.parse(readFileSync(bankFile, 'utf8')).words : []);
const added = [...sentences.keys()].filter((w) => !bank.has(w));
for (const w of added) bank.add(w);
writeFileSync(bankFile, JSON.stringify({ words: [...bank].sort() }, null, 2) + '\n');
console.log(added.length ? `Added to the other games: ${added.join(', ')}.` : 'All of them are already in the other games.');
