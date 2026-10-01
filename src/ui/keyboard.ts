import './keyboard.css';

export type Finger = 'lp' | 'lr' | 'lm' | 'li' | 'ri' | 'rm' | 'rr' | 'rp' | 'thumb';

const ZONES: Record<Exclude<Finger, 'thumb'>, string> = {
  lp: '1qaz`',
  lr: '2wsx',
  lm: '3edc',
  li: '4rfv5tgb',
  ri: '6yhn7ujm',
  rm: '8ik,',
  rr: '9ol.',
  rp: '0p;/-=[]\'',
};

/** Standard touch-typing finger map for US QWERTY (lowercase keys). */
export const FINGER_OF: Record<string, Finger> = (() => {
  const map: Record<string, Finger> = { ' ': 'thumb' };
  for (const [f, keys] of Object.entries(ZONES)) {
    for (const k of keys) map[k] = f as Finger;
  }
  return map;
})();

export const FINGER_NAME: Record<Finger, string> = {
  lp: 'left pinky finger',
  lr: 'left ring finger',
  lm: 'left middle finger',
  li: 'left pointer finger',
  ri: 'right pointer finger',
  rm: 'right middle finger',
  rr: 'right ring finger',
  rp: 'right pinky finger',
  thumb: 'thumb',
};

export interface KeyboardApi {
  el: HTMLElement;
  /** Glow the key that should be pressed next; null = none. Uppercase also glows the opposite Shift. */
  highlight(char: string | null): void;
  /** Feedback flash when a key is physically pressed. */
  press(char: string, correct: boolean): void;
  setVisible(v: boolean): void;
  setHandsVisible(v: boolean): void;
  destroy(): void;
}

const SHIFTED = '!@#$%^&*()_+:"<>?~{}|';
const UNSHIFTED = "1234567890-=;',./`[]\\";

interface KeyDef {
  k: string; // data key id
  label?: string;
  w: number; // width in units
  finger?: Finger;
  ghost?: boolean;
  bump?: boolean;
}

const chars = (s: string): KeyDef[] =>
  [...s].map((c) => ({ k: c, label: c.toUpperCase(), w: 1, finger: FINGER_OF[c] }));
const ghost = (w: number, label = ''): KeyDef => ({ k: '', w, ghost: true, label });

const ROWS: KeyDef[][] = [
  [ghost(1), ...chars('1234567890-='), ghost(2, '')],
  [ghost(1.5), ...chars('qwertyuiop'), ghost(1), ghost(1), ghost(1.5)],
  [ghost(1.75), ...chars('asdfghjkl;\'').map((d) => ({ ...d, bump: d.k === 'f' || d.k === 'j' })), ghost(2.25)],
  [
    { k: 'shiftL', label: 'shift', w: 2.25, finger: 'lp' },
    ...chars('zxcvbnm,./'),
    { k: 'shiftR', label: 'shift', w: 2.75, finger: 'rp' },
  ],
  [ghost(4.5), { k: ' ', label: '', w: 6, finger: 'thumb' }, ghost(4.5)],
];

interface Resolved {
  key: string;
  shift: 'shiftL' | 'shiftR' | null;
}

function resolve(char: string): Resolved | null {
  if (char === ' ') return { key: ' ', shift: null };
  if (char.length !== 1) return null;
  let key = char;
  let shifted = false;
  if (char !== char.toLowerCase()) {
    key = char.toLowerCase();
    shifted = true;
  } else {
    const i = SHIFTED.indexOf(char);
    if (i >= 0) {
      key = UNSHIFTED[i];
      shifted = true;
    }
  }
  const f = FINGER_OF[key];
  if (!f) return null;
  let shift: Resolved['shift'] = null;
  if (shifted) shift = f.startsWith('l') ? 'shiftR' : 'shiftL';
  return { key, shift };
}

// ---------- hands ----------

const FINGER_SHAPES: { f: Finger; x: number; y: number; w: number; h: number; rot?: number }[] = [
  { f: 'lp', x: 22, y: 48, w: 24, h: 52 },
  { f: 'lr', x: 52, y: 26, w: 26, h: 74 },
  { f: 'lm', x: 84, y: 14, w: 27, h: 86 },
  { f: 'li', x: 117, y: 26, w: 26, h: 74 },
  { f: 'thumb', x: 150, y: 68, w: 26, h: 50, rot: -58 },
];

function handSvg(): string {
  const hand = (side: 'l' | 'r') => {
    const fingers = FINGER_SHAPES.map((s) => {
      const f = s.f === 'thumb' ? 'thumb' : s.f;
      const fid = f === 'thumb' ? `thumb-${side}` : side === 'l' ? f : f.replace('l', 'r');
      const t = s.rot ? ` transform="rotate(${s.rot} ${s.x + s.w / 2} ${s.y + s.h})"` : '';
      return `<rect class="kb-fg" data-f="${fid}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.w / 2}"${t}/>`;
    }).join('');
    const palm = `<rect class="kb-palm" x="20" y="74" width="140" height="48" rx="24"/>`;
    const g = `<g>${palm}${fingers}</g>`;
    return side === 'l' ? g : `<g transform="translate(380 0) scale(-1 1)">${g}</g>`;
  };
  // right hand: ids are produced by swapping l->r on pinky..index (handled in hand()).
  return `<svg class="kb-hands-svg" viewBox="0 0 380 126" aria-hidden="true" focusable="false">${hand('l')}${hand('r')}</svg>`;
}

