# Wordsprout — concept

**Pitch:** A whimsical storybook garden where every word you type plants a flower.
Dandelion seed-puffs drift across a soft pastel sky, each carrying a word. Type the
word and the puff bursts into sparkles, its seed floats down and *sprouts* a flower
in your garden. Keep a streak and Bumble the bee loops with joy, rarer flowers bloom,
and a rainbow grows. Let a puff drift away and it just floats off: gentle, never
punishing.

## Audience
- A 6-year-old pressing one key every ~12 seconds (≈1 WPM): single giant letters,
  an on-screen keyboard that glows the key to press, nothing ever times out.
- An adult speed typist at 120+ WPM: several puffs at once, long words, capitals,
  punctuation, short whimsical sentences, drifting fast.
- The **adaptive engine** moves people between these smoothly, both up and down.

## Art direction
- Storybook / picture-book. Soft, rounded, friendly shapes. No harsh black outlines:
  outlines are a darker shade of the fill colour (e.g. coral fill → `#c4525a` stroke).
- Palette (CSS tokens in `src/ui/styles.css`):
  - ink `#3d2c4e` (deep plum, used for text)
  - sky top `#8fc8ff`, sky mid `#cfe6ff`, horizon `#ffe3c9` (peach)
  - hills `#a8d672`, `#86c25a`, `#6aa84f`; soil `#9b6b4a`
  - coral `#ff7a7a`, butter `#ffd45c`, lilac `#b99cff`, sky-pink `#ff9ec7`,
    mint `#7ee0c3`, tangerine `#ffa45c`, cream `#fff8ec`
- Little white highlights on round shapes, subtle soft shadows, gentle sway animations.
- Fonts: **Fredoka** (UI, headings); **Andika** (the words to type, designed for
  early readers, with a clear single-storey "a"/"g").

## Rendering
- One full-screen `<canvas>` (DPR-aware) draws the sky, hills, garden, puffs, bee and
  particles. HTML/CSS overlays handle menus and HUD.
- Every art function is pure procedural Canvas 2D, so there are no image files.
