import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { initPhysics, PhysicsWorld, FIXED_DT } from '../physics/Physics';
import { buildCity, type BuiltCity, type PlacedLandmark } from '../world/CityBuilder';
import { Materials } from '../world/Materials';
import { Environment } from '../world/Environment';
import { Traffic } from '../world/Traffic';
import { Pedestrians } from '../world/Pedestrians';
import { Effects } from '../world/Effects';
import { PlayerVehicle, emptyInput } from '../vehicle/PlayerVehicle';
import { buildCarParts } from '../vehicle/carModels';
import { CameraRig } from '../camera/CameraRig';
import { Missions, type GameMode } from '../missions/Missions';
import { AudioEngine } from '../audio/AudioEngine';
import { Input } from './Input';
import { CITIES, cityById } from '../cities';
import type { CityId } from '../cities/types';
import { useGame } from '../../store/gameStore';
import { useProfile, type Quality, type Settings } from '../../store/profileStore';
import { levelForXp, vehicleById } from '../../data/vehicles';
import { clamp } from './rng';

const QUALITY: Record<Quality, { pr: number; shadow: number; traffic: number; peds: number; detail: number; fog: [number, number]; bloom: boolean }> = {
  low: { pr: 1, shadow: 0, traffic: 12, peds: 30, detail: 0, fog: [110, 700], bloom: false },
  medium: { pr: 1.25, shadow: 1024, traffic: 22, peds: 60, detail: 1, fog: [150, 1000], bloom: false },
  high: { pr: 2, shadow: 2048, traffic: 32, peds: 100, detail: 2, fog: [170, 1250], bloom: true },
};

const TIME_PRESETS = { morning: 8.3, noon: 13, sunset: 18.35, night: 22.5 } as const;

