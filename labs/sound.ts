import { sound } from '../src/audio/sound';

const buttons: [string, () => void][] = [
  ['key (0, combo 0)', () => sound.key(0, 0)],
  ['key (3, combo 10)', () => sound.key(3, 10)],
  ['key (6, combo 30)', () => sound.key(6, 30)],
  ['wrong', () => sound.wrong()],
  ['wordComplete (0, 3)', () => sound.wordComplete(0, 3)],
  ['wordComplete (10, 6)', () => sound.wordComplete(10, 6)],
  ['wordComplete (50, 10)', () => sound.wordComplete(50, 10)],
  ['sprout', () => sound.sprout()],
  ['escape', () => sound.escape()],
  ['levelUp', () => sound.levelUp()],
  ['levelDown', () => sound.levelDown()],
  ['streak 5', () => sound.streak(5)],
  ['streak 20', () => sound.streak(20)],
  ['uiClick', () => sound.uiClick()],
  ['uiHover', () => sound.uiHover()],
  ['roundStart', () => sound.roundStart()],
  ['roundEnd', () => sound.roundEnd()],
];

const root = document.getElementById('buttons')!;
function add(label: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    sound.unlock();
    fn();
  });
  root.appendChild(b);
  return b;
}
for (const [l, f] of buttons) add(l, f);

add('start music', () => sound.startMusic());
add('stop music', () => sound.stopMusic());

let typing: ReturnType<typeof setInterval> | null = null;
const typeBtn = add('simulate fast typing (12 keys/sec)', () => {
  if (typing !== null) {
    clearInterval(typing);
    typing = null;
    typeBtn.textContent = 'simulate fast typing (12 keys/sec)';
    return;
  }
  typeBtn.textContent = 'stop typing';
  const words = [5, 3, 7, 4, 6, 8, 4];
  let w = 0;
  let i = 0;
  let combo = 0;
  typing = setInterval(() => {
    const len = words[w % words.length];
    if (i < len) {
      sound.key(i, combo);
      i++;
    } else {
      combo++;
      sound.wordComplete(combo, len);
      if (combo % 5 === 0) sound.streak(combo);
      i = 0;
      w++;
    }
  }, 1000 / 12);
});

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
$<HTMLInputElement>('vol').addEventListener('input', (e) => sound.setVolume(Number((e.target as HTMLInputElement).value)));
$<HTMLInputElement>('mute').addEventListener('change', (e) => {
  sound.unlock();
  sound.muted = (e.target as HTMLInputElement).checked;
});
$<HTMLInputElement>('music').addEventListener('change', (e) => {
  sound.unlock();
  sound.musicEnabled = (e.target as HTMLInputElement).checked;
});
