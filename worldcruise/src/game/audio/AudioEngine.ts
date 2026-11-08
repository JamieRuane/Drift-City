import { Music } from './Music';

/**
 * Fully procedural Web Audio: no sample files. Buses: master → music / sfx / ambience.
 * The AudioContext is created on the first user gesture (autoplay policy).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private noise!: AudioBuffer;
  private music: Music | null = null;
  private engine: { o1: OscillatorNode; o2: OscillatorNode; o3: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; nGain: GainNode; nFilter: BiquadFilterNode } | null = null;
  private tyre: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private wind: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private city: { gain: GainNode } | null = null;
  private vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  private wantMusic: 'menu' | 'drive' | null = 'menu';
  private engineOn = false;
  private nextAmbient = 0;
  night = 0;

  get ready() {
    return !!this.ctx;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    const ctx = new C();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.amb = ctx.createGain();
    this.amb.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b = (b + 0.02 * w) / 1.02;
      d[i] = i % 2 ? w : b * 3.5;
    }
    this.music = new Music(ctx, this.musicBus);
    this.applyVolumes();
    this.startAmbient();
    if (this.wantMusic) this.music.play(this.wantMusic);
    if (this.engineOn) this.startEngine();
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.amb.gain.setTargetAtTime(this.vol.sfx * 0.6, t, 0.05);
  }

  playMusic(song: 'menu' | 'drive' | null) {
    this.wantMusic = song;
    if (!this.music) return;
    if (song) this.music.play(song);
    else this.music.stop();
  }

  private noiseSource() {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.loopStart = Math.random();
    return s;
  }

  private startAmbient() {
    const ctx = this.ctx!;
    // tyre squeal: band-passed noise
    const tg = ctx.createGain();
    tg.gain.value = 0;
    const tf = ctx.createBiquadFilter();
    tf.type = 'bandpass';
    tf.frequency.value = 1500;
    tf.Q.value = 5;
    const ts = this.noiseSource();
    ts.connect(tf).connect(tg).connect(this.sfx);
    ts.start();
    this.tyre = { gain: tg, filter: tf };
    // wind
    const wg = ctx.createGain();
    wg.gain.value = 0;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 600;
    const ws = this.noiseSource();
    ws.connect(wf).connect(wg).connect(this.sfx);
    ws.start();
    this.wind = { gain: wg, filter: wf };
    // distant city rumble
    const cg = ctx.createGain();
    cg.gain.value = 0.06;
    const cf = ctx.createBiquadFilter();
    cf.type = 'lowpass';
    cf.frequency.value = 280;
    const cs = this.noiseSource();
    cs.connect(cf).connect(cg).connect(this.amb);
    cs.start();
    this.city = { gain: cg };
  }

  setEngine(on: boolean) {
    this.engineOn = on;
    if (!this.ctx) return;
    if (on && !this.engine) this.startEngine();
    if (!on && this.engine) {
      const e = this.engine;
      const t = this.ctx.currentTime;
      e.gain.gain.setTargetAtTime(0, t, 0.1);
      e.nGain.gain.setTargetAtTime(0, t, 0.1);
      setTimeout(() => {
        e.o1.stop(); e.o2.stop(); e.o3.stop();
      }, 600);
      this.engine = null;
      this.tyre?.gain.gain.setTargetAtTime(0, t, 0.05);
      this.wind?.gain.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  private startEngine() {
    const ctx = this.ctx!;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o3.type = 'triangle';
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
    g1.gain.value = 0.3;
    g2.gain.value = 0.16;
    g3.gain.value = 0.4;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    o1.connect(g1).connect(filter);
    o2.connect(g2).connect(filter);
    o3.connect(g3).connect(filter);
    filter.connect(shaper).connect(gain).connect(this.sfx);
    const nGain = ctx.createGain();
    nGain.gain.value = 0;
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.Q.value = 1.2;
    const ns = this.noiseSource();
    ns.connect(nFilter).connect(nGain).connect(this.sfx);
    ns.start();
    o1.start(); o2.start(); o3.start();
    this.engine = { o1, o2, o3, filter, gain, nGain, nFilter };
  }

  /** Per-frame vehicle audio. */
  updateCar(rpm: number, throttle: number, speedKmh: number, slip: number, boosting: boolean) {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    const e = this.engine;
    const f = 22 + (rpm / 7200) * 150;
    e.o1.frequency.setTargetAtTime(f, t, 0.03);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    e.o3.frequency.setTargetAtTime(f * 2.01, t, 0.03);
    e.filter.frequency.setTargetAtTime(300 + throttle * 1400 + (rpm / 7200) * 1600 + (boosting ? 800 : 0), t, 0.05);
    e.gain.gain.setTargetAtTime(0.11 + throttle * 0.11 + (rpm / 7200) * 0.06, t, 0.05);
    e.nFilter.frequency.setTargetAtTime(400 + rpm * 0.3, t, 0.05);
    e.nGain.gain.setTargetAtTime(0.012 + throttle * 0.03, t, 0.05);
    this.tyre!.gain.gain.setTargetAtTime(slip * 0.14, t, 0.04);
    this.tyre!.filter.frequency.setTargetAtTime(1100 + slip * 900 + speedKmh * 2, t, 0.05);
    this.wind!.gain.gain.setTargetAtTime(Math.min(0.12, (speedKmh / 220) ** 2 * 0.14), t, 0.1);
    this.wind!.filter.frequency.setTargetAtTime(300 + speedKmh * 6, t, 0.1);
  }

  /** Random city ambience: horns, birds by day, chirping at night. */
  ambient(dt: number) {
    if (!this.ctx) return;
    this.nextAmbient -= dt;
    if (this.nextAmbient > 0) return;
    this.nextAmbient = 2 + Math.random() * 5;
    const r = Math.random();
    if (this.night < 0.5 && r < 0.55) this.bird();
    else if (this.night >= 0.5 && r < 0.5) this.cricket();
    else if (r < 0.8) this.horn(0.25 + Math.random() * 0.2, 0.025);
  }

  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  private tone(freq: number, type: OscillatorType, dur: number, peak: number, bus: GainNode, at = 0, slideTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.01, peak, dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bird() {
    const base = 2200 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 'sine', 0.08, 0.02, this.amb, i * 0.12, base * 1.35);
  }

  private cricket() {
    for (let i = 0; i < 6; i++) this.tone(4200, 'square', 0.025, 0.006, this.amb, i * 0.05);
  }

  horn(dur = 0.4, vol = 0.06) {
    if (!this.ctx) return;
    this.tone(392, 'square', dur, vol, this.amb);
    this.tone(494, 'square', dur, vol * 0.8, this.amb);
  }

  playerHorn() {
    if (!this.ctx) return;
    this.tone(330, 'sawtooth', 0.45, 0.09, this.sfx);
    this.tone(415, 'sawtooth', 0.45, 0.07, this.sfx);
  }

  crash(strength: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.4);
    const g = ctx.createGain();
    this.env(g, t, 0.005, Math.min(0.5, 0.12 + strength * 0.35), 0.45);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t);
    s.stop(t + 0.6);
    this.tone(90, 'sine', 0.3, Math.min(0.5, 0.2 + strength * 0.3), this.sfx, 0, 40);
    if (strength > 0.5) for (let i = 0; i < 4; i++) this.tone(2500 + Math.random() * 3000, 'triangle', 0.08, 0.03, this.sfx, 0.03 + i * 0.04);
  }

  ui(kind: 'hover' | 'click' | 'back' | 'start') {
    if (!this.ctx) return;
    if (kind === 'hover') this.tone(1400, 'sine', 0.04, 0.025, this.sfx);
    else if (kind === 'click') {
      this.tone(880, 'triangle', 0.08, 0.06, this.sfx);
      this.tone(1320, 'sine', 0.1, 0.04, this.sfx, 0.04);
    } else if (kind === 'back') this.tone(660, 'triangle', 0.1, 0.05, this.sfx, 0, 440);
    else {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'triangle', 0.18, 0.06, this.sfx, i * 0.07));
    }
  }

  discovery() {
    if (!this.ctx) return;
    [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => {
      this.tone(f, 'sine', 0.6, 0.07, this.sfx, i * 0.09);
      this.tone(f * 2, 'triangle', 0.3, 0.02, this.sfx, i * 0.09);
    });
  }

  token() {
    if (!this.ctx) return;
    this.tone(1568, 'sine', 0.15, 0.08, this.sfx);
    this.tone(2093, 'sine', 0.25, 0.07, this.sfx, 0.07);
  }

  checkpoint() {
    if (!this.ctx) return;
    this.tone(988, 'square', 0.12, 0.05, this.sfx);
    this.tone(1319, 'square', 0.18, 0.05, this.sfx, 0.09);
  }

  beep(high = false) {
    if (!this.ctx) return;
    this.tone(high ? 1200 : 700, 'square', 0.12, 0.05, this.sfx);
  }

  setMuffled(on: boolean) {
    this.music?.setMuffled(on);
    if (this.ctx && this.engine) this.engine.gain.gain.setTargetAtTime(on ? 0 : 0.12, this.ctx.currentTime, 0.1);
  }
}
