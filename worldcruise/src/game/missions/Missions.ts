import * as THREE from 'three';
import type { BuiltCity, PlacedLandmark } from '../world/CityBuilder';
import type { RoadEdge } from '../world/CityLayout';
import { createRng } from '../core/rng';
import { glowTexture } from '../world/textures';

export type GameMode = 'free' | 'explore' | 'checkpoints' | 'timetrial' | 'collect';

export const MODE_INFO: Record<GameMode, { name: string; short: string; description: string; icon: string }> = {
  free: { name: 'Free Roam', short: 'Free', icon: '🚗', description: 'No rules, no timer. Cruise the city, find tokens and stumble on landmarks.' },
  explore: { name: 'Landmark Exploration', short: 'Explore', icon: '🧭', description: 'Your guide arrow points to the nearest undiscovered landmark. Find them all.' },
  checkpoints: { name: 'Checkpoint Challenge', short: 'Checkpoints', icon: '⏱️', description: 'Race through 10 gates. Each one adds precious seconds to the clock.' },
  timetrial: { name: 'Time Trial', short: 'Time Trial', icon: '🏁', description: 'A fixed route across the city. Set a time and chase the gold medal.' },
  collect: { name: 'Collectibles', short: 'Tokens', icon: '⭐', description: 'Hunt down all 25 golden tokens hidden around the city.' },
};

export interface MissionCallbacks {
  onDiscover(l: PlacedLandmark): void;
  onToken(index: number, collected: number, total: number): void;
  onCheckpoint(index: number, total: number, bonus: number): void;
  onFinish(result: { mode: GameMode; success: boolean; time: number; medal?: 'gold' | 'silver' | 'bronze' | null; xp: number }): void;
}

export interface Objective {
  title: string;
  detail: string;
  /** Countdown or elapsed time (s). */
  timer?: number;
  timerKind?: 'down' | 'up';
  progress?: [number, number];
  distance?: number;
}

interface Gate {
  x: number;
  z: number;
  heading: number;
  width: number;
}

/** Discoveries, golden tokens and the timed gate modes. */
export class Missions {
  readonly group = new THREE.Group();
  private tokenMesh: THREE.InstancedMesh;
  private tokenGlow: THREE.InstancedMesh;
  private tokenTaken: boolean[];
  private discovered: Set<string>;
  private gates: Gate[] = [];
  private gateIndex = 0;
  private gateObj: THREE.Group;
  private gateNext: THREE.Group;
  private timer = 0;
  private running = false;
  private finished = false;
  private medalTimes: [number, number, number] = [0, 0, 0];
  private arrow: THREE.Group;
  private arrowMat: THREE.MeshBasicMaterial;
  objective: Objective | null = null;
  target: { x: number; z: number } | null = null;
  private time = 0;

