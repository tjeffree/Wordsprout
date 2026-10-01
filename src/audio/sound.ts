/**
 * Wordsprout sound engine: fully synthesised WebAudio, storybook / music-box / kalimba flavour.
 * Everything is in C major pentatonic so any overlap of sounds stays consonant.
 * Every public method is a silent no-op when there is no AudioContext (Node, before unlock, muted).
 */

type Bus = 'sfx' | 'music';

interface NoteOpts {
  gain?: number;
  dur?: number; // seconds of audible decay
  bright?: number; // 0..1 lowpass openness / tine amount
  bus?: Bus;
  type?: OscillatorType;
  attack?: number;
  send?: number; // reverb send 0..1
  pan?: number;
}

// C major pentatonic across 3 octaves (MIDI), starting C4.
const PENTA = [0, 2, 4, 7, 9];
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const scaleNote = (degree: number, base = 60): number => {
  const d = Math.max(0, Math.floor(degree));
  return base + PENTA[d % 5] + 12 * Math.floor(d / 5);
};

const MAX_VOICES = 48;
const MAX_KEY_VOICES = 10;
const LOOKAHEAD = 0.18;
const SCHED_MS = 25;

// Music: chord progression in C (pad roots + melody-friendly chord tones), one chord per bar.
const PROGRESSION: { pad: number[]; tones: number[] }[] = [
  { pad: [48, 55, 64], tones: [0, 2, 4, 7, 9] }, // C
  { pad: [45, 52, 60], tones: [0, 2, 4, 7, 9] }, // Am
  { pad: [41, 48, 57], tones: [0, 4, 7, 9, 2] }, // F
  { pad: [43, 50, 59], tones: [2, 7, 9, 4, 0] }, // G
];

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFade: GainNode | null = null;
  private reverbIn: GainNode | null = null;

  private _muted = false;
  private _musicEnabled = true;
  private volume = 0.8;
  private voices = 0;
  private keyVoices = 0;

  private musicWanted = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private bar = 0;
  private melodyDeg = 7;
  private lastKeyAt = 0;

  get ready(): boolean {
    return this.ctx !== null;
  }

  get muted(): boolean {
    return this._muted;
  }
  set muted(v: boolean) {
    this._muted = v;
    this.applyMaster();
  }

  get musicEnabled(): boolean {
    return this._musicEnabled;
  }
  set musicEnabled(v: boolean) {
    this._musicEnabled = v;
    this.applyMusicFade();
    if (v && this.musicWanted) this.beginScheduler();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
    this.applyMaster();
  }

  unlock(): void {
    try {
      if (typeof window === 'undefined') return;
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.build(new AC());
      }
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      if (this.musicWanted) this.beginScheduler();
    } catch {
      /* audio is optional */
    }
  }

  // ---------------------------------------------------------------- graph

  private build(ctx: AudioContext): void {
    this.ctx = ctx;
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 12;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);

    const sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    const music = ctx.createGain();
    music.gain.value = 0.32; // sits well below sfx
    const fade = ctx.createGain();
    fade.gain.value = 0;
    music.connect(fade);
    fade.connect(master);
    sfx.connect(master);

    // Gentle reverb: decaying stereo noise impulse, darkened by lowpass in the send path.
    const reverb = ctx.createConvolver();
    reverb.buffer = this.makeImpulse(ctx, 2.2, 3.2);
    const send = ctx.createGain();
    send.gain.value = 1;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 3800;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    send.connect(damp);
    damp.connect(reverb);
    reverb.connect(wet);
    wet.connect(master);

    this.master = master;
    this.sfxBus = sfx;
    this.musicBus = music;
    this.musicFade = fade;
    this.reverbIn = send;
    this.applyMaster();
    this.applyMusicFade(true);
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 400 ? i / 400 : 1);
      }
    }
    return buf;
  }

  private applyMaster(): void {
    if (!this.ctx || !this.master) return;
    const target = this._muted ? 0 : this.volume * 0.9;
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(target, this.ctx.currentTime, this._muted ? 0.004 : 0.03);
  }

  private applyMusicFade(instant = false): void {
    if (!this.ctx || !this.musicFade) return;
    const target = this._musicEnabled && this.musicWanted ? 1 : 0;
    const g = this.musicFade.gain;
    if (instant) g.setValueAtTime(target, this.ctx.currentTime);
    else g.setTargetAtTime(target, this.ctx.currentTime, target ? 1.2 : 0.5);
  }

  private get live(): boolean {
    return !!this.ctx && !this._muted && this.ctx.state !== 'closed';
  }

  // ---------------------------------------------------------------- voices

  /** One soft plucked/tine voice. Returns false if voice-limited. */
  private note(freq: number, when: number, o: NoteOpts = {}): boolean {
    const ctx = this.ctx;
    if (!ctx || this.voices >= MAX_VOICES) return false;
    const bus = o.bus === 'music' ? this.musicBus : this.sfxBus;
    if (!bus || !Number.isFinite(freq) || freq <= 0) return false;
    const gain = o.gain ?? 0.3;
    const dur = o.dur ?? 0.35;
    const bright = o.bright ?? 0.3;
    const attack = o.attack ?? 0.004;
    const t0 = Math.max(when, ctx.currentTime);
    const end = t0 + attack + dur;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, end);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(9000, 1400 + bright * 4600);
    lp.Q.value = 0.3;

    let tail: AudioNode = env;
    lp.connect(env);

    const oscs: OscillatorNode[] = [];
    const main = ctx.createOscillator();
    main.type = o.type ?? 'triangle';
    main.frequency.value = freq;
    main.connect(lp);
    oscs.push(main);

    // kalimba tine: quickly dying inharmonic partial gives the "plink"
    if (bright > 0.05) {
      const tine = ctx.createOscillator();
      tine.type = 'sine';
      tine.frequency.value = freq * 4.1;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(gain * 0.35 * bright, t0);
      tg.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.min(0.12, dur * 0.4));
      tine.connect(tg);
      tg.connect(lp);
      oscs.push(tine);
    }

    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      tail.connect(p);
      tail = p;
    }
    tail.connect(bus);
    const send = o.send ?? 0.35;
    let sg: GainNode | null = null;
    if (send > 0 && this.reverbIn) {
      sg = ctx.createGain();
      sg.gain.value = send;
      tail.connect(sg);
      sg.connect(this.reverbIn);
    }

    this.voices++;
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      this.voices = Math.max(0, this.voices - 1);
      try {
        for (const s of oscs) s.disconnect();
        lp.disconnect();
        env.disconnect();
        sg?.disconnect();
        if (tail !== env) tail.disconnect();
      } catch {
        /* already gone */
      }
    };
    main.onended = cleanup;
    for (const s of oscs) {
      s.start(t0);
      s.stop(end + 0.05);
    }
    return true;
  }

  /** Sliding sine voice (bloops, whistles). */
  private glide(f0: number, f1: number, when: number, dur: number, gain: number, send = 0.4): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || this.voices >= MAX_VOICES) return;
    const t0 = Math.max(when, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.03, dur * 0.3));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(this.sfxBus);
    let sg: GainNode | null = null;
    if (this.reverbIn) {
      sg = ctx.createGain();
      sg.gain.value = send;
      env.connect(sg);
      sg.connect(this.reverbIn);
    }
    this.voices++;
    osc.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
      try {
        osc.disconnect();
        env.disconnect();
        sg?.disconnect();
      } catch {
        /* noop */
      }
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private run(fn: (ctx: AudioContext, now: number) => void): void {
    try {
      if (!this.live || !this.ctx) return;
      fn(this.ctx, this.ctx.currentTime);
    } catch {
      /* never throw from sound */
    }
  }

  // ---------------------------------------------------------------- sfx

  key(index: number, combo: number): void {
    this.run((ctx, now) => {
      if (this.keyVoices >= MAX_KEY_VOICES) return;
      const i = Math.max(0, Math.floor(Number.isFinite(index) ? index : 0));
      const c = Math.max(0, Number.isFinite(combo) ? combo : 0);
      // walk up the scale, wrapping after ~2 octaves so long words don't squeak
      const deg = 2 + (i % 10);
      const m = scaleNote(deg, 60);
      const bright = Math.min(0.8, 0.25 + c * 0.03);
      // slightly shorter envelope when typing very fast, keeps texture clean
      const fast = now - this.lastKeyAt < 0.09;
      this.lastKeyAt = now;
      const dur = fast ? 0.2 : 0.32;
      this.keyVoices++;
      const ok = this.note(mtof(m), now, { gain: 0.2, dur, bright, send: 0.3 });
      if (!ok) {
        this.keyVoices--;
        return;
      }
      setTimeout(() => (this.keyVoices = Math.max(0, this.keyVoices - 1)), (dur + 0.05) * 1000);
      if (c >= 8) {
        this.note(mtof(m + 12), now + 0.012, { gain: Math.min(0.1, 0.03 + c * 0.0015), dur: 0.22, bright: 0.5, send: 0.5 });
      }
      void ctx;
    });
  }

  wrong(): void {
    this.run((_c, now) => {
      // low wooden 'tock' with a tiny downward slide, comic but soft
      this.glide(300, 170, now, 0.16, 0.26, 0.15);
      this.note(220, now, { gain: 0.12, dur: 0.12, bright: 0.1, type: 'triangle', send: 0.1 });
    });
  }

  wordComplete(combo: number, length: number): void {
    this.run((_c, now) => {
      const c = Math.max(0, combo || 0);
      const n = Math.min(8, 3 + Math.floor(Math.max(1, length || 1) / 2) + Math.floor(c / 10));
      const gap = 0.055;
      const start = 5 + (c >= 20 ? 2 : 0);
      for (let k = 0; k < n; k++) {
        const m = scaleNote(start + k, 60);
        this.note(mtof(m), now + k * gap, {
          gain: 0.34,
          dur: 0.4 + Math.min(0.2, c * 0.01),
          bright: 0.55 + Math.min(0.4, c * 0.01),
          send: 0.55,
          pan: (k % 2 ? 1 : -1) * 0.25,
        });
      }
      // sparkle on top
      const top = scaleNote(start + n, 72);
      this.note(mtof(top), now + n * gap, { gain: 0.2, dur: 0.7, bright: 0.7, send: 0.7 });
      if (c >= 15) this.note(mtof(scaleNote(start, 48)), now, { gain: 0.14, dur: 0.8, bright: 0.1, type: 'sine', send: 0.4 });
    });
  }

  sprout(): void {
    this.run((_c, now) => {
      this.glide(330, 720, now, 0.16, 0.2, 0.35);
      this.glide(660, 1100, now + 0.09, 0.12, 0.1, 0.5);
    });
  }

  escape(): void {
    this.run((_c, now) => {
      // breathy descending whistle, ends on a hopeful note
      this.glide(1175, 784, now, 0.55, 0.1, 0.6);
      this.glide(1568, 1046, now + 0.05, 0.6, 0.04, 0.7);
      this.note(mtof(72), now + 0.5, { gain: 0.06, dur: 0.6, bright: 0.3, type: 'sine', send: 0.7 });
    });
  }

  levelUp(): void {
    this.run((_c, now) => {
      const seq = [0, 2, 4, 7, 9, 12];
      seq.forEach((d, k) => {
        this.note(mtof(72 + d), now + k * 0.1, {
          gain: 0.31,
          dur: 0.5,
          bright: 0.7,
          send: 0.5,
        });
      });
      [60, 64, 67, 72].forEach((m) => this.note(mtof(m), now + 0.6, { gain: 0.2, dur: 1.1, bright: 0.5, send: 0.6, type: 'sine' }));
      this.note(mtof(84), now + 0.62, { gain: 0.2, dur: 1.2, bright: 0.8, send: 0.7 });
    });
  }

  levelDown(): void {
    this.run((_c, now) => {
      this.note(mtof(76), now, { gain: 0.2, dur: 0.5, bright: 0.3, send: 0.5, type: 'sine' });
      this.note(mtof(69), now + 0.28, { gain: 0.2, dur: 0.8, bright: 0.25, send: 0.6, type: 'sine' });
    });
  }

  streak(milestone: number): void {
    this.run((_c, now) => {
      const big = Math.min(10, Math.max(1, Math.floor((milestone || 5) / 5)));
      const n = Math.min(9, 4 + big);
      for (let k = 0; k < n; k++) {
        this.note(mtof(scaleNote(10 + k, 60)), now + k * 0.045, {
          gain: 0.11,
          dur: 0.7,
          bright: 0.9,
          send: 0.75,
          pan: Math.sin(k * 1.7) * 0.5,
        });
      }
      this.note(mtof(scaleNote(5, 60)), now, { gain: 0.15, dur: 0.9, bright: 0.4, type: 'sine', send: 0.5 });
    });
  }

  uiClick(): void {
    this.run((_c, now) => {
      this.note(mtof(79), now, { gain: 0.16, dur: 0.14, bright: 0.45, send: 0.2 });
      this.note(mtof(72), now + 0.04, { gain: 0.1, dur: 0.12, bright: 0.3, send: 0.2 });
    });
  }

  uiHover(): void {
    this.run((_c, now) => {
      this.note(mtof(86), now, { gain: 0.03, dur: 0.08, bright: 0.2, type: 'sine', send: 0.1 });
    });
  }

  roundStart(): void {
    this.run((_c, now) => {
      this.note(mtof(67), now, { gain: 0.29, dur: 0.5, bright: 0.4, send: 0.5 });
      this.note(mtof(72), now + 0.5, { gain: 0.29, dur: 0.5, bright: 0.45, send: 0.5 });
      [76, 79, 84].forEach((m) => this.note(mtof(m), now + 1.0, { gain: 0.26, dur: 0.9, bright: 0.7, send: 0.6 }));
    });
  }

  roundEnd(): void {
    this.run((_c, now) => {
      [48, 60, 64, 67, 72, 76].forEach((m, k) =>
        this.note(mtof(m), now + k * 0.07, {
          gain: k === 0 ? 0.3 : 0.22,
          dur: 1.8,
          bright: 0.35,
          send: 0.7,
          type: 'sine',
          attack: 0.02,
        }),
      );
      this.note(mtof(84), now + 0.5, { gain: 0.08, dur: 1.4, bright: 0.8, send: 0.8 });
    });
  }

  // ---------------------------------------------------------------- music

  startMusic(): void {
    try {
      this.musicWanted = true;
      this.applyMusicFade();
      this.beginScheduler();
    } catch {
      /* noop */
    }
  }

  stopMusic(): void {
    try {
      this.musicWanted = false;
      this.applyMusicFade();
      if (this.musicTimer !== null) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    } catch {
      /* noop */
    }
  }

  private beginScheduler(): void {
    if (!this.ctx || this.musicTimer !== null || !this._musicEnabled || !this.musicWanted) return;
    this.applyMusicFade();
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
    this.musicTimer = setInterval(() => this.tick(), SCHED_MS);
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!this._musicEnabled || !this.musicWanted) {
      if (this.musicTimer !== null) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      return;
    }
    if (ctx.state !== 'running') {
      this.nextStepTime = ctx.currentTime + 0.1;
      return;
    }
    const stepDur = 60 / 84 / 2; // eighth notes at 84 BPM
    try {
      while (this.nextStepTime < ctx.currentTime + LOOKAHEAD) {
        this.scheduleStep(this.nextStepTime, stepDur);
        this.nextStepTime += stepDur;
        this.step = (this.step + 1) % 8;
        if (this.step === 0) this.bar++;
      }
    } catch {
      /* keep ticking */
    }
  }

  private scheduleStep(t: number, stepDur: number): void {
    const chord = PROGRESSION[this.bar % PROGRESSION.length];
    if (this.step === 0) {
      // soft pad: three slow sines per bar, long attack and release
      for (const m of chord.pad) this.padNote(mtof(m), t, stepDur * 8.5);
    }
    // melody: sparse random walk on the pentatonic, leaning towards chord tones on strong beats
    const strong = this.step % 4 === 0;
    const rest = Math.random() < (strong ? 0.2 : 0.55);
    if (rest) return;
    let deg = this.melodyDeg + [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(Math.random() * 8)];
    if (strong && Math.random() < 0.6) {
      const tone = chord.tones[Math.floor(Math.random() * 3)];
      const oct = Math.random() < 0.5 ? 5 : 10;
      deg = oct + PENTA.indexOf(tone);
    }
    deg = Math.min(13, Math.max(3, deg));
    this.melodyDeg = deg;
    const m = scaleNote(deg, 60);
    const accent = strong ? 1 : 0.7;
    this.note(mtof(m), t + Math.random() * 0.012, {
      bus: 'music',
      gain: 0.3 * accent,
      dur: 0.9,
      bright: 0.25,
      send: 0.7,
      pan: (Math.random() - 0.5) * 0.6,
    });
    // occasional soft echo an octave up, like a music box
    if (Math.random() < 0.12) {
      this.note(mtof(m + 12), t + stepDur, { bus: 'music', gain: 0.1, dur: 0.7, bright: 0.2, send: 0.8 });
    }
  }

  private padNote(freq: number, t: number, dur: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.1, t + dur * 0.35);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(env);
    env.connect(this.musicBus);
    const a = ctx.createOscillator();
    const b = ctx.createOscillator();
    a.type = 'triangle';
    b.type = 'sine';
    a.frequency.value = freq;
    b.frequency.value = freq * 1.004;
    a.connect(lp);
    b.connect(lp);
    a.onended = () => {
      try {
        a.disconnect();
        b.disconnect();
        lp.disconnect();
        env.disconnect();
      } catch {
        /* noop */
      }
    };
    a.start(t);
    b.start(t);
    a.stop(t + dur + 0.05);
    b.stop(t + dur + 0.05);
  }
}

export const sound = new Sound();
