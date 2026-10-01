// Builds the Spelling Bee word list from spelling/words.txt: speaks each word
// in British English with a neural voice and writes
//   public/spelling/<word>.mp3       the word on its own (for "hear it again")
//   public/spelling/<word>-say.mp3   word, sentence, word (like a spelling test)
//   src/engine/spelling.json         the list the game imports
//
// Usage: npm run spelling            (needs Python with: pip install edge-tts)
// Env:   SPELLING_VOICE=en-GB-LibbyNeural to try another voice.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const voice = process.env.SPELLING_VOICE ?? 'en-GB-SoniaNeural';
const outDir = join(root, 'public', 'spelling');

const words = readFileSync(join(root, 'spelling', 'words.txt'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.replace(/#.*$/, '').trim())
  .filter(Boolean)
  .map((l) => {
    const [w, ...rest] = l.split('|');
    return { word: w.trim().toLowerCase(), sentence: rest.join('|').trim() };
  });

const bad = words.filter((w) => !/^[a-z]+$/.test(w.word));
if (bad.length) throw new Error(`Words must be letters only: ${bad.map((w) => w.word).join(', ')}`);
if (!words.length) throw new Error('spelling/words.txt has no words');

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (f.endsWith('.mp3')) rmSync(join(outDir, f));

// Find the real interpreter once: on Windows `python` is often a shim (pyenv)
// or a Store alias that only resolves through the shell.
const python = process.env.PYTHON
  ?? spawnSync('python -c "import sys; print(sys.executable)"', { encoding: 'utf8', shell: true }).stdout.trim();
if (!python) throw new Error('Python not found (set PYTHON=path/to/python)');

function speak(text, file, rate) {
  const r = spawnSync(python, ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', join(outDir, file)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`edge-tts failed for "${text}":\n${r.stderr || r.error}`);
}

for (const { word, sentence } of words) {
  const say = sentence ? `${word}. ... ${sentence} ... ${word}.` : `${word}.`;
  speak(`${word}.`, `${word}.mp3`, '-15%');
  speak(say, `${word}-say.mp3`, '-10%');
  console.log(`🔊 ${word}${sentence ? `  (${sentence})` : ''}`);
}

writeFileSync(join(root, 'src', 'engine', 'spelling.json'), JSON.stringify({ voice, words }, null, 2) + '\n');
console.log(`\n${words.length} words ready for the Spelling Bee.`);
