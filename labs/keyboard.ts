import { createKeyboard } from '../src/ui/keyboard';

const stage = document.getElementById('stage') as HTMLElement;
const wordEl = document.getElementById('word') as HTMLElement;
const kb = createKeyboard(stage);
kb.setHandsVisible(true);

const text = 'Hello, bee!';
let i = 0;
setInterval(() => {
  const ch = text[i % text.length];
  wordEl.textContent = text.slice(0, (i % text.length) + 1);
  kb.highlight(ch);
  if (i % 2 === 1) kb.press(text[(i - 1) % text.length], Math.random() > 0.4);
  i++;
}, 700);

(window as unknown as { kb: typeof kb }).kb = kb;
