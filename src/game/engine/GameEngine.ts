import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { InputManager } from '../input/InputManager';
import { AudioManager } from '../audio/AudioManager';
import { Sky, createCityEnvMap } from '../environment/Sky';
import { Road } from '../environment/Road';
import { City } from '../environment/City';
import { Props } from '../environment/Props';
import { Tunnel } from '../environment/Tunnel';
import { createGlowTexture } from '../environment/textures';
import { TrafficSystem, type TrafficUpdateContext } from '../traffic/TrafficSystem';
import { CoinSystem } from '../economy/CoinSystem';
import { ParticleSystem } from '../effects/Particles';
import { SkidMarks } from '../effects/SkidMarks';
import { SpeedLines } from '../effects/SpeedLines';
import { PlayerController, emptyInput, type DriveInput } from '../player/PlayerController';
import { Autopilot } from '../player/Autopilot';
import { checkCollisions } from '../collision/CollisionSystem';
import { ScoreSystem } from '../scoring/ScoreSystem';
import { emptyRunStats, TIME_TRIAL_SECONDS, type RunStats } from '../scoring/runStats';
import { buildCar, setCarTextures, setUnderglow, applyPaint, type CarVisual } from '../vehicles/carFactory';
import { Showroom } from './Showroom';
import { effectiveStats } from '../../data/upgrades';
import { LANES_X, MAX_ARMOR, NEAR_MISS_GAP, ULTRA_NEAR_GAP, BARRIER_X } from '../constants';
import { clamp, createRng, damp, lerp, type Rng } from '../../utils/math';
import type { Appearance, EngineCallbacks, EngineSettings, EngineView, HudSnapshot, RunConfig, RunPhase } from './types';

const SIM_STEP = 1 / 120;
const COUNTDOWN = 2.4;
const HUD_INTERVAL = 1 / 12;

const tmpColor = new THREE.Color();

/**
 * Owns the renderer, the scenes and every gameplay system. React talks to it only through its
 * public methods and the callbacks it fires — no game state lives in React components.
 */
export class GameEngine {
  readonly input = new InputManager();
  readonly audio = new AudioManager();

