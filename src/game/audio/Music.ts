/** Procedural synthwave sequencer. Everything is synthesised with Web Audio — no audio files. */

type Chord = { root: number; minor: boolean };
interface Song {
  bpm: number;
  chords: Chord[];
  kick: string;
  snare: string;
  hat: string;
  bass: string; // 'x' = root, 'o' = octave, '.' = rest
  arp: string; // digits index chord tones, '.' rest
  padLevel: number;
  arpLevel: number;
  bassLevel: number;
  drumLevel: number;
}

const A2 = 45;
const SONGS: Record<'menu' | 'game', Song> = {
  menu: {
    bpm: 92,
    chords: [{ root: A2, minor: true }, { root: A2 - 4, minor: false }, { root: A2 + 3, minor: false }, { root: A2 - 2, minor: false }],
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: 'x.....x.x.......',
    arp: '0.1.2.1.3.2.1.2.',
    padLevel: 0.11, arpLevel: 0.05, bassLevel: 0.16, drumLevel: 0.5,
  },
  game: {
    bpm: 126,
    chords: [{ root: A2, minor: true }, { root: A2, minor: true }, { root: A2 - 4, minor: false }, { root: A2 - 2, minor: false },
      { root: A2 - 7, minor: true }, { root: A2, minor: true }, { root: A2 - 4, minor: false }, { root: A2 - 5, minor: false }],
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: '..x.xx..x.x.xx.x',
    bass: 'xoxoxoxoxoxoxoxo',
    arp: '0123210301232103',
    padLevel: 0.06, arpLevel: 0.045, bassLevel: 0.15, drumLevel: 0.75,
  },
};

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private ctx: AudioContext;
  private out: GainNode;
  private noise: AudioBuffer;
  private delay: DelayNode;
  private song: Song | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private intensity = 1;

  constructor(ctx: AudioContext, destination: AudioNode, noise: AudioBuffer) {
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.connect(destination);
    // feedback delay for the arp
    this.delay = ctx.createDelay(1);
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.out);
  }

  play(name: 'menu' | 'game') {
    const song = SONGS[name];
    if (this.song === song && this.timer !== null) return;
    this.stop();
    this.song = song;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.delay.delayTime.value = (60 / song.bpm) * 0.75;
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0, this.ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.2);
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  /** 0..1 — thins out the arrangement (used while paused / at low speed). */
  setIntensity(v: number) {
    this.intensity = v;
  }

  private schedule() {
    const song = this.song;
    if (!song) return;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(song, this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playStep(song: Song, step: number, t: number, stepDur: number) {
    const i = step % 16;
    const bar = Math.floor(step / 16);
    const chord = song.chords[bar % song.chords.length];
    const tones = [0, chord.minor ? 3 : 4, 7, 12];
    const full = this.intensity > 0.5;
    if (song.kick[i] === 'x') this.kick(t, song.drumLevel);
    if (full && song.snare[i] === 'x') this.snare(t, song.drumLevel);
    if (song.hat[i] === 'x') this.hat(t, song.drumLevel * (i % 4 === 2 ? 1 : 0.6));
    const b = song.bass[i];
    if (b === 'x' || b === 'o') this.bass(t, midiHz(chord.root + (b === 'o' ? 12 : 0)), stepDur * 1.6, song.bassLevel);
    const a = song.arp[i];
    if (full && a !== '.') this.arp(t, midiHz(chord.root + 24 + tones[Number(a)]), song.arpLevel);
    if (i === 0) this.pad(t, chord, stepDur * 16, song.padLevel);
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private kick(t: number, lvl: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.9 * lvl, 0.002, 0.3);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.35);
  }

  private snare(t: number, lvl: number) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.8;
    const g = this.ctx.createGain();
    this.env(g, t, 0.35 * lvl, 0.002, 0.18);
    n.connect(f).connect(g).connect(this.out);
    n.start(t, Math.random() * 1.5);
    n.stop(t + 0.22);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    const og = this.ctx.createGain();
    this.env(og, t, 0.2 * lvl, 0.002, 0.08);
    o.connect(og).connect(this.out);
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, lvl: number) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = this.ctx.createGain();
    this.env(g, t, 0.12 * lvl, 0.001, 0.045);
    n.connect(f).connect(g).connect(this.out);
    n.start(t, Math.random() * 1.5);
    n.stop(t + 0.07);
  }

  private bass(t: number, hz: number, dur: number, lvl: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, lvl, 0.005, dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private arp(t: number, hz: number, lvl: number) {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = hz;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    const g = this.ctx.createGain();
    this.env(g, t, lvl, 0.004, 0.16);
    o.connect(f).connect(g);
    g.connect(this.out);
    g.connect(this.delay);
    o.start(t);
    o.stop(t + 0.2);
  }

  private pad(t: number, chord: Chord, dur: number, lvl: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1300;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + dur * 0.25);
    g.gain.linearRampToValueAtTime(lvl * 0.7, t + dur * 0.85);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g).connect(this.out);
    for (const iv of [0, chord.minor ? 3 : 4, 7]) for (const det of [-9, 9]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiHz(chord.root + 12 + iv);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  /** Short descending sting for game over. */
  sting() {
    const t = this.ctx.currentTime + 0.05;
    [69, 65, 62, 57].forEach((m, k) => this.arp(t + k * 0.16, midiHz(m), 0.08));
  }
}
