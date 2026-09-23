/**
 * All sound is synthesised with WebAudio — no sample files. Effects are short
 * recipes of oscillators, filtered noise and envelopes, panned by where they
 * happen on the lane; the music is a small generative sequencer whose
 * instruments, scale and tempo change with the player's age.
 */

export type Sfx =
  | 'swing' | 'hitBlunt' | 'hitBlade' | 'bow' | 'throw' | 'musket' | 'rifle' | 'cannon' | 'explosion' | 'bigExplosion'
  | 'laser' | 'plasma' | 'rail' | 'zap' | 'flame' | 'rocket' | 'heal' | 'deathSoft' | 'deathMetal' | 'coin' | 'click'
  | 'error' | 'train' | 'build' | 'sell' | 'evolve' | 'enemyEvolve' | 'thunder' | 'meteorRumble' | 'arrowsWhoosh'
  | 'rally' | 'bomber' | 'drones' | 'override' | 'baseHit' | 'victory' | 'defeat' | 'rankUp' | 'unlock' | 'draft'
  | 'emp' | 'splash' | 'hen' | 'projectStart' | 'alarm';

interface PlayOpts {
  x?: number;
  vol?: number;
  pitch?: number;
}

const MIN_GAP: Partial<Record<Sfx, number>> = {
  swing: 0.05, hitBlunt: 0.04, hitBlade: 0.04, bow: 0.06, throw: 0.06, rifle: 0.03, musket: 0.06, laser: 0.05,
  plasma: 0.05, explosion: 0.06, coin: 0.05, deathSoft: 0.08, baseHit: 0.12, flame: 0.12, zap: 0.06, heal: 0.15,
  cannon: 0.08, rocket: 0.08, splash: 0.08,
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private readonly last = new Map<Sfx, number>();
  private voices = 0;
  private listenerX = 0;
  private halfWidth = 25;
  volumes = { master: 0.8, sfx: 0.8, music: 0.45 };
  muted = false;
  private music: Music | null = null;
  private musicAge = -1;

  /** Must be called from a user gesture before anything is heard. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.noise = this.makeNoise();
      this.applyVolumes();
      this.music = new Music(this.ctx, this.musicBus, this.noise);
      if (this.musicAge >= 0) this.music.setAge(this.musicAge);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    const m = this.muted ? 0 : this.volumes.master;
    this.master.gain.setTargetAtTime(m, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.value = this.volumes.sfx;
    this.musicBus.gain.value = this.volumes.music;
  }

  setListener(x: number, halfWidth: number): void {
    this.listenerX = x;
    this.halfWidth = halfWidth;
  }

  setMusicAge(age: number): void {
    this.musicAge = age;
    this.music?.setAge(age);
  }

  setMusicIntensity(v: number): void {
    this.music?.setIntensity(v);
  }

  stopMusic(): void {
    this.music?.stop();
  }

  update(): void {
    this.music?.schedule();
  }

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  play(name: Sfx, o: PlayOpts = {}): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0.02;
    if (now - (this.last.get(name) ?? -1) < gap) return;
    if (this.voices > 28) return;
    this.last.set(name, now);

    let vol = o.vol ?? 1;
    let pan = 0;
    if (o.x !== undefined) {
      const off = o.x - this.listenerX;
      pan = Math.max(-1, Math.min(1, off / (this.halfWidth * 1.2))) * 0.75;
      const outside = Math.abs(off) - this.halfWidth;
      if (outside > 0) vol *= Math.max(0.12, 1 - outside / 45);
    }
    const out = ctx.createGain();
    out.gain.value = vol;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(panner).connect(this.sfxBus);
    this.voices++;
    const dur = this.recipe(name, out, now, o.pitch ?? 1);
    setTimeout(() => {
      this.voices--;
      out.disconnect();
      panner.disconnect();
    }, (dur + 0.2) * 1000);
  }

  // ─── Building blocks ──────────────────────────────────────────────────────

  private tone(out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.005): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(out: AudioNode, t: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, attack = 0.004): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  private recipe(name: Sfx, out: AudioNode, t: number, p: number): number {
    const r = (a: number, b: number): number => a + Math.random() * (b - a);
    switch (name) {
      case 'swing':
        this.hiss(out, t, 0.16, 0.25, 'bandpass', 900 * p, 2600 * p, 2);
        return 0.2;
      case 'hitBlunt':
        this.hiss(out, t, 0.12, 0.5, 'lowpass', 900, 200, 1);
        this.tone(out, t, 'sine', 140 * p, 55, 0.14, 0.5);
        return 0.2;
      case 'hitBlade':
        this.hiss(out, t, 0.08, 0.3, 'highpass', 3000, 5000, 1);
        this.tone(out, t, 'triangle', r(1900, 2600) * p, 1700, 0.18, 0.12);
        return 0.2;
      case 'bow':
        this.tone(out, t, 'triangle', 330 * p, 120, 0.12, 0.3);
        this.hiss(out, t + 0.01, 0.12, 0.12, 'bandpass', 3000, 1200, 3);
        return 0.2;
      case 'throw':
        this.hiss(out, t, 0.22, 0.2, 'bandpass', 600, 1800, 2.5);
        return 0.25;
      case 'musket':
        this.hiss(out, t, 0.5, 0.9, 'lowpass', 4000, 300, 0.7, 0.002);
        this.tone(out, t, 'sine', 110, 40, 0.3, 0.6);
        return 0.55;
      case 'rifle':
        this.hiss(out, t, 0.12, 0.45, 'bandpass', 2400 * p, 900, 0.9, 0.001);
        this.tone(out, t, 'square', 180, 60, 0.05, 0.12);
        return 0.15;
      case 'cannon':
        this.hiss(out, t, 0.9, 1.0, 'lowpass', 2500, 120, 0.7, 0.002);
        this.tone(out, t, 'sine', 120, 32, 0.7, 0.9);
        return 0.95;
      case 'explosion':
        this.hiss(out, t, 0.9, 0.9, 'lowpass', 1800 * p, 90, 0.8, 0.003);
        this.tone(out, t, 'sine', 90 * p, 30, 0.6, 0.8);
        return 0.95;
      case 'bigExplosion':
        this.hiss(out, t, 1.6, 1.0, 'lowpass', 1400, 60, 0.8, 0.004);
        this.tone(out, t, 'sine', 70, 24, 1.2, 1.0);
        this.hiss(out, t + 0.05, 1.2, 0.4, 'highpass', 2000, 800, 0.6);
        return 1.7;
      case 'laser':
        this.tone(out, t, 'sawtooth', 1900 * p, 420, 0.22, 0.18);
        this.tone(out, t, 'sine', 3200 * p, 900, 0.18, 0.1);
        return 0.25;
      case 'plasma':
        this.tone(out, t, 'square', 900 * p, 180, 0.2, 0.14);
        this.hiss(out, t, 0.12, 0.2, 'bandpass', 2500, 900, 4);
        return 0.25;
      case 'rail':
        this.hiss(out, t, 0.25, 0.8, 'highpass', 6000, 2000, 0.8, 0.001);
        this.tone(out, t, 'sawtooth', 4200, 700, 0.35, 0.25);
        this.tone(out, t, 'sine', 90, 40, 0.4, 0.6);
        return 0.45;
      case 'zap':
        for (let i = 0; i < 4; i++) this.hiss(out, t + i * 0.03, 0.05, 0.4, 'bandpass', r(2000, 6000), r(1000, 3000), 6);
        this.tone(out, t, 'sawtooth', 120, 90, 0.15, 0.2);
        return 0.2;
      case 'flame':
        this.hiss(out, t, 0.5, 0.45, 'lowpass', 1400, 500, 0.7, 0.05);
        return 0.55;
      case 'rocket':
        this.hiss(out, t, 0.55, 0.45, 'bandpass', 500, 2400, 1.2, 0.03);
        return 0.6;
      case 'heal':
        this.tone(out, t, 'sine', 880, 880, 0.35, 0.12, 0.02);
        this.tone(out, t + 0.08, 'sine', 1320, 1320, 0.35, 0.1, 0.02);
        return 0.5;
      case 'deathSoft':
        this.hiss(out, t, 0.2, 0.22, 'lowpass', 700, 200, 1);
        this.tone(out, t, 'triangle', r(180, 260), 90, 0.18, 0.12);
        return 0.25;
      case 'deathMetal':
        this.tone(out, t, 'square', 320, 70, 0.3, 0.2);
        this.hiss(out, t, 0.3, 0.4, 'bandpass', 1800, 400, 2);
        return 0.35;
      case 'coin':
        this.tone(out, t, 'sine', 1560, 1560, 0.09, 0.14);
        this.tone(out, t + 0.06, 'sine', 2080, 2080, 0.14, 0.14);
        return 0.25;
      case 'click':
        this.tone(out, t, 'triangle', 1500, 1100, 0.04, 0.12);
        return 0.06;
      case 'error':
        this.tone(out, t, 'square', 140, 120, 0.16, 0.12);
        return 0.2;
      case 'train':
        this.tone(out, t, 'sine', 520, 780, 0.12, 0.16);
        return 0.15;
      case 'build':
        this.hiss(out, t, 0.15, 0.4, 'lowpass', 900, 200, 1);
        for (let i = 0; i < 3; i++) this.tone(out, t + 0.08 + i * 0.06, 'square', 600, 500, 0.03, 0.06);
        return 0.35;
      case 'sell':
        this.tone(out, t, 'sine', 1200, 700, 0.18, 0.12);
        return 0.2;
      case 'unlock':
        [523, 659, 784].forEach((f, i) => this.tone(out, t + i * 0.07, 'triangle', f, f, 0.25, 0.14));
        return 0.5;
      case 'evolve':
        [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => this.tone(out, t + i * 0.08, 'triangle', f, f * 1.001, 0.6, 0.12));
        this.hiss(out, t + 0.3, 1.2, 0.12, 'highpass', 5000, 9000, 0.5, 0.3);
        this.tone(out, t, 'sine', 65, 65, 1.4, 0.3, 0.2);
        return 1.6;
      case 'enemyEvolve':
        [110, 131, 165].forEach((f) => this.tone(out, t, 'sawtooth', f, f * 0.98, 1.4, 0.07, 0.15));
        this.tone(out, t, 'sine', 55, 50, 1.4, 0.35, 0.1);
        return 1.5;
      case 'draft':
        [392, 494, 587].forEach((f, i) => this.tone(out, t + i * 0.05, 'sine', f, f, 0.5, 0.1));
        return 0.6;
      case 'thunder':
        this.hiss(out, t, 0.12, 1.0, 'highpass', 3000, 1500, 0.7, 0.001);
        this.hiss(out, t + 0.05, 1.8, 0.8, 'lowpass', 900, 60, 0.7, 0.05);
        return 1.9;
      case 'meteorRumble':
        this.hiss(out, t, 2.5, 0.5, 'lowpass', 300, 80, 0.7, 0.4);
        return 2.6;
      case 'arrowsWhoosh':
        for (let i = 0; i < 6; i++) this.hiss(out, t + i * 0.12, 0.4, 0.2, 'bandpass', r(800, 1400), r(2000, 3200), 3, 0.05);
        return 1.2;
      case 'rally':
        for (let i = 0; i < 6; i++) this.tone(out, t + i * 0.16, 'sine', 90, 50, 0.18, 0.5);
        [392, 523, 659].forEach((f) => this.tone(out, t + 0.5, 'sawtooth', f, f, 0.8, 0.05, 0.05));
        return 1.4;
      case 'bomber':
        this.tone(out, t, 'sawtooth', 70, 90, 3.5, 0.08, 0.8);
        this.tone(out, t, 'sawtooth', 72, 88, 3.5, 0.08, 0.8);
        return 3.6;
      case 'drones':
        for (let i = 0; i < 4; i++) this.tone(out, t + i * 0.1, 'sawtooth', 380 + i * 30, 520 + i * 20, 1.5, 0.04, 0.2);
        return 1.8;
      case 'override':
        for (let i = 0; i < 10; i++) this.tone(out, t + i * 0.05, 'square', r(200, 2000), r(100, 1500), 0.06, 0.1);
        this.tone(out, t, 'sine', 1200, 60, 0.9, 0.3);
        return 1;
      case 'emp':
        this.tone(out, t, 'sine', 2400, 80, 0.7, 0.3);
        this.hiss(out, t, 0.5, 0.3, 'bandpass', 4000, 300, 2);
        return 0.8;
      case 'baseHit':
        this.hiss(out, t, 0.25, 0.4, 'lowpass', 600, 150, 1);
        this.tone(out, t, 'sine', 80, 50, 0.2, 0.35);
        return 0.3;
      case 'splash':
        this.hiss(out, t, 0.3, 0.3, 'bandpass', 1200, 500, 1.5);
        return 0.35;
      case 'hen':
        this.tone(out, t, 'square', 900, 1400, 0.08, 0.06);
        this.tone(out, t + 0.09, 'square', 1100, 700, 0.1, 0.06);
        return 0.25;
      case 'rankUp':
        [880, 1175, 1568].forEach((f, i) => this.tone(out, t + i * 0.05, 'sine', f, f, 0.3, 0.08));
        return 0.45;
      case 'projectStart':
        [196, 262, 330, 392, 523].forEach((f, i) => this.tone(out, t + i * 0.18, 'sawtooth', f, f, 1.2, 0.05, 0.1));
        this.tone(out, t, 'sine', 49, 49, 2, 0.4, 0.4);
        return 2.2;
      case 'alarm':
        for (let i = 0; i < 3; i++) this.tone(out, t + i * 0.35, 'square', 660, 520, 0.3, 0.07);
        return 1.1;
      case 'victory':
        [262, 330, 392, 523, 392, 523, 659, 784].forEach((f, i) => this.tone(out, t + i * 0.14, 'triangle', f, f, 0.5, 0.14));
        return 1.6;
      case 'defeat':
        [220, 208, 196, 165].forEach((f, i) => this.tone(out, t + i * 0.35, 'sawtooth', f, f * 0.98, 0.7, 0.07, 0.05));
        this.tone(out, t, 'sine', 55, 40, 2, 0.35, 0.2);
        return 2;
    }
  }
}

// ─── Music ──────────────────────────────────────────────────────────────────

interface Style {
  bpm: number;
  root: number;
  scale: number[];
  lead: OscillatorType;
  bass: OscillatorType;
  kick: boolean;
  snare: 'none' | 'snare' | 'clap' | 'frame';
  hats: boolean;
  pad: boolean;
  arp: boolean;
  swing: number;
}

const STYLES: Style[] = [
  { bpm: 88, root: 146.8, scale: [0, 3, 5, 7, 10], lead: 'sine', bass: 'sine', kick: true, snare: 'frame', hats: false, pad: false, arp: false, swing: 0.1 },
  { bpm: 94, root: 146.8, scale: [0, 1, 4, 5, 7, 8, 10], lead: 'triangle', bass: 'sine', kick: true, snare: 'frame', hats: false, pad: true, arp: false, swing: 0.08 },
  { bpm: 100, root: 146.8, scale: [0, 2, 3, 5, 7, 9, 10], lead: 'triangle', bass: 'triangle', kick: true, snare: 'snare', hats: false, pad: true, arp: false, swing: 0.05 },
  { bpm: 106, root: 174.6, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'square', bass: 'triangle', kick: true, snare: 'snare', hats: false, pad: false, arp: false, swing: 0 },
  { bpm: 110, root: 130.8, scale: [0, 2, 3, 5, 7, 8, 11], lead: 'square', bass: 'sawtooth', kick: true, snare: 'snare', hats: true, pad: false, arp: true, swing: 0 },
  { bpm: 118, root: 138.6, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'sawtooth', bass: 'sawtooth', kick: true, snare: 'clap', hats: true, pad: true, arp: true, swing: 0 },
  { bpm: 124, root: 130.8, scale: [0, 3, 5, 7, 10], lead: 'sawtooth', bass: 'sawtooth', kick: true, snare: 'clap', hats: true, pad: true, arp: true, swing: 0 },
];

class Music {
  private style: Style = STYLES[0]!;
  private step = 0;
  private nextTime = 0;
  private playing = false;
  private readonly out: GainNode;
  private melody: number[] = [];
  private bassLine: number[] = [];
  private intensity = 0.3;
  private bar = 0;

  constructor(
    private readonly ctx: AudioContext,
    bus: AudioNode,
    private readonly noise: AudioBuffer,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    this.out.connect(lp).connect(bus);
  }

  setAge(age: number): void {
    this.style = STYLES[Math.min(STYLES.length - 1, age)]!;
    let seed = 7 + age * 31;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const n = this.style.scale.length;
    this.melody = Array.from({ length: 32 }, (_, i) => (i % 4 === 3 || rnd() < 0.3 ? -1 : Math.floor(rnd() * n) + (rnd() < 0.25 ? n : 0)));
    const prog = [0, 0, 3, 4].map((d) => this.style.scale[d % n]!);
    this.bassLine = Array.from({ length: 16 }, (_, i) => (i % 4 === 0 || (i % 4 === 2 && rnd() < 0.5) ? prog[Math.floor(i / 4)]! : -1));
    if (!this.playing) {
      this.playing = true;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.step = 0;
    }
  }

  setIntensity(v: number): void {
    this.intensity += (Math.max(0, Math.min(1, v)) - this.intensity) * 0.05;
  }

  stop(): void {
    this.playing = false;
  }

  schedule(): void {
    if (!this.playing) return;
    const ahead = this.ctx.currentTime + 0.15;
    const sixteenth = 60 / this.style.bpm / 4;
    while (this.nextTime < ahead) {
      const swing = this.step % 2 === 1 ? this.style.swing * sixteenth : 0;
      this.note(this.step, this.nextTime + swing);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 32;
      if (this.step === 0) this.bar++;
    }
  }

  private freq(degree: number, octave = 0): number {
    const n = this.style.scale.length;
    const d = ((degree % n) + n) % n;
    const oct = Math.floor(degree / n) + octave;
    return this.style.root * Math.pow(2, (this.style.scale[d]! + oct * 12) / 12);
  }

  private voice(t: number, type: OscillatorType, f: number, dur: number, vol: number, attack = 0.01, cutoff = 3000): void {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private drum(t: number, kind: 'kick' | 'snare' | 'hat' | 'clap' | 'frame', vol: number): void {
    const ctx = this.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 0.32);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const len = kind === 'hat' ? 0.04 : kind === 'frame' ? 0.18 : 0.14;
    f.type = kind === 'hat' ? 'highpass' : kind === 'frame' ? 'lowpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : kind === 'frame' ? 900 : kind === 'clap' ? 1500 : 2000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random());
    src.stop(t + len + 0.02);
  }

  private note(step: number, t: number): void {
    const s = this.style;
    const beat = step % 4 === 0;
    const k = 0.4 + this.intensity * 0.6;
    if (s.kick && (step % 8 === 0 || (this.intensity > 0.5 && step % 8 === 6))) this.drum(t, 'kick', 0.55 * k);
    if (s.snare !== 'none' && step % 8 === 4) this.drum(t, s.snare === 'frame' ? 'frame' : s.snare === 'clap' ? 'clap' : 'snare', 0.25 * k);
    if (s.hats && step % 2 === 0) this.drum(t, 'hat', (step % 4 === 2 ? 0.1 : 0.05) * k);
    const b = this.bassLine[step % 16]!;
    if (b >= 0) {
      const f = this.style.root * Math.pow(2, (b - 12) / 12);
      this.voice(t, s.bass, f, 0.35, 0.18, 0.01, s.bass === 'sawtooth' ? 500 : 1200);
    }
    const m = this.melody[step]!;
    if (m >= 0 && (this.bar % 2 === 1 || this.intensity > 0.35) && step % 2 === 0) {
      this.voice(t, s.lead, this.freq(m, 1), 0.3, 0.05 + 0.03 * this.intensity, 0.01, s.lead === 'sawtooth' ? 1800 : 3000);
    }
    if (s.arp && this.intensity > 0.25) {
      const deg = [0, 2, 4, 2][step % 4]!;
      this.voice(t, 'square', this.freq(deg + (Math.floor(this.bar / 2) % 2) * 3, 2), 0.1, 0.022 * k, 0.005, 2400);
    }
    if (s.pad && step % 16 === 0) {
      for (const d of [0, 2, 4]) this.voice(t, 'sawtooth', this.freq(d + (this.bar % 2 ? 3 : 0), 0), 2.4, 0.018, 0.6, 900);
    }
    if (beat && step % 16 === 0 && !s.pad) this.voice(t, 'sine', this.freq(0, -1), 1.6, 0.05, 0.3, 600);
  }
}