  private container: HTMLElement;
  private cb: EngineCallbacks;
  private settings: EngineSettings;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private renderPass!: RenderPass;
  private bloom!: UnrealBloomPass;
  private bloomEnabled = true;
  private envRT!: THREE.WebGLRenderTarget;
  private glowTex!: THREE.Texture;

  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1700);
  private worldGroup = new THREE.Group();
  private sky!: Sky;
  private road!: Road;
  private city!: City;
  private props!: Props;
  private tunnel!: Tunnel;
  private traffic!: TrafficSystem;
  private coins!: CoinSystem;
  private smoke!: ParticleSystem;
  private sparks!: ParticleSystem;
  private skid!: SkidMarks;
  private speedLines!: SpeedLines;
  private showroom!: Showroom;
  private hemi!: THREE.HemisphereLight;
  private moon!: THREE.DirectionalLight;
  private headlight!: THREE.SpotLight;

  private player = new PlayerController();
  private autopilot = new Autopilot();
  private aiInput: DriveInput = emptyInput();
  private idleInput: DriveInput = emptyInput();
  private lastInput: DriveInput = emptyInput();
  private car: CarVisual | null = null;
  private carKey = '';
  private wheelRadius = 0.35;
  private score = new ScoreSystem();
  private run: RunStats = emptyRunStats('endless', 'street_racer');
  private appearance: Appearance | null = null;
  private view: EngineView = 'attract';
  private phase: RunPhase = 'ended';
  private paused = false;
  private armor = MAX_ARMOR;
  private timeLeft = 0;
  private countdownT = 0;
  private lastCountdownShown = -1;
  private wreckT = 0;
  private timeScale = 1;
  private cleanStart = 0;
  private rng: Rng = createRng(1);
  private coinRng: Rng = createRng(2);
  private time = 0;
  private trauma = 0;
  private baseFov = 62;
  private aspect = 1;
  private camPos = new THREE.Vector3(0, 3, 7);
  private camLook = new THREE.Vector3(0, 1, -12);
  private fov = 62;
  private tunnelF = 0;
  private smokeColor = new THREE.Color('#d8dce6');
  private rainbowSmoke = false;
  private hudTimer = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 60;
  private raf = 0;
  private lastFrame = 0;
  private resizeObs: ResizeObserver | null = null;
  private disposed = false;
  private dragging: { x: number } | null = null;

  constructor(container: HTMLElement, settings: EngineSettings, callbacks: EngineCallbacks) {
    this.container = container;
    this.settings = settings;
    this.cb = callbacks;
  }

  async init() {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('900 40px Orbitron'), document.fonts.load('700 40px Rajdhani')]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch {
      /* fonts are optional */
    }
    if (this.disposed) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;
    renderer.domElement.className = 'game-canvas';
    this.container.appendChild(renderer.domElement);

    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.envRT = createCityEnvMap(renderer);
    this.glowTex = createGlowTexture();

    // ---- world scene ----
    const scene = this.scene;
    scene.background = new THREE.Color('#05030c');
    scene.fog = new THREE.FogExp2('#1b0e30', 0.0042);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = 0.8;
    this.hemi = new THREE.HemisphereLight('#6a4ab8', '#120a1c', 0.9);
    this.moon = new THREE.DirectionalLight('#9ab0ff', 0.7);
    this.moon.position.set(-30, 60, -40);
    this.headlight = new THREE.SpotLight('#eaf4ff', 900, 90, 0.42, 0.65, 1.4);
    scene.add(this.hemi, this.moon, this.headlight, this.headlight.target);

    this.sky = new Sky();
    this.road = new Road(aniso);
    this.city = new City(this.settings.quality);
    this.props = new Props(this.glowTex);
    this.tunnel = new Tunnel();
    this.traffic = new TrafficSystem();
    this.coins = new CoinSystem();
    this.smoke = new ParticleSystem(this.settings.quality === 'low' ? 220 : 420, false, 0.15);
    this.sparks = new ParticleSystem(300, true, 0.0);
    this.skid = new SkidMarks();
    this.speedLines = new SpeedLines();
    scene.add(this.sky.group, this.road.group, this.worldGroup, this.speedLines.mesh);
    this.worldGroup.add(
      this.road.worldProps, this.city.group, this.props.group, this.tunnel.group, this.traffic.group,
      this.coins.group, this.skid.mesh, this.smoke.points, this.sparks.points,
    );

    this.showroom = new Showroom(this.envRT.texture, this.glowTex);

    // ---- post ----
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.settings.quality === 'high' ? 4 : 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.9);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.applySettings(this.settings);
    this.resetWorld(0, 12345);
    this.setupEvents();
    this.resize();
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ======================= public API =======================

  setAppearance(a: Appearance) {
    this.appearance = a;
    if (this.view !== 'play') this.ensureCar(a);
    this.showroom?.setCar(a.vehicle, a.paint, a.underglow);
  }

  setView(view: EngineView) {
    if (view === this.view) return;
    const fromPlay = this.view === 'play';
    this.view = view;
    if (view !== 'play') {
      this.paused = false;
      if (fromPlay) {
        this.phase = 'ended';
        this.audio.stopEngine();
        this.audio.setMuffled(false);
        this.audio.playMusic('menu');
        if (this.appearance) this.ensureCar(this.appearance);
        this.resetWorld(0, Math.floor(Math.random() * 1e9));
      }
    }
    this.resize();
  }

  startRun(cfg: RunConfig) {
    this.view = 'play';
    this.phase = 'countdown';
    this.paused = false;
    this.timeScale = 1;
    this.ensureCar({ vehicle: cfg.vehicle, paint: cfg.paint, underglow: cfg.underglow });
    this.player.configure(effectiveStats(cfg.vehicle, cfg.upgrades), this.car!.width, this.car!.length);
    this.player.reset(0, LANES_X[1], 100);
    this.resetWorld(0, cfg.seed);
    this.score.reset();
    this.run = emptyRunStats(cfg.mode, cfg.vehicle.id);
    this.armor = MAX_ARMOR;
    this.timeLeft = cfg.mode === 'timetrial' ? TIME_TRIAL_SECONDS : 0;
    this.countdownT = COUNTDOWN;
    this.lastCountdownShown = -1;
    this.cleanStart = 0;
    this.wreckT = 0;
    this.trauma = 0;
    this.input.clear();
    this.rainbowSmoke = cfg.smoke === 'rainbow';
    if (!this.rainbowSmoke) this.smokeColor.set(cfg.smoke);
    // swoop in from a front three-quarter view
    this.camPos.set(4, 1.6, -8);
    this.camLook.set(0, 0.8, 0);
    this.audio.unlock();
    this.audio.setMuffled(false);
    this.audio.playMusic('game');
    this.audio.startEngine();
    this.resize();
  }

  pause() {
    if (this.view !== 'play' || this.paused || this.phase === 'ended') return;
    this.paused = true;
    this.input.clear();
    this.audio.stopEngine();
    this.audio.setMuffled(true);
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.lastFrame = performance.now();
    this.audio.setMuffled(false);
    this.audio.startEngine();
  }

  get isPaused() {
    return this.paused;
  }

  get isRunning() {
    return this.view === 'play' && (this.phase === 'running' || this.phase === 'countdown');
  }

  /** Adds an in-run score bonus (e.g. when the UI detects a mission completion). */
  awardBonus(points: number, label: string) {
    if (this.view === 'play' && this.phase === 'running') {
      this.score.bonus(points, label, 'orange');
      this.audio.fanfare();
    }
  }

  applySettings(s: EngineSettings) {
    this.settings = s;
    this.audio.setVolumes(s.masterVolume, s.musicVolume, s.sfxVolume, s.muted);
    if (!this.renderer) return;
    const dpr = window.devicePixelRatio || 1;
    const pr = s.quality === 'high' ? Math.min(dpr, 2) : s.quality === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.bloomEnabled = s.quality !== 'low';
    this.speedLines.mesh.visible = s.quality !== 'low';
    this.resize();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.audio.dispose();
    this.resizeObs?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (!this.renderer) return;
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.car?.dispose();
    for (const sys of [this.sky, this.road, this.city, this.props, this.tunnel, this.traffic, this.coins, this.smoke, this.sparks, this.skid, this.speedLines, this.showroom]) sys.dispose();
    this.envRT.dispose();
    this.glowTex.dispose();
    this.composer.dispose();
    this.bloom.dispose();
    this.renderer.dispose();
    el.remove();
  }

  // ======================= setup =======================

  private setupEvents() {
    this.input.attach();
    this.input.onPauseKey = () => this.cb.onPauseRequest();
    this.input.onAnyKey = () => this.audio.unlock();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.container);
    document.addEventListener('visibilitychange', this.onVisibility);
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private onVisibility = () => {
    if (document.hidden && this.isRunning && !this.paused) this.cb.onPauseRequest();
  };
  private onPointerDown = (e: PointerEvent) => {
    this.audio.unlock();
    if (this.view === 'garage') this.dragging = { x: e.clientX };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.showroom.drag(e.clientX - this.dragging.x);
    this.dragging.x = e.clientX;
  };
  private onPointerUp = () => {
    this.dragging = null;
  };

  private resize() {
    if (!this.renderer) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    const aspect = w / h;
    this.aspect = aspect;
    this.camera.aspect = aspect;
    if (this.camera.view?.enabled) this.camera.clearViewOffset();
    // keep a usable horizontal field of view on portrait screens
    const hTarget = (78 * Math.PI) / 180;
    const v = aspect >= 1.15 ? 62 : clamp((2 * Math.atan(Math.tan(hTarget / 2) / aspect) * 180) / Math.PI, 62, 98);
    this.baseFov = v;
    this.camera.updateProjectionMatrix();
    this.showroom.resize(aspect);
  }

  private ensureCar(a: Appearance) {
    const key = a.vehicle.id;
    if (!this.car || this.carKey !== key) {
      if (this.car) {
        this.scene.remove(this.car.root);
        this.car.dispose();
      }
      this.car = buildCar(a.vehicle.model, a.paint);
      setCarTextures(this.car, this.glowTex);
      this.scene.add(this.car.root);
      this.carKey = key;
      this.wheelRadius = a.vehicle.model.wheelRadius;
      this.player.configure(effectiveStats(a.vehicle, { speed: 0, acceleration: 0, handling: 0, drift: 0, braking: 0 }), this.car.width, this.car.length);
    } else {
      applyPaint(this.car.paint, a.paint);
    }
    setUnderglow(this.car, a.underglow);
  }

  private resetWorld(s: number, seed: number) {
    this.rng = createRng(seed);
    this.coinRng = createRng(seed ^ 0x9e3779b9);
    if (this.view !== 'play') this.player.reset(s, LANES_X[1], 150);
    this.player.s = s;
    this.road.reset(s);
    this.city.reset(s, seed ^ 0x5bd1e995);
    this.props.reset(s);
    this.tunnel.reset(s);
    this.traffic.reset(s);
    this.coins.reset(s);
    this.skid.clear();
    this.smoke.clear();
    this.sparks.clear();
    const ctx = this.trafficCtx(0.15);
    this.traffic.prefill(ctx);
  }

  private trafficCtx(difficulty: number): TrafficUpdateContext {
    return { playerS: this.player.s, playerSpeed: this.player.totalSpeed, difficulty, spawn: true, rng: this.rng };
  }

  private difficulty() {
    if (this.view !== 'play') return 0.3;
    if (this.run.mode === 'timetrial') return clamp(0.3 + (this.run.time / TIME_TRIAL_SECONDS) * 0.7, 0, 1);
    return Math.pow(clamp(this.run.distance / 9000, 0, 1), 0.85);
  }

  // ======================= loop =======================

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const realDt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.fpsFrames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }

    if (this.view === 'garage') {
      this.showroom.update(realDt);
      this.render(this.showroom.scene, this.showroom.camera);
      return;
    }
    if (this.paused) {
      this.render(this.scene, this.camera);
      return;
    }

    if (this.phase === 'wrecking') {
      this.wreckT += realDt;
      this.timeScale = this.wreckT < 0.9 ? 0.3 : damp(this.timeScale, 1, 2, realDt);
      if (this.wreckT > 2.1) this.endRun('wrecked');
    }
    const dt = realDt * this.timeScale;
    this.time += dt;
    const steps = Math.max(1, Math.ceil(dt / SIM_STEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h);
    this.updateVisuals(dt, realDt);
    this.render(this.scene, this.camera);

    if (this.view === 'play') {
      this.hudTimer -= realDt;
      if (this.hudTimer <= 0) {
        this.hudTimer = HUD_INTERVAL;
        this.cb.onHud(this.snapshot());
      }
      if (this.score.popups.length) {
        this.cb.onPopups(this.score.popups.splice(0));
      }
    }
  };

  private render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.bloomEnabled) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  private step(h: number) {
    const p = this.player;
    const playing = this.view === 'play';
    const difficulty = this.difficulty();

    // ---- countdown: rolling start, controls locked ----
    if (playing && this.phase === 'countdown') {
      this.countdownT -= h;
      const n = Math.ceil((this.countdownT / COUNTDOWN) * 3);
      if (n !== this.lastCountdownShown && n > 0) {
        this.lastCountdownShown = n;
        this.cb.onCountdown(n);
        this.audio.countdown(false);
      }
      p.s += p.totalSpeed * h;
      if (this.countdownT <= 0) {
        this.phase = 'running';
        this.cb.onCountdown(0);
        this.audio.countdown(true);
        p.boost = 6;
        setTimeout(() => this.cb.onCountdown(null), 700);
      }
      this.traffic.update(h, { ...this.trafficCtx(difficulty) });
      return;
    }

    let input: DriveInput;
    if (!playing) {
      this.autopilot.update(h, p, this.traffic.cars, this.aiInput);
      input = this.aiInput;
    } else if (this.phase === 'running') {
      input = this.input.read();
    } else {
      input = this.idleInput;
    }
    this.lastInput = input;

    const prevS = p.s;
    const driftEnd = p.update(h, input, difficulty);
    const running = playing && this.phase === 'running';

    if (running) {
      if (driftEnd) {
        if (driftEnd.valid) {
          this.score.bankDrift(driftEnd.time);
          this.run.drifts++;
          this.audio.driftBank(driftEnd.time > 2.5);
          this.audio.combo(this.score.combo);
        } else {
          this.score.driftPoints = 0;
        }
      }
      if (p.drifting && Math.abs(p.driftAngle) > 0.14) {
        this.score.driftTick(h, p.totalSpeed, p.stats.drift);
        this.run.totalDriftTime += h;
        this.run.longestDrift = Math.max(this.run.longestDrift, p.driftTime);
      }
    }

    this.traffic.update(h, this.trafficCtx(difficulty));

    if (running) {
      const col = checkCollisions(p, this.traffic.cars, NEAR_MISS_GAP);
      if (col.hit) this.onHit(col.hit);
      for (const nm of col.nearMisses) {
        const rare = nm.car.def.kind === 'vault';
        this.score.nearMiss(nm.gap, rare);
        this.run.nearMisses++;
        if (rare) {
          this.run.rareNearMisses++;
          this.run.coins += 5;
        }
        this.audio.nearMiss(nm.gap < ULTRA_NEAR_GAP);
        this.audio.combo(this.score.combo);
        this.trauma = Math.min(1, this.trauma + 0.12);
        const side = Math.sign(nm.car.x - p.x) || 1;
        for (let i = 0; i < 10; i++) {
          this.sparks.emit({
            x: p.x + side * 1.1, y: 0.8, z: -p.s, vx: side * 3, vy: 1.5, vz: 8, spread: 1.5, life: 0.4,
            size: 0.35, grow: -0.4, color: tmpColor.set(rare ? '#ffd23a' : '#4fe8ff'), alpha: 1,
          });
        }
      }
      for (const c of col.overtakes) {
        this.run.overtakes++;
        this.score.overtake(c.def.points);
      }
      this.run.maxCombo = Math.max(this.run.maxCombo, this.score.combo);
    }

    // ---- coins ----
    const got = this.coins.update(h, p.s, p.x, difficulty, this.coinRng, this.traffic, true, 0);
    if (running && got > 0) {
      this.run.coins += got;
      this.score.coin(got);
      this.audio.coin(got);
      for (let i = 0; i < 12; i++) {
        this.sparks.emit({
          x: p.x, y: 1.0, z: -p.s - 1, vx: 0, vy: 2.5, vz: -p.totalSpeed * 0.8, spread: 2.5, life: 0.45,
          size: 0.3, grow: -0.3, color: tmpColor.set(got > 1 ? '#ff4df2' : '#ffc21a'), alpha: 1, gravity: 4,
        });
      }
    }

    // ---- distance, time, stats ----
    if (running) {
      const ds = p.s - prevS;
      this.run.distance += ds;
      this.run.time += h;
      this.score.addDistance(ds, p.speedKmh);
      this.run.maxSpeed = Math.max(this.run.maxSpeed, p.speedKmh);
      this.run.maxCleanDistance = Math.max(this.run.maxCleanDistance, this.run.distance - this.cleanStart);
      this.score.update(h, p.drifting);
      if (this.run.mode === 'timetrial') {
        this.timeLeft -= h;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.score.message('TIME UP', 'orange', true);
          this.endRun('timeup');
        }
      }
    }

    // ---- barrier scrape sparks ----
    if (p.wallContact > 0 && Math.random() < 0.6) {
      const side = Math.sign(p.x);
      this.sparks.emit({
        x: side * (BARRIER_X - 0.25), y: 0.5, z: -p.s, vx: -side * 1.5, vy: 2.5, vz: p.totalSpeed * 0.4, spread: 1.2,
        life: 0.5, size: 0.25, grow: -0.2, color: tmpColor.set('#ffb340'), alpha: 1, gravity: 9,
      });
    }
  }

  private onHit(car: (typeof this.traffic.cars)[number]) {
    const p = this.player;
    const dirX = Math.sign(p.x - car.x) || (Math.random() < 0.5 ? -1 : 1);
    this.armor--;
    this.run.hits++;
    this.cleanStart = this.run.distance;
    this.score.hit();
    p.hit(dirX);
    this.traffic.knock(car, -dirX, p.totalSpeed);
    this.audio.crash(this.armor <= 0);
    this.trauma = 1;
    for (let i = 0; i < 45; i++) {
      this.sparks.emit({
        x: (p.x + car.x) / 2, y: 0.7, z: -(p.s + Math.min(car.s - p.s, 2)), vx: 0, vy: 3, vz: -p.totalSpeed * 0.3, spread: 5,
        life: 0.7, size: 0.35, grow: -0.3, color: tmpColor.setHSL(0.08 + Math.random() * 0.05, 1, 0.6), alpha: 1, gravity: 9,
      });
    }
    for (let i = 0; i < 14; i++) {
      this.smoke.emit({
        x: (p.x + car.x) / 2, y: 0.8, z: -p.s - 2, vx: 0, vy: 1, vz: -p.totalSpeed * 0.2, spread: 2, life: 1.6,
        size: 2, grow: 3, color: tmpColor.set('#555560'), alpha: 0.4,
      });
    }
    if (this.armor <= 0) {
      p.wreck(dirX);
      this.phase = 'wrecking';
      this.wreckT = 0;
      this.score.message('WRECKED', 'red', true);
    } else {
      this.score.message(this.armor === 1 ? 'CRITICAL DAMAGE' : 'HIT!', 'red', true);
    }
  }

  private endRun(reason: 'wrecked' | 'timeup') {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.timeScale = 1;
    this.run.score = Math.floor(this.score.score);
    this.audio.stopEngine();
    this.audio.gameOver();
    this.cb.onHud(this.snapshot());
    if (this.score.popups.length) this.cb.onPopups(this.score.popups.splice(0));
    this.cb.onRunEnd({ ...this.run }, reason);
  }

  private snapshot(): HudSnapshot {
    const p = this.player;
    this.run.score = Math.floor(this.score.score);
    return {
      mode: this.run.mode,
      phase: this.phase,
      score: Math.floor(this.score.score),
      distance: this.run.distance,
      speedKmh: p.speedKmh,
      topSpeedKmh: p.stats.topSpeed,
      coins: this.run.coins,
      combo: this.score.combo,
      multiplier: this.score.multiplier,
      comboTime: clamp(this.score.comboTimer / 4.5, 0, 1),
      drifting: p.drifting && Math.abs(p.driftAngle) > 0.14,
      driftTime: p.driftTime,
      driftPoints: Math.floor(this.score.driftPoints * this.score.multiplier),
      armor: this.armor,
      timeLeft: this.run.mode === 'timetrial' ? this.timeLeft : null,
      speedTier: this.score.speedTier,
      inTunnel: this.tunnelF > 0.5,
      fps: this.fps,
      run: { ...this.run },
    };
  }

  // ======================= visuals =======================

  private updateVisuals(dt: number, realDt: number) {
    const p = this.player;
    const car = this.car;
    const s = p.s;
    this.worldGroup.position.z = s;

    this.road.update(s);
    this.city.update(s);
    this.props.update(s);
    this.tunnel.update(s);
    this.traffic.render();
    this.coins.render();

    // ---- lighting blend for tunnels ----
    this.tunnelF = this.tunnel.insideFactor(s);
    const tf = this.tunnelF;
    this.hemi.intensity = lerp(0.9, 0.22, tf);
    this.hemi.color.set('#6a4ab8').lerp(tmpColor.set('#ff9a4a'), tf);
    this.moon.intensity = lerp(0.7, 0, tf);
    (this.scene.fog as THREE.FogExp2).color.set('#1b0e30').lerp(tmpColor.set('#120904'), tf);
    this.sky.update(dt, this.camera, tf);

    // ---- car ----
    if (car) {
      car.root.position.set(p.x, 0, 0);
      car.root.rotation.y = p.yaw;
      car.body.rotation.z = p.roll;
      car.body.rotation.x = p.pitch;
      const spin = (p.totalSpeed / this.wheelRadius) * dt;
      for (const w of car.wheels) w.rotation.x -= spin;
      const steerVis = -p.steerSmoothed * 0.32 + (p.drifting ? p.driftAngle * 0.9 : 0);
      for (const fw of car.frontWheels) fw.rotation.y = steerVis;
      car.root.visible = p.invulnerable <= 0 || Math.floor(this.time * 14) % 2 === 0 || this.phase !== 'running';
      const braking = this.lastInput.brake && this.phase === 'running';
      car.tailLights.color.setRGB(braking ? 6 : 2.2, braking ? 0.25 : 0.05, braking ? 0.3 : 0.12);
      this.headlight.position.set(p.x, 1.1, -car.length / 2);
      this.headlight.target.position.set(p.x - Math.sin(p.yaw) * 30, 0, -car.length / 2 - Math.cos(p.yaw) * 30);

      // ---- tyre smoke + skid marks ----
      const driftFx = p.drifting && Math.abs(p.driftAngle) > 0.1;
      const brakeFx = this.lastInput.brake && p.totalSpeed > 28 && this.phase === 'running';
      const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
      if (this.rainbowSmoke) this.smokeColor.setHSL((this.time * 0.25) % 1, 0.9, 0.62);
      car.rearWheels.forEach(([wx, wz], i) => {
        const X = p.x + wx * cy + wz * sy;
        const Z = -wx * sy + wz * cy;
        const ws = s - Z;
        this.skid.track(i as 0 | 1, X, ws, driftFx || brakeFx || p.wrecked);
        if ((driftFx || p.wrecked) && Math.random() < (this.settings.quality === 'low' ? 0.5 : 0.95)) {
          this.smoke.emit({
            x: X, y: 0.3, z: -ws, vx: wx * 0.8, vy: 0.9, vz: -p.totalSpeed * 0.42, spread: 0.8, life: 1.5,
            size: 1.1, grow: 3.4, color: this.smokeColor, alpha: 0.32, drag: 1.2,
          });
        }
      });
    }

    this.smoke.update(dt);
    this.sparks.update(dt);

    // ---- camera ----
    this.updateCamera(realDt);
    const bufferH = this.renderer.domElement.height;
    this.smoke.setViewportScale(bufferH, this.camera.fov);
    this.sparks.setViewportScale(bufferH, this.camera.fov);

    const sf = clamp(p.totalSpeed / Math.max(1, p.topSpeed), 0, 1.3);
    if (this.settings.quality !== 'low') this.speedLines.update(dt, this.camera, p.totalSpeed, this.view === 'play' ? clamp((sf - 0.62) * 2.6, 0, 1) : 0);

    // ---- audio ----
    if (this.view === 'play' && this.phase !== 'ended') {
      const throttle = this.phase === 'countdown' ? 0.6 : this.lastInput.throttle ? 1 : 0.45;
      this.audio.updateEngine(sf, throttle, p.drifting ? clamp(Math.abs(p.driftAngle) * 3, 0, 1) : p.wrecked ? 0.8 : 0, p.wallContact, tf);
    }
  }

  private updateCamera(realDt: number) {
    const p = this.player;
    const cam = this.camera;
    const sf = clamp(p.totalSpeed / Math.max(1, p.topSpeed), 0, 1.3);
    const portrait = this.aspect < 1;
    let targetFov = this.baseFov;

    if (this.view === 'attract') {
      const t = this.time * 0.11;
      const r = 8.5 + Math.sin(this.time * 0.07) * 2;
      const tx = p.x + Math.sin(t) * r;
      const tz = Math.cos(t) * r * 0.9 - 1;
      this.camPos.x = damp(this.camPos.x, tx, 1.5, realDt);
      this.camPos.y = damp(this.camPos.y, 1.5 + Math.sin(this.time * 0.17) * 0.8 + 0.6, 1.5, realDt);
      this.camPos.z = damp(this.camPos.z, tz, 1.5, realDt);
      this.camLook.set(p.x, 0.8, -1.5);
      targetFov = this.baseFov - 6;
    } else if (this.phase === 'countdown') {
      const k = 1 - clamp(this.countdownT / COUNTDOWN, 0, 1);
      const e = k * k * (3 - 2 * k);
      const chase = new THREE.Vector3(p.x * 0.82, portrait ? 3.3 : 2.75, portrait ? 7.6 : 6.6);
      const front = new THREE.Vector3(p.x + 4.2, 1.4, -8);
      this.camPos.lerpVectors(front, chase, e);
      this.camLook.set(p.x * (0.95 * e), lerp(0.7, 1.0, e), lerp(0, -14, e));
    } else {
      const swing = -p.driftAngle * 1.8;
      const tx = p.x * 0.82 + swing;
      const ty = (portrait ? 3.3 : 2.75) - sf * 0.3 + (p.wrecked ? 1.2 : 0);
      const tz = (portrait ? 7.6 : 6.6) + sf * 0.9 + (p.wrecked ? 3 : 0);
      this.camPos.x = damp(this.camPos.x, tx, 5.5, realDt);
      this.camPos.y = damp(this.camPos.y, ty, 4, realDt);
      this.camPos.z = damp(this.camPos.z, tz, 4, realDt);
      const lx = p.x * 0.95 + p.driftAngle * 1.2;
      this.camLook.x = damp(this.camLook.x, lx, 7, realDt);
      this.camLook.y = 1.0;
      this.camLook.z = -14;
      targetFov = this.baseFov + sf * 15 + Math.min(p.boost, 10) * 0.5 + (p.drifting ? 2.5 : 0);
    }

    cam.position.copy(this.camPos);
    // camera shake (trauma²)
    this.trauma = Math.max(0, this.trauma - realDt * 1.6);
    let shake = this.trauma * this.trauma;
    if (this.view === 'play' && this.phase === 'running' && sf > 0.85) shake += (sf - 0.85) * 0.08;
    if (this.settings.cameraShake && shake > 0) {
      cam.position.x += (Math.random() - 0.5) * shake * 0.5;
      cam.position.y += (Math.random() - 0.5) * shake * 0.35;
    }
    cam.lookAt(this.camLook);
    // on wide screens, push the attract-mode car to the right so the menu has room
    // (setViewOffset sets camera.aspect = fullWidth / fullHeight, so pass the real aspect)
    if (this.view === 'attract' && this.aspect > 1.2) cam.setViewOffset(1000 * this.aspect, 1000, -170 * this.aspect, 0, 1000 * this.aspect, 1000);
    else if (cam.view?.enabled) {
      cam.clearViewOffset();
      cam.aspect = this.aspect;
      cam.updateProjectionMatrix();
    }
    if (this.view === 'play') cam.rotateZ(-p.driftAngle * 0.05 - p.vx * 0.003);
    this.fov = damp(this.fov, targetFov, 3, realDt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}
