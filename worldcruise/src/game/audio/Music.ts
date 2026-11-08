/** Tiny procedural lo-fi sequencer: pads, bass, plucked arpeggios and soft drums. */

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

const SONGS = {
  menu: {
    bpm: 82,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    arp: 0.55,
    drums: 0.7,
  },
  drive: {
    bpm: 98,
    chords: [[45, 52, 55, 60], [41, 48, 52, 57], [48, 52, 55, 59], [43, 50, 53, 59]],
    arp: 0.7,
    drums: 1,
  },
};

export class Music {
  private out: GainNode;
  private filter: BiquadFilterNode;
  private noise: AudioBuffer;
  private timer: number | null = null;
  private song: keyof typeof SONGS | null = null;
  private step = 0;
  private nextTime = 0;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(this.filter).connect(dest);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  play(song: keyof typeof SONGS) {
    if (this.song === song && this.timer !== null) return;
    this.song = song;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.out.gain.setTargetAtTime(1, this.ctx.currentTime, 0.8);
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 90);
  }

  stop() {
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    const t = this.timer;
    this.timer = null;
    this.song = null;
    if (t !== null) setTimeout(() => clearInterval(t), 1500);
  }

  setMuffled(on: boolean) {
    this.filter.frequency.setTargetAtTime(on ? 700 : 18000, this.ctx.currentTime, 0.2);
  }

  private schedule() {
    if (!this.song) return;
    const s = SONGS[this.song];
    const stepDur = 60 / s.bpm / 2; // eighth notes
    while (this.nextTime < this.ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextTime, stepDur, s);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playStep(step: number, t: number, dur: number, s: (typeof SONGS)['menu']) {
    const bar = Math.floor(step / 8) % s.chords.length;
    const inBar = step % 8;
    const chord = s.chords[bar];
    if (inBar === 0) {
      for (const n of chord) this.pad(midi(n), t, dur * 8);
      this.bass(midi(chord[0] - 12), t, dur * 3);
    }
    if (inBar === 4) this.bass(midi(chord[0] - 12 + (Math.random() < 0.5 ? 7 : 0)), t, dur * 2.5);
    if (Math.random() < s.arp && inBar % 1 === 0) {
      const n = chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.5 ? 12 : 24);
      this.pluck(midi(n), t, dur * 1.8);
    }
    const dv = s.drums;
    if (inBar === 0 || inBar === 5) this.kick(t, 0.5 * dv);
    if (inBar === 2 || inBar === 6) this.snare(t, 0.18 * dv);
    this.hat(t, (inBar % 2 ? 0.04 : 0.07) * dv);
  }

  private pad(f: number, t: number, d: number) {
    const ctx = this.ctx;
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.018, t + d * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + d);
      o.connect(lp).connect(g).connect(this.out);
      o.start(t);
      o.stop(t + d + 0.1);
    }
  }

  private bass(f: number, t: number, d: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + d + 0.05);
  }

  private pluck(f: number, t: number, d: number) {
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    o.connect(lp).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + d + 0.05);
  }

  private kick(t: number, v: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.3);
  }

  private noiseHit(t: number, v: number, type: BiquadFilterType, freq: number, d: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f).connect(g).connect(this.out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + d + 0.02);
  }

  private snare(t: number, v: number) {
    this.noiseHit(t, v, 'bandpass', 1800, 0.16);
  }

  private hat(t: number, v: number) {
    this.noiseHit(t, v * 0.6, 'highpass', 8000, 0.04);
  }
}