// ---------- keyboard ----------

export function createKeyboard(parent: HTMLElement): KeyboardApi {
  const root = document.createElement('div');
  root.className = 'kb-root kb-hidden-init';
  root.setAttribute('aria-hidden', 'true');

  const board = document.createElement('div');
  board.className = 'kb-board';

  const caps = new Map<string, HTMLElement>();
  for (const row of ROWS) {
    const r = document.createElement('div');
    r.className = 'kb-row';
    for (const d of row) {
      const cell = document.createElement('div');
      cell.className = 'kb-key' + (d.ghost ? ' kb-ghost' : '');
      cell.style.setProperty('--w', String(d.w));
      const cap = document.createElement('div');
      cap.className = 'kb-cap' + (d.finger ? ` kb-f-${d.finger}` : '');
      if (d.k === ' ') cap.classList.add('kb-space');
      if (d.k.startsWith('shift')) cap.classList.add('kb-shift');
      if (d.bump) cap.classList.add('kb-has-bump');
      if (d.label && !d.ghost) {
        const l = document.createElement('span');
        l.className = 'kb-label';
        l.textContent = d.label;
        cap.appendChild(l);
      }
      if (d.bump) {
        const b = document.createElement('i');
        b.className = 'kb-bump';
        cap.appendChild(b);
      }
      cell.appendChild(cap);
      r.appendChild(cell);
      if (!d.ghost) caps.set(d.k, cap);
    }
    board.appendChild(r);
  }

  const hands = document.createElement('div');
  hands.className = 'kb-hands';
  hands.innerHTML = `<div class="kb-hands-inner">${handSvg()}<div class="kb-hand-caption"></div></div>`;
  const caption = hands.querySelector('.kb-hand-caption') as HTMLElement;

  root.append(board, hands);
  parent.appendChild(root);

  // Fix right-hand finger ids (mirror group reuses left ids): rewrite after insertion.
  const rightGroup = hands.querySelectorAll('svg > g')[1];
  rightGroup?.querySelectorAll<SVGElement>('.kb-fg').forEach((n) => {
    const f = n.getAttribute('data-f') ?? '';
    if (f.startsWith('thumb')) n.setAttribute('data-f', 'thumb-r');
    else n.setAttribute('data-f', 'r' + f[1]);
  });
  const leftThumb = hands.querySelector('[data-f="thumb-l"]');
  void leftThumb;

  let lit: HTMLElement[] = [];
  let litFingers: Element[] = [];
  const timers = new Set<number>();

  const clearLit = () => {
    lit.forEach((c) => c.classList.remove('kb-on'));
    litFingers.forEach((c) => c.classList.remove('kb-fg-on'));
    lit = [];
    litFingers = [];
  };

  const fingerEls = (f: Finger) =>
    Array.from(hands.querySelectorAll(f === 'thumb' ? '[data-f^="thumb"]' : `[data-f="${f}"]`));

  const setFingerColour = (n: Element, f: Finger) => {
    const key = f === 'thumb' ? 'thumb' : f;
    n.classList.add('kb-fg-on');
    (n as SVGElement).style.setProperty('--fc', `var(--kb-hi-${key})`);
  };

  const api: KeyboardApi = {
    el: root,
    highlight(char) {
      clearLit();
      caption.textContent = '';
      if (char == null) return;
      const r = resolve(char);
      if (!r) return;
      const ids = r.shift ? [r.key, r.shift] : [r.key];
      for (const id of ids) {
        const cap = caps.get(id);
        if (!cap) continue;
        cap.classList.add('kb-on');
        lit.push(cap);
        const f: Finger = id === 'shiftL' ? 'lp' : id === 'shiftR' ? 'rp' : FINGER_OF[id];
        for (const n of fingerEls(f)) {
          setFingerColour(n, f);
          litFingers.push(n);
        }
      }
      const f = FINGER_OF[r.key];
      caption.textContent = FINGER_NAME[f];
    },
    press(char, correct) {
      const r = resolve(char);
      if (!r) return;
      const cls = correct ? 'kb-ok' : 'kb-bad';
      const target = caps.get(r.key);
      if (!target) return;
      target.classList.remove('kb-ok', 'kb-bad');
      void target.offsetWidth; // restart animation
      target.classList.add(cls);
      const t = window.setTimeout(() => {
        target.classList.remove(cls);
        timers.delete(t);
      }, 600);
      timers.add(t);
    },
    setVisible(v) {
      root.classList.remove('kb-hidden-init');
      root.classList.toggle('kb-hidden', !v);
    },
    setHandsVisible(v) {
      hands.classList.toggle('kb-hands-open', v);
    },
    destroy() {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      root.remove();
    },
  };
  // visible by default
  root.classList.remove('kb-hidden-init');
  return api;
}
