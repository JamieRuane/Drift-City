import { Music } from './Music';
import { clamp } from '../../utils/math';

/**
 * Procedural audio. The AudioContext is created lazily on the first user gesture (browser autoplay rules).
 * Buses: master → { music, sfx }. Continuous layers: engine, tyre screech, wind, barrier scrape.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private music: Music | null = null;
  private engine: { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private screech: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private wind: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private scrape: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private volumes = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };
  private pendingSong: 'menu' | 'game' | null = 'menu';
  private lastGear = 0;

  get ready() {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture handler. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicBus.connect(this.musicFilter).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.music = new Music(ctx, this.musicBus, this.noise);
    this.applyVolumes();
    if (this.pendingSong) this.music.play(this.pendingSong);
  }

  setVolumes(master: number, music: number, sfx: number, muted: boolean) {
    this.volumes = { master, music, sfx, muted };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volumes.muted ? 0 : this.volumes.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.volumes.music * 0.8, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
  }

  playMusic(song: 'menu' | 'game') {
    this.pendingSong = song;
    this.music?.play(song);
  }

  /** Muffles music (pause menu) */
  setMuffled(on: boolean) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 700 : 20000, this.ctx.currentTime, 0.15);
    this.music?.setIntensity(on ? 0.3 : 1);
  }

  private loopNoise() {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  startEngine() {
    const ctx = this.ctx;
    if (!ctx || this.engine) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.value = 900;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const oscs: OscillatorNode[] = [];
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    ([['sawtooth', 1, 0.5], ['square', 0.5, 0.35], ['sawtooth', 1.5, 0.15]] as const).forEach(([type, mult, lvl]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 60 * mult;
      const g = ctx.createGain();
      g.gain.value = lvl;
      o.connect(g).connect(mix);
      o.start();
      (o as OscillatorNode & { mult: number }).mult = mult;
      oscs.push(o);
    });
    mix.connect(shaper).connect(filter).connect(gain).connect(this.sfxBus);
    this.engine = { oscs, filter, gain };

    const sSrc = this.loopNoise();
    const sFilter = ctx.createBiquadFilter();
    sFilter.type = 'bandpass';
    sFilter.frequency.value = 2100;
    sFilter.Q.value = 7;
    const sGain = ctx.createGain();
    sGain.gain.value = 0;
    sSrc.connect(sFilter).connect(sGain).connect(this.sfxBus);
    sSrc.start();
    this.screech = { src: sSrc, filter: sFilter, gain: sGain };

    const wSrc = this.loopNoise();
    const wFilter = ctx.createBiquadFilter();
    wFilter.type = 'lowpass';
    wFilter.frequency.value = 700;
    const wGain = ctx.createGain();
    wGain.gain.value = 0;
    wSrc.connect(wFilter).connect(wGain).connect(this.sfxBus);
    wSrc.start();
    this.wind = { src: wSrc, gain: wGain };

    const cSrc = this.loopNoise();
    const cFilter = ctx.createBiquadFilter();
    cFilter.type = 'highpass';
    cFilter.frequency.value = 1800;
    const cGain = ctx.createGain();
    cGain.gain.value = 0;
    cSrc.connect(cFilter).connect(cGain).connect(this.sfxBus);
    cSrc.start();
    this.scrape = { src: cSrc, gain: cGain };
  }

  stopEngine() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engine) {
      const e = this.engine;
      e.gain.gain.setTargetAtTime(0, t, 0.08);
      e.oscs.forEach((o) => o.stop(t + 0.5));
      this.engine = null;
    }
    for (const layer of [this.screech, this.wind, this.scrape]) {
      if (!layer) continue;
      layer.gain.gain.setTargetAtTime(0, t, 0.05);
      layer.src.stop(t + 0.4);
    }
    this.screech = this.wind = this.scrape = null;
  }

  /**
   * speedFrac 0..1 of top speed, throttle 0..1, drift 0..1 intensity, wall 0..1, tunnel 0..1.
   */
  updateEngine(speedFrac: number, throttle: number, drift: number, wall: number, tunnel: number) {
    const ctx = this.ctx;
    if (!ctx || !this.engine) return;
    const t = ctx.currentTime;
    const gears = 6;
    const g = clamp(speedFrac, 0, 1.15) * gears * 0.999;
    const gear = Math.min(gears - 1, Math.floor(g));
    const within = gear === gears - 1 ? clamp(g - gear, 0, 1.2) : g - gear;
    const rpm = 1300 + within * 5600 + (gear === 0 ? 0 : 900);
    if (gear !== this.lastGear) this.lastGear = gear;
    const hz = (rpm / 60) * 2;
    for (const o of this.engine.oscs) o.frequency.setTargetAtTime(hz * (o as OscillatorNode & { mult: number }).mult * 0.5, t, 0.04);
    this.engine.filter.frequency.setTargetAtTime(500 + throttle * 2200 + within * 900 + tunnel * 300, t, 0.08);
    this.engine.gain.gain.setTargetAtTime((0.12 + throttle * 0.08 + tunnel * 0.06) * (speedFrac > 0.01 ? 1 : 0.6), t, 0.08);
    if (this.screech) {
      this.screech.gain.gain.setTargetAtTime(drift * 0.16, t, 0.05);
      this.screech.filter.frequency.setTargetAtTime(1900 + Math.sin(t * 13) * 250 + drift * 400, t, 0.03);
    }
    if (this.wind) this.wind.gain.gain.setTargetAtTime(speedFrac * speedFrac * 0.22 * (1 + tunnel * 0.6), t, 0.1);
    if (this.scrape) this.scrape.gain.gain.setTargetAtTime(wall * 0.28, t, 0.03);
  }

  // ---------- one-shots ----------

  private tone(type: OscillatorType, from: number, to: number, start: number, dur: number, level: number, dest: AudioNode = this.sfxBus) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, start);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(level, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(dest);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  private noiseBurst(start: number, dur: number, level: number, type: BiquadFilterType, freq: number, freqTo?: number) {
    const ctx = this.ctx!;
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    n.connect(f).connect(g).connect(this.sfxBus);
    n.start(start, Math.random());
    n.stop(start + dur + 0.02);
  }

  coin(value = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = value > 1 ? 1568 : 1318;
    this.tone('sine', base, base, t, 0.08, 0.16);
    this.tone('sine', base * 1.335, base * 1.335, t + 0.06, 0.16, 0.14);
    if (value > 1) this.tone('triangle', base * 2, base * 2, t + 0.12, 0.25, 0.1);
  }

  nearMiss(ultra: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.35, 0.35, 'bandpass', 600, 3000);
    this.tone('triangle', ultra ? 990 : 880, ultra ? 1480 : 1320, t + 0.02, 0.18, 0.08);
  }

  combo(level: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 440 * Math.pow(2, Math.min(level, 24) / 12);
    this.tone('square', f, f, t, 0.09, 0.035);
  }

  driftBank(big: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, big ? 12 : 7].forEach((s, i) => this.tone('triangle', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), t + i * 0.05, 0.14, 0.07));
  }

  crash(heavy: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, heavy ? 1.1 : 0.55, heavy ? 0.9 : 0.6, 'lowpass', 3000, 200);
    this.tone('sine', 120, 40, t, 0.4, heavy ? 0.7 : 0.45);
    for (let i = 0; i < 4; i++) this.tone('square', 300 + Math.random() * 900, 120 + Math.random() * 200, t + i * 0.04, 0.12, 0.05);
  }

  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone('triangle', 1400, 900, t, 0.05, 0.06);
  }

  purchase() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 7, 12, 19].forEach((s, i) => this.tone('square', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), t + i * 0.06, 0.18, 0.05));
  }

  fanfare() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((s, i) => this.tone('triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), t + i * 0.08, 0.3, 0.08));
  }

  countdown(go: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone('square', go ? 1046 : 523, go ? 1046 : 523, t, go ? 0.45 : 0.18, 0.08);
  }

  denied() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone('square', 220, 160, t, 0.18, 0.06);
  }

  gameOver() {
    this.music?.stop();
    this.music?.sting();
    this.pendingSong = null;
  }

  dispose() {
    this.stopEngine();
    this.music?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}