/**
 * Owns the renderer, the scene and every gameplay system. React talks to it only through its public
 * methods; it reports back by writing to the zustand stores.
 */
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.2, 4000);
  readonly audio = new AudioEngine();
  readonly input = new Input();
  readonly rig: CameraRig;
  private env: Environment;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private useBloom = false;
  private mats: Materials | null = null;
  private city: BuiltCity | null = null;
  private physics: PhysicsWorld | null = null;
  private traffic: Traffic | null = null;
  private peds: Pedestrians | null = null;
  private effects: Effects | null = null;
  private player: PlayerVehicle | null = null;
  private missions: Missions | null = null;
  private hero: { group: THREE.Group; wheels: THREE.Object3D[]; spin: number } | null = null;
  private running = false;
  private acc = 0;
  private last = 0;
  private time = 0;
  private hour = 12;
  private hudTimer = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fps = 60;
  private crashCooldown = 0;
  private quality: Quality = 'medium';
  private settings: Settings;
  private mode: GameMode = 'free';
  private state: 'idle' | 'attract' | 'playing' = 'idle';
  private paused = false;
  private loadToken = 0;
  private drag: { x: number; y: number } | null = null;
  private wheelTmp = [new THREE.Vector3(), new THREE.Vector3()];

  constructor(private container: HTMLElement) {
    this.settings = useProfile.getState().settings;
    this.quality = this.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'game-canvas';
    this.rig = new CameraRig(this.camera);
    this.env = new Environment(this.scene, this.renderer);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.4, 0.95);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.input.onAction = (a) => this.onAction(a);
    window.addEventListener('resize', this.resize);
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.pointerDown);
    window.addEventListener('pointermove', this.pointerMove);
    window.addEventListener('pointerup', this.pointerUp);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.applySettings(this.settings);
    this.resize();
    useProfile.subscribe((s) => {
      if (s.settings !== this.settings) this.applySettings(s.settings);
    });
  }

  // ------------------------------------------------------------------------------------------- lifecycle
  async init() {
    await initPhysics();
    this.running = true;
    this.last = performance.now();
    this.renderer.setAnimationLoop(this.frame);
  }

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].pr));
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  applySettings(s: Settings) {
    const prevQ = this.quality;
    this.settings = s;
    this.quality = s.quality;
    const q = QUALITY[s.quality];
    this.env.setShadowQuality(q.shadow);
    this.renderer.shadowMap.enabled = q.shadow > 0;
    this.env.setFogRange(q.fog[0], q.fog[1]);
    this.useBloom = q.bloom;
    this.audio.setVolumes(s.master, s.music, s.sfx);
    this.rig.sensitivity = s.sensitivity;
    if (prevQ !== s.quality) {
      this.resize();
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
      });
    }
    if (s.timeMode !== 'dynamic') this.hour = TIME_PRESETS[s.timeMode];
    if (this.state === 'playing') this.audio.playMusic(s.driveMusic ? 'drive' : null);
  }

  // ------------------------------------------------------------------------------------------- input
  private pointerDown = (e: PointerEvent) => {
    this.audio.unlock();
    if (this.state !== 'playing') return;
    this.drag = { x: e.clientX, y: e.clientY };
  };
  private pointerMove = (e: PointerEvent) => {
    if (!this.drag) return;
    this.rig.orbit(e.clientX - this.drag.x, e.clientY - this.drag.y);
    this.drag = { x: e.clientX, y: e.clientY };
  };
  private pointerUp = () => {
    this.drag = null;
  };
  private onWheel = (e: WheelEvent) => {
    if (this.state === 'playing') this.rig.wheel(e.deltaY);
  };

  private onAction(a: 'reset' | 'camera' | 'pause' | 'map' | 'horn') {
    const g = useGame.getState();
    if (this.state !== 'playing') return;
    if (a === 'pause') {
      if (g.result) return;
      if (g.mapOpen) g.set({ mapOpen: false });
      else this.setPaused(!this.paused);
      return;
    }
    if (this.paused) return;
    if (a === 'reset') this.resetPlayer();
    if (a === 'camera') {
      const m = this.rig.cycle();
      g.notify({ kind: 'info', title: m === 'hood' ? 'Cockpit camera' : m === 'far' ? 'Far chase camera' : 'Chase camera', icon: '🎥' });
    }
    if (a === 'map') g.set({ mapOpen: !g.mapOpen });
    if (a === 'horn') this.audio.playerHorn();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.input.enabled = !p;
    useGame.getState().set({ paused: p });
    this.audio.setMuffled(p);
  }

  // ------------------------------------------------------------------------------------------- city loading
  async loadCity(id: CityId, onProgress?: (p: number, label: string) => void) {
    const token = ++this.loadToken;
    const def = cityById(id);
    const step = async (p: number, label: string) => {
      onProgress?.(p, label);
      await new Promise((r) => setTimeout(r, 16));
      if (token !== this.loadToken) throw new Error('superseded');
    };
    await step(0.05, `Charting ${def.name}`);
    this.unloadCity();
    const q = QUALITY[this.quality];
    this.mats = new Materials(def.palette.water);
    await step(0.15, 'Raising buildings');
    const city = buildCity(def, this.mats, q.detail);
    this.city = city;
    await step(0.55, 'Paving streets');
    this.scene.add(city.group);
    this.physics = new PhysicsWorld();
    this.physics.addStatic(city.colliders);
    await step(0.7, 'Starting traffic');
    this.traffic = new Traffic(city.layout, this.physics, def, q.traffic, city.spawn);
    this.traffic.onHonk = () => this.audio.horn(0.3, 0.05);
    this.scene.add(this.traffic.group);
    this.peds = new Pedestrians(city.pedRects, q.peds, def.id);
    this.scene.add(this.peds.group);
    this.effects = new Effects();
    this.scene.add(this.effects.group);
    await step(0.85, 'Lighting the sky');
    if (this.settings.timeMode === 'dynamic') this.hour = def.startHour;
    // warm up shaders
    this.camera.position.set(city.spawn.x, 30, city.spawn.z + 40);
    this.camera.lookAt(city.spawn.x, 0, city.spawn.z);
    this.env.update(this.hour, this.time, 0, this.camera.position, this.camera.position);
    this.renderer.compile(this.scene, this.camera);
    await step(1, 'Ready');
    console.info(`[WORLDCRUISE] ${def.name}: ${city.stats.triangles.toLocaleString()} tris, ${city.stats.meshes} meshes, ${city.stats.colliders} colliders`);
    return city;
  }

  private unloadCity() {
    this.endSession();
    this.removeHero();
    this.traffic?.dispose();
    this.peds?.dispose();
    this.effects?.dispose();
    this.city?.dispose();
    this.mats?.dispose();
    this.physics?.dispose();
    this.traffic = null;
    this.peds = null;
    this.effects = null;
    this.city = null;
    this.mats = null;
    this.physics = null;
  }

  get cityData() {
    return this.city;
  }

  /** Current guide-arrow target (landmark, token or gate), for the maps. */
  get guideTarget() {
    return this.missions?.target ?? null;
  }

  // ------------------------------------------------------------------------------------------- sessions
  /** Menu background: a hero car cruising with the traffic, filmed by a cinematic camera. */
  startAttract() {
    this.endSession();
    this.state = 'attract';
    this.setPaused(false);
    this.input.enabled = false;
    this.audio.setEngine(false);
    this.audio.playMusic('menu');
    this.removeHero();
    if (this.traffic && this.traffic.cars.length) {
      const prof = useProfile.getState();
      const spec = vehicleById(prof.vehicle);
      const parts = buildCarParts(spec.body);
      const group = new THREE.Group();
      const paint = new THREE.MeshStandardMaterial({ color: prof.paints[spec.id] ?? spec.defaultPaint, metalness: 0.45, roughness: 0.3, vertexColors: true });
      for (const [g, m] of [
        [parts.paint, paint],
        [parts.trim, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.5 })],
        [parts.glass, new THREE.MeshStandardMaterial({ color: 0x1b2533, metalness: 0.8, roughness: 0.1, vertexColors: true })],
        [parts.head, new THREE.MeshBasicMaterial({ color: 0xffffff })],
        [parts.tail, new THREE.MeshBasicMaterial({ color: 0xaa1111 })],
      ] as const) {
        const mesh = new THREE.Mesh(g, m);
        mesh.castShadow = true;
        group.add(mesh);
      }
      const wheels: THREE.Object3D[] = [];
      for (const w of parts.wheels) {
        const o = new THREE.Mesh(parts.wheel, new THREE.MeshStandardMaterial({ vertexColors: true }));
        o.position.set(w[0], w[1], w[2]);
        o.castShadow = true;
        group.add(o);
        wheels.push(o);
      }
      this.scene.add(group);
      this.hero = { group, wheels, spin: 0 };
      this.traffic.cars[0].max = 12.5;
      this.rig.snap();
    }
  }

  private removeHero() {
    if (this.hero) {
      this.hero.group.removeFromParent();
      this.hero = null;
    }
  }

  startSession(mode: GameMode) {
    if (!this.city || !this.physics) return;
    this.endSession();
    this.removeHero();
    this.mode = mode;
    const prof = useProfile.getState();
    const spec = vehicleById(prof.vehicle);
    const { x, z, heading } = this.city.spawn;
    this.player = new PlayerVehicle(this.physics, spec, prof.paints[spec.id] ?? spec.defaultPaint, x, z, heading);
    this.scene.add(this.player.root);
    const id = this.city.def.id;
    this.missions = new Missions(this.city, mode, prof.discovered[id] ?? [], prof.tokens[id] ?? [], {
      onDiscover: (l) => this.discovered(l),
      onToken: (i, n, total) => {
        useProfile.getState().takeToken(id, i);
        this.giveXp(25);
        this.audio.token();
        useGame.getState().notify({ kind: 'token', title: `Golden token ${n}/${total}`, icon: '⭐', xp: 25 });
      },
      onCheckpoint: (i, total, bonus) => {
        this.audio.checkpoint();
        useGame.getState().notify({ kind: 'checkpoint', title: i >= total ? 'Finish!' : `Checkpoint ${i}/${total}`, body: bonus ? `+${bonus}s` : undefined, icon: '🏁' });
      },
      onFinish: (r) => {
        let newBest = false;
        if (r.mode === 'timetrial') newBest = useProfile.getState().recordTime(id, r.time, r.medal ?? null);
        this.giveXp(r.xp);
        this.audio.discovery();
        useGame.getState().set({ result: { ...r, newBest, medalTimes: this.missions?.medals } });
      },
    });
    this.scene.add(this.missions.group);
    this.effects?.clear();
    this.rig.mode = this.rig.mode ?? 'chase';
    this.rig.snap();
    this.state = 'playing';
    this.setPaused(false);
    this.input.enabled = true;
    this.audio.setEngine(true);
    this.audio.playMusic(this.settings.driveMusic ? 'drive' : null);
    this.acc = 0;
    useGame.getState().set({ result: null, objective: null, mapOpen: false });
  }

  restart() {
    this.startSession(this.mode);
  }

  endSession() {
    this.missions?.dispose();
    this.missions = null;
    this.player?.dispose();
    this.player = null;
    this.audio.setEngine(false);
    if (this.state === 'playing') this.state = 'idle';
  }

  private giveXp(n: number) {
    const before = levelForXp(useProfile.getState().xp).level;
    useProfile.getState().addXp(n);
    const after = levelForXp(useProfile.getState().xp).level;
    if (after > before) {
      useGame.getState().notify({ kind: 'level', title: `Level ${after}!`, body: 'New vehicles may be waiting in the garage.', icon: '🏆' });
    }
  }

  private discovered(l: PlacedLandmark) {
    if (!this.city) return;
    const fresh = useProfile.getState().discover(this.city.def.id, l.def.id);
    if (!fresh) return;
    this.giveXp(l.def.xp);
    this.audio.discovery();
    useGame.getState().notify({ kind: 'landmark', title: l.def.name, body: l.def.description, icon: l.def.icon, xp: l.def.xp });
  }

  resetPlayer() {
    if (!this.player || !this.city) return;
    const p = this.player.position;
    const near = this.city.layout.nearestRoadPoint(p.x, p.z);
    const e = near.edge;
    let h = Math.atan2(e.dx, e.dz);
    const cur = this.player.heading;
    if (Math.cos(h - cur) < 0) h += Math.PI;
    const side = this.city.def.driveSide === 'right' ? 1 : -1;
    const fx = Math.sin(h), fz = Math.cos(h);
    const lane = Math.min(3, e.width / 4) * side;
    this.player.reset(near.x - fz * lane, near.z + fx * lane, h);
    this.rig.snap();
  }

  // ------------------------------------------------------------------------------------------- frame
  private errorCount = 0;
  private frame = () => {
    if (!this.running) return;
    try {
      this.step();
    } catch (e) {
      if (this.errorCount++ < 5) console.error('[WORLDCRUISE] frame error', e);
    }
  };

  private step() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime > 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
    if (!this.city || !this.physics) {
      this.env.update(this.hour, this.time, dt, this.camera.position, this.camera.position);
      this.render();
      return;
    }
    const simulate = !this.paused;
    if (simulate) {
      this.time += dt;
      if (this.settings.timeMode === 'dynamic') this.hour = (this.hour + (dt * 24) / (this.settings.dayMinutes * 60)) % 24;
      this.acc += dt;
      const inp = this.state === 'playing' ? this.input.read(dt) : emptyInput();
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 5) {
        this.acc -= FIXED_DT;
        steps++;
        if (this.player) {
          const flipped = this.player.fixedUpdate(inp, FIXED_DT);
          if (flipped) this.resetPlayer();
        }
        const pp = this.player ? this.player.position : null;
        this.traffic?.fixedUpdate(FIXED_DT, pp ? { x: pp.x, z: pp.z, speed: this.player!.telemetry.speedKmh } : null);
        this.physics.step();
        this.player?.postStep();
        this.handleContacts();
      }
      if (steps === 5) this.acc = 0;
    }
    const alpha = clamp(this.acc / FIXED_DT, 0, 1);
    const night = this.env.night;
    this.mats?.setNight(night, this.time);
    this.audio.night = night;
    this.traffic?.updatePoses(alpha);

    // camera
    if (this.player) {
      this.player.render(alpha, night);
      const v = this.player.velocity();
      this.rig.update(
        { position: this.player.root.position, quaternion: this.player.root.quaternion, heading: this.player.heading, velocity: v, forwardSpeed: this.player.telemetry.forward, boosting: this.player.telemetry.boosting },
        dt, this.physics,
      );
    } else if (this.hero && this.traffic) {
      const c = this.traffic.cars[0];
      this.traffic.hide(0);
      this.hero.group.position.set(c.x, 0, c.z);
      this.hero.group.rotation.y = c.heading;
      this.hero.spin += (c.speed * dt) / 0.35;
      for (const w of this.hero.wheels) w.rotation.x = this.hero.spin;
      this.rig.cinematic(this.hero.group.position, c.heading, this.time, dt, this.physics);
    }

    const focus = this.player ? this.player.root.position : this.hero ? this.hero.group.position : this.camera.position;
    this.env.update(this.hour, this.time, simulate ? dt : 0, focus, this.camera.position);
    if (simulate) {
      for (const a of this.city.animated) a.update(this.time, dt, night);
      this.peds?.update(dt, this.player ? this.player.root.position : null, this.player ? this.player.telemetry.speedKmh / 3.6 : 0, this.camera.position);
      if (this.player && this.missions) this.missions.update(dt, this.player.root.position, this.player.heading, this.camera);
      this.updateCarFx(dt);
      this.effects?.update(dt, this.camera, night);
      this.audio.ambient(dt);
    }
    this.pushHud(dt);
    this.render();
  }

  private updateCarFx(dt: number) {
    const p = this.player;
    if (!p || !this.effects) return;
    const t = p.telemetry;
    this.audio.updateCar(t.rpm, t.throttle, t.speedKmh, t.slip, t.boosting);
    const q = p.root.quaternion;
    const parts = buildCarParts(p.spec.body);
    for (let i = 0; i < 2; i++) {
      const w = parts.wheels[i + 2];
      this.wheelTmp[i].set(w[0], 0, w[2]).applyQuaternion(q).add(p.root.position);
      this.wheelTmp[i].y = 0;
    }
    this.effects.skid(this.wheelTmp, t.slip);
    if (t.slip > 0.4 && Math.random() < t.slip * dt * 40) {
      const k = Math.random() < 0.5 ? 0 : 1;
      this.effects.puff(this.wheelTmp[k].clone().setY(0.3), new THREE.Vector3((Math.random() - 0.5) * 2, 0.6, (Math.random() - 0.5) * 2), false);
    }
    if (t.boosting && Math.random() < dt * 30) {
      const back = new THREE.Vector3(0.35 * (Math.random() < 0.5 ? -1 : 1), 0.45, -parts.length / 2 - 0.1).applyQuaternion(q).add(p.root.position);
      const v = new THREE.Vector3(0, 0, -6).applyQuaternion(q);
      this.effects.puff(back, v, true);
    }
  }

  private handleContacts() {
    if (!this.physics || !this.player) return;
    this.crashCooldown -= FIXED_DT;
    const handle = this.player.collider.handle;
    this.physics.events.drainContactForceEvents((e) => {
      if (e.collider1() !== handle && e.collider2() !== handle) return;
      if (this.crashCooldown > 0) return;
      const s = clamp(e.totalForceMagnitude() / (this.player!.spec.physics.mass * 45), 0, 1);
      if (s < 0.12) return;
      this.crashCooldown = 0.35;
      this.audio.crash(s);
      this.rig.impact(s * 0.8);
    });
  }

  private pushHud(dt: number) {
    this.hudTimer += dt;
    if (this.hudTimer < 1 / 20) return;
    this.hudTimer = 0;
    const g = useGame.getState();
    const p = this.player;
    const pos = p ? p.root.position : this.camera.position;
    const t = p?.telemetry;
    g.set({
      hud: {
        speed: t ? t.speedKmh : 0, gear: t ? t.gear : 'N', rpm: t ? t.rpm : 900, boost: t ? t.boost : 1,
        boosting: !!t?.boosting, drifting: !!t?.drifting, x: pos.x, z: pos.z, heading: p ? p.heading : 0, fps: this.fps,
        camera: this.rig.mode, night: this.env.night, hour: this.hour,
      },
      objective: this.missions?.objective ?? null,
    });
  }

  private render() {
    // bloom only after dusk: in daylight the HDR whites of sunlit walls would bloom too
    const n = this.env.night;
    if (this.useBloom && n > 0.3) {
      this.bloom.strength = 0.55 * Math.min(1, (n - 0.3) / 0.4);
      this.composer.render();
    }
    else this.renderer.render(this.scene, this.camera);
  }

  /** Debug helpers exposed on window for testing in the console. */
  debug() {
    return {
      player: this.player,
      city: this.city,
      traffic: this.traffic,
      setHour: (h: number) => (this.hour = h),
      teleport: (x: number, z: number, h = 0) => this.player?.reset(x, z, h),
      cities: CITIES.map((c) => c.id),
      info: () => ({ calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles, fps: this.fps }),
    };
  }

  dispose() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.unloadCity();
    this.input.dispose();
    this.env.dispose();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