  constructor(
    private city: BuiltCity,
    readonly mode: GameMode,
    discovered: string[],
    tokensTaken: number[],
    private cb: MissionCallbacks,
    seed = Date.now(),
  ) {
    this.discovered = new Set(discovered);
    this.tokenTaken = city.tokens.map((_, i) => tokensTaken.includes(i));

    // tokens: spinning gold stars
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const r = i % 2 === 0 ? 0.9 : 0.4;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) star.moveTo(x, y);
      else star.lineTo(x, y);
    }
    const geo = new THREE.ExtrudeGeometry(star, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 }).translate(0, 0, -0.11);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0xff9a00, emissiveIntensity: 0.55, metalness: 0.8, roughness: 0.25 });
    this.tokenMesh = new THREE.InstancedMesh(geo, mat, city.tokens.length);
    this.tokenGlow = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffc44d, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
      city.tokens.length,
    );
    this.tokenMesh.frustumCulled = false;
    this.tokenGlow.frustumCulled = false;
    this.group.add(this.tokenMesh, this.tokenGlow);

    this.gateObj = this.makeGate(1);
    this.gateNext = this.makeGate(0.45);
    this.gateObj.visible = this.gateNext.visible = false;
    this.group.add(this.gateObj, this.gateNext);

    // guide arrow
    this.arrow = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.3);
    shape.lineTo(0.85, 0);
    shape.lineTo(0.32, 0);
    shape.lineTo(0.32, -0.9);
    shape.lineTo(-0.32, -0.9);
    shape.lineTo(-0.32, 0);
    shape.lineTo(-0.85, 0);
    shape.closePath();
    this.arrowMat = new THREE.MeshBasicMaterial({ color: 0x4de3ff, transparent: true, opacity: 0.9, toneMapped: false, depthTest: false });
    const am = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false }).rotateX(-Math.PI / 2), this.arrowMat);
    am.renderOrder = 10;
    this.arrow.add(am);
    this.arrow.visible = false;
    this.group.add(this.arrow);

    if (mode === 'checkpoints' || mode === 'timetrial') this.buildRoute(mode === 'timetrial' ? hash(city.def.id) : seed);
    this.refreshTokens();
  }

  private makeGate(scale: number) {
    const g = new THREE.Group();
    const col = new THREE.MeshBasicMaterial({ color: 0x4de3ff, toneMapped: false, transparent: true, opacity: scale < 1 ? 0.5 : 1 });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 8).translate(0, 3, 0), col);
      p.position.x = s * 0.5;
      p.name = s < 0 ? 'L' : 'R';
      g.add(p);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.3), col);
    bar.position.y = 6;
    bar.name = 'bar';
    g.add(bar);
    const curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 6).translate(0, 3, 0),
      new THREE.MeshBasicMaterial({ color: 0x4de3ff, transparent: true, opacity: 0.12 * scale, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    curtain.name = 'curtain';
    g.add(curtain);
    return g;
  }

  private placeGate(obj: THREE.Group, gate: Gate) {
    obj.position.set(gate.x, 0, gate.z);
    obj.rotation.y = gate.heading + Math.PI / 2;
    const w = gate.width;
    obj.getObjectByName('L')!.position.x = -w / 2;
    obj.getObjectByName('R')!.position.x = w / 2;
    obj.getObjectByName('bar')!.scale.x = w;
    obj.getObjectByName('curtain')!.scale.x = w;
    obj.rotation.y = gate.heading;
  }

  private buildRoute(seed: number) {
    const L = this.city.layout;
    const rng = createRng(seed);
    const start = L.nearestRoadPoint(this.city.spawn.x, this.city.spawn.z);
    let node = start.edge.b;
    let prevEdge: RoadEdge | null = start.edge;
    const visited: number[] = [];
    const N = 10;
    let total = 0;
    let lastX = this.city.spawn.x, lastZ = this.city.spawn.z;
    while (this.gates.length < N) {
      const n = L.nodes[node];
      let opts = n.edges.map((id) => L.edges[id]).filter((e) => e !== prevEdge && !visited.includes(e.id));
      if (!opts.length) opts = n.edges.map((id) => L.edges[id]);
      const e = rng.pick(opts);
      visited.push(e.id);
      const next = e.a === node ? e.b : e.a;
      const a = L.nodes[node], b = L.nodes[next];
      if (rng.chance(0.62) || this.gates.length === 0) {
        const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
        total += Math.hypot(x - lastX, z - lastZ) * 1.25;
        lastX = x;
        lastZ = z;
        this.gates.push({ x, z, heading: Math.atan2(b.x - a.x, b.z - a.z), width: e.width + 1 });
      }
      prevEdge = e;
      node = next;
    }
    this.medalTimes = [total / 19, total / 15, total / 11.5];
    this.gateIndex = 0;
    this.running = true;
    this.timer = this.mode === 'checkpoints' ? Math.max(14, Math.hypot(this.gates[0].x - this.city.spawn.x, this.gates[0].z - this.city.spawn.z) / 11 + 8) : 0;
    this.showGates();
  }

  private showGates() {
    const g = this.gates[this.gateIndex];
    this.gateObj.visible = !!g;
    if (g) this.placeGate(this.gateObj, g);
    const n = this.gates[this.gateIndex + 1];
    this.gateNext.visible = !!n;
    if (n) this.placeGate(this.gateNext, n);
  }

  private refreshTokens() {
    const m = new THREE.Matrix4();
    this.city.tokens.forEach((t, i) => {
      if (this.tokenTaken[i]) m.makeScale(0, 0, 0);
      else m.makeTranslation(t.x, t.y, t.z);
      this.tokenMesh.setMatrixAt(i, m);
      this.tokenGlow.setMatrixAt(i, m);
    });
    this.tokenMesh.instanceMatrix.needsUpdate = true;
    this.tokenGlow.instanceMatrix.needsUpdate = true;
  }

  get tokensCollected() {
    return this.tokenTaken.filter(Boolean).length;
  }

  markDiscovered(id: string) {
    this.discovered.add(id);
  }

  update(dt: number, pos: THREE.Vector3, heading: number, cam: THREE.Camera) {
    this.time += dt;
    // landmarks
    for (const l of this.city.landmarks) {
      if (this.discovered.has(l.def.id)) continue;
      if (Math.hypot(pos.x - l.x, pos.z - l.z) < l.def.radius) {
        this.discovered.add(l.def.id);
        this.cb.onDiscover(l);
      }
    }
    // tokens (animate + pickup)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const camQ = cam.quaternion;
    this.city.tokens.forEach((t, i) => {
      if (this.tokenTaken[i]) return;
      const d = Math.hypot(pos.x - t.x, pos.z - t.z);
      if (d < 3.6 && Math.abs(pos.y + 1 - t.y) < 4) {
        this.tokenTaken[i] = true;
        m.makeScale(0, 0, 0);
        this.tokenMesh.setMatrixAt(i, m);
        this.tokenGlow.setMatrixAt(i, m);
        this.cb.onToken(i, this.tokensCollected, this.city.tokens.length);
        if (this.mode === 'collect' && this.tokensCollected === this.city.tokens.length) {
          this.cb.onFinish({ mode: 'collect', success: true, time: this.time, xp: 400 });
        }
        return;
      }
      if (d > 300) return;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.time * 2.2 + i);
      m.compose(new THREE.Vector3(t.x, t.y + Math.sin(this.time * 2 + i) * 0.25, t.z), q, s);
      this.tokenMesh.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, t.y, t.z), camQ, s);
      this.tokenGlow.setMatrixAt(i, m);
    });
    this.tokenMesh.instanceMatrix.needsUpdate = true;
    this.tokenGlow.instanceMatrix.needsUpdate = true;

    // gates
    if (this.running && !this.finished) {
      if (this.mode === 'checkpoints') this.timer -= dt;
      else this.timer += dt;
      const g = this.gates[this.gateIndex];
      if (g) {
        const dx = pos.x - g.x, dz = pos.z - g.z;
        const along = Math.abs(dx * Math.sin(g.heading) + dz * Math.cos(g.heading));
        const across = Math.abs(dx * Math.cos(g.heading) - dz * Math.sin(g.heading));
        if (along < 3.5 && across < g.width / 2 + 1) {
          this.gateIndex++;
          let bonus = 0;
          const n = this.gates[this.gateIndex];
          if (this.mode === 'checkpoints' && n) {
            bonus = Math.round(Math.hypot(n.x - g.x, n.z - g.z) / 12.5 + 3);
            this.timer += bonus;
          }
          this.cb.onCheckpoint(this.gateIndex, this.gates.length, bonus);
          if (this.gateIndex >= this.gates.length) {
            this.finished = true;
            this.gateObj.visible = this.gateNext.visible = false;
            if (this.mode === 'timetrial') {
              const [au, ag, br] = this.medalTimes;
              const medal = this.timer <= au ? 'gold' : this.timer <= ag ? 'silver' : this.timer <= br ? 'bronze' : null;
              const xp = medal === 'gold' ? 350 : medal === 'silver' ? 220 : medal === 'bronze' ? 140 : 60;
              this.cb.onFinish({ mode: 'timetrial', success: true, time: this.timer, medal, xp });
            } else this.cb.onFinish({ mode: 'checkpoints', success: true, time: this.timer, xp: 250 });
          } else this.showGates();
        }
      }
      if (this.mode === 'checkpoints' && this.timer <= 0 && !this.finished) {
        this.timer = 0;
        this.finished = true;
        this.gateObj.visible = this.gateNext.visible = false;
        this.cb.onFinish({ mode: 'checkpoints', success: false, time: 0, xp: 15 * this.gateIndex });
      }
      // pulse
      const k = 1 + Math.sin(this.time * 6) * 0.05;
      this.gateObj.scale.set(1, k, 1);
    }

    // objective + guide target
    this.target = null;
    switch (this.mode) {
      case 'explore': {
        let best: PlacedLandmark | null = null, bd = Infinity;
        for (const l of this.city.landmarks) {
          if (this.discovered.has(l.def.id)) continue;
          const d = Math.hypot(pos.x - l.x, pos.z - l.z);
          if (d < bd) { bd = d; best = l; }
        }
        const found = this.city.landmarks.filter((l) => this.discovered.has(l.def.id)).length;
        if (best) {
          this.target = { x: best.x, z: best.z };
          this.objective = { title: 'Find the next landmark', detail: 'Follow the arrow', progress: [found, this.city.landmarks.length], distance: bd };
        } else this.objective = { title: 'City explored!', detail: 'Every landmark discovered', progress: [found, found] };
        break;
      }
      case 'collect': {
        let bi = -1, bd = Infinity;
        this.city.tokens.forEach((t, i) => {
          if (this.tokenTaken[i]) return;
          const d = Math.hypot(pos.x - t.x, pos.z - t.z);
          if (d < bd) { bd = d; bi = i; }
        });
        if (bi >= 0) this.target = this.city.tokens[bi];
        this.objective = { title: bi >= 0 ? 'Collect golden tokens' : 'All tokens collected!', detail: bi >= 0 ? 'Nearest token' : '', progress: [this.tokensCollected, this.city.tokens.length], distance: bi >= 0 ? bd : undefined };
        break;
      }
      case 'checkpoints':
      case 'timetrial': {
        const g = this.gates[this.gateIndex];
        if (g) this.target = g;
        this.objective = {
          title: this.mode === 'checkpoints' ? 'Checkpoint Challenge' : 'Time Trial',
          detail: this.finished ? 'Finished' : 'Drive through the gates',
          timer: this.timer, timerKind: this.mode === 'checkpoints' ? 'down' : 'up',
          progress: [Math.min(this.gateIndex, this.gates.length), this.gates.length],
          distance: g ? Math.hypot(pos.x - g.x, pos.z - g.z) : undefined,
        };
        break;
      }
      default:
        this.objective = null;
    }

    // guide arrow above the car
    if (this.target && !this.finished) {
      this.arrow.visible = true;
      this.arrow.position.set(pos.x, pos.y + 3.4 + Math.sin(this.time * 3) * 0.12, pos.z);
      this.arrow.rotation.y = Math.atan2(this.target.x - pos.x, this.target.z - pos.z);
      // Arrow shape points along -Z of its local frame after rotateX; flip so it points to the target
      this.arrow.rotation.y += Math.PI;
      void heading;
    } else this.arrow.visible = false;
  }

  get medals() {
    return this.medalTimes;
  }

  dispose() {
    this.group.removeFromParent();
  }
}

function hash(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h >>> 0;
}
