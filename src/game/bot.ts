// A pretend typist for the title-screen demo garden.
import type { Round } from './round';

export class Bot {
  private wait = 1.2;
  constructor(private round: Round, private wpm: number) {}

  update(dt: number) {
    this.wait -= dt;
    if (this.wait > 0) return;
    const ch = this.round.nextChar;
    if (!ch) { this.wait = 0.1; return; }
    const fresh = this.round.target === null;
    // Human-ish rhythm: a beat of "reading" before each word, jittery keystrokes.
    if (fresh && Math.random() < 0.85) {
      const lead = this.round.puffs.find((p) => p.state === 'fly');
      if (lead && lead.progress < 0.18) { this.wait = 0.25; return; }
    }
    this.round.handleKey(Math.random() < 0.025 ? 'q' : ch);
    const gap = 60 / (this.wpm * 5);
    this.wait = gap * (0.55 + Math.random() * 0.9) + (this.round.target === null ? 0.35 : 0);
  }
}
