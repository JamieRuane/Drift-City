import * as THREE from 'three';
import { buildTrafficGeometry, TRAFFIC_TYPES, type TrafficKind, type TrafficTypeDef } from '../vehicles/trafficModels';
import { KMH, LANE_COUNT, LANES_X, ONCOMING_LANES_X } from '../constants';
import { approach, clamp, createRng, lerp, type Rng } from '../../utils/math';

export interface TrafficCar {
  def: TrafficTypeDef;
  active: boolean;
  oncoming: boolean;
  s: number;
  x: number;
  lane: number;
  targetLane: number;
  speed: number;
  desiredSpeed: number;
  color: THREE.Color;
  /** -1 left, 1 right, 0 none */
  blink: number;
  blinkTimer: number;
  changeCooldown: number;
  /** set by the collision system */
  passed: boolean;
  minGap: number;
  knocked: boolean;
  vx: number;
  yaw: number;
  yawVel: number;
  boostTimer: number;
}

const SPAWN_AHEAD = 330;
const DESPAWN_BEHIND = 45;
/** Shared flow speed of regular traffic (km/h) before the difficulty ramp. */
const FLOW_KMH = 96;
const KINDS = Object.keys(TRAFFIC_TYPES) as TrafficKind[];

interface KindMeshes {
  body: THREE.InstancedMesh;
  lights: THREE.InstancedMesh;
}

export interface TrafficUpdateContext {
  playerS: number;
  playerSpeed: number;
  difficulty: number;
  spawn: boolean;
  rng: Rng;
}

/** AI traffic: pooled vehicles, row-based fair spawning, car-following, telegraphed lane changes. */
export class TrafficSystem {
  readonly group = new THREE.Group();
  readonly cars: TrafficCar[] = [];
  private meshes = new Map<TrafficKind, KindMeshes>();
  private blinkers: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private nextRowS = 0;
  private nextOncomingS = 0;
  private safeLane = 1;
  private wallCheckTimer = 0;
  private time = 0;
  /** Unseeded RNG for per-frame behaviour (lane changes, oncoming cars). The seeded ctx.rng is only
   *  consumed by row spawning, which depends purely on distance — so a seed always gives the same layout. */
  private fx: Rng = createRng((Math.random() * 2 ** 32) >>> 0);
  private materials: THREE.Material[] = [];

  constructor() {
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.32, envMapIntensity: 1.1 });
    const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.materials.push(bodyMat, lightMat);
    for (const kind of KINDS) {
      const def = TRAFFIC_TYPES[kind];
      const geo = buildTrafficGeometry(kind);
      const body = new THREE.InstancedMesh(geo.body, bodyMat, def.capacity);
      body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(def.capacity * 3).fill(1), 3);
      const lights = new THREE.InstancedMesh(geo.lights, lightMat, def.capacity);
      body.count = lights.count = 0;
      body.frustumCulled = lights.frustumCulled = false;
      this.group.add(body, lights);
      this.meshes.set(kind, { body, lights });
      for (let i = 0; i < def.capacity; i++) this.cars.push(this.blank(def));
    }
    const blinkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.6, 0.1), toneMapped: false });
    this.materials.push(blinkMat);
    this.blinkers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), blinkMat, 80);
    this.blinkers.frustumCulled = false;
    this.blinkers.count = 0;
    this.group.add(this.blinkers);
  }

  private blank(def: TrafficTypeDef): TrafficCar {
    return {
      def, active: false, oncoming: false, s: 0, x: 0, lane: 0, targetLane: 0, speed: 0, desiredSpeed: 0,
      color: new THREE.Color(1, 1, 1), blink: 0, blinkTimer: 0, changeCooldown: 0, passed: false, minGap: Infinity,
      knocked: false, vx: 0, yaw: 0, yawVel: 0, boostTimer: 0,
    };
  }

  reset(playerS: number) {
    for (const c of this.cars) c.active = false;
    this.nextRowS = playerS + 110;
    this.nextOncomingS = playerS;
    this.safeLane = 1;
    this.render();
  }

  /** Pre-populates the road ahead so a run starts with traffic already visible. */
  prefill(ctx: TrafficUpdateContext) {
    while (this.nextRowS < ctx.playerS + SPAWN_AHEAD) this.spawnRow(ctx, this.nextRowS);
    for (let s = ctx.playerS + 40; s < ctx.playerS + 450; s += this.fx.range(30, 70)) this.spawnOncoming(this.fx, s);
  }

  private acquire(kind: TrafficKind) {
    return this.cars.find((c) => !c.active && c.def.kind === kind) ?? null;
  }

  private pickKind(rng: Rng, lane: number, difficulty: number): TrafficKind {
    const weights = KINDS.map((k) => {
      const d = TRAFFIC_TYPES[k];
      let w = d.spawnWeight;
      if ((k === 'truck' || k === 'bus') && lane < 2) w *= 0.25;
      if (k === 'truck' || k === 'bus') w *= 0.7 + difficulty * 0.6;
      if (k === 'sports' && lane > 1) w *= 0.5;
      return w;
    });
    let r = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < KINDS.length; i++) {
      r -= weights[i];
      if (r <= 0) return KINDS[i];
    }
    return 'sedan';
  }

  laneClear(lane: number, s: number, halfWindow: number, ignore?: TrafficCar) {
    for (const c of this.cars) {
      if (!c.active || c.oncoming || c === ignore || c.knocked) continue;
      if ((c.lane === lane || c.targetLane === lane) && Math.abs(c.s - s) < halfWindow + c.def.length / 2) return false;
    }
    return true;
  }

  private spawnRow(ctx: TrafficUpdateContext, s: number) {
    const { rng, difficulty } = ctx;
    // the guaranteed escape lane random-walks by at most one lane per row
    this.safeLane = clamp(this.safeLane + rng.int(-1, 1), 0, LANE_COUNT - 1);
    const r = rng.next();
    const p3 = lerp(0.0, 0.3, difficulty), p2 = lerp(0.25, 0.5, difficulty);
    const blocked = r < p3 ? 3 : r < p3 + p2 ? 2 : 1;
    const candidates = [0, 1, 2, 3].filter((l) => l !== this.safeLane);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (const lane of candidates.slice(0, blocked)) {
      const offset = rng.range(-3, 3);
      if (!this.laneClear(lane, s + offset, 15)) continue;
      const kind = this.pickKind(rng, lane, difficulty);
      const car = this.acquire(kind);
      if (!car) continue;
      this.activate(car, lane, s + offset, rng, difficulty);
    }
    this.nextRowS = s + lerp(58, 21, difficulty) * rng.range(0.8, 1.25);
  }

  private activate(car: TrafficCar, lane: number, s: number, rng: Rng, difficulty: number) {
    car.active = true;
    car.oncoming = false;
    car.lane = car.targetLane = lane;
    car.x = LANES_X[lane];
    car.s = s;
    car.desiredSpeed = this.laneSpeed(car, difficulty) * rng.range(0.985, 1.015);
    car.speed = car.desiredSpeed;
    car.color.set(rng.pick(car.def.colors));
    car.blink = 0;
    car.blinkTimer = 0;
    car.changeCooldown = rng.range(1, 4);
    car.passed = false;
    car.minGap = Infinity;
    car.knocked = false;
    car.vx = car.yaw = car.yawVel = 0;
    car.boostTimer = 0;
  }

  private laneSpeed(car: TrafficCar, difficulty: number) {
    return (FLOW_KMH * car.def.flow * (1 + difficulty * 0.12)) / KMH;
  }

  private spawnOncoming(rng: Rng, s: number) {
    const kind = rng.chance(0.75) ? 'sedan' : rng.pick(['van', 'truck', 'bus', 'sports'] as TrafficKind[]);
    const car = this.acquire(kind);
    if (!car) return;
    const lane = rng.int(0, ONCOMING_LANES_X.length - 1);
    car.active = true;
    car.oncoming = true;
    car.lane = car.targetLane = -1 - lane;
    car.x = ONCOMING_LANES_X[lane];
    car.s = s;
    car.speed = car.desiredSpeed = -rng.range(85, 120) / KMH;
    car.color.set(rng.pick(car.def.colors));
    car.blink = 0;
    car.knocked = false;
    car.yaw = car.vx = car.yawVel = 0;
    car.passed = true;
  }

  /** Knock a vehicle aside after a collision with the player. */
  knock(car: TrafficCar, dirX: number, playerSpeed: number) {
    car.knocked = true;
    car.blink = 0;
    car.vx = dirX * (4 + Math.random() * 3);
    car.speed = Math.max(car.speed, playerSpeed * 0.85);
    car.yawVel = dirX * (1.5 + Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1);
  }

  update(dt: number, ctx: TrafficUpdateContext) {
    this.time += dt;
    const { playerS, difficulty } = ctx;
    const fx = this.fx;

    if (ctx.spawn) {
      while (playerS + SPAWN_AHEAD > this.nextRowS) this.spawnRow(ctx, this.nextRowS);
      while (playerS > this.nextOncomingS) {
        this.spawnOncoming(this.fx, playerS + 450);
        this.nextOncomingS += this.fx.range(28, 75);
      }
    }

    for (const c of this.cars) {
      if (!c.active) continue;
      if (c.oncoming) {
        c.s += c.speed * dt;
        if (c.s < playerS - DESPAWN_BEHIND - 20) c.active = false;
        continue;
      }
      if (c.knocked) {
        c.x += c.vx * dt;
        c.vx *= Math.exp(-1.6 * dt);
        c.yaw += c.yawVel * dt;
        c.yawVel *= Math.exp(-1.2 * dt);
        c.speed = approach(c.speed, 0, 9 * dt);
        c.s += c.speed * dt;
        c.x = clamp(c.x, -7.0, 7.0);
        if (c.s < playerS - DESPAWN_BEHIND) c.active = false;
        continue;
      }

      // car following
      let target = c.desiredSpeed;
      if (c.boostTimer > 0) {
        c.boostTimer -= dt;
        target *= 1.25;
      }
      for (const o of this.cars) {
        if (o === c || !o.active || o.oncoming) continue;
        if (o.lane !== c.lane && o.targetLane !== c.lane && o.lane !== c.targetLane) continue;
        const gap = o.s - c.s - (o.def.length + c.def.length) / 2;
        if (gap > 0 && gap < 28 && o.speed < target) target = Math.min(target, lerp(o.speed, target, clamp((gap - 6) / 22, 0, 1)));
      }
      c.speed = approach(c.speed, target, (target < c.speed ? 7 : 2.5) * dt);

      // lane changes: telegraphed with the blinker for ~1.1s, only when well ahead of the player
      c.changeCooldown -= dt;
      const ahead = c.s - playerS;
      if (c.blink === 0 && c.lane === c.targetLane && c.changeCooldown <= 0 && ahead > 45 && ahead < 260) {
        const rate = c.def.laneChangeRate * lerp(0.15, 0.6, difficulty);
        if (fx.chance(rate * dt)) {
          const dir = fx.chance(0.5) ? -1 : 1;
          const nl = c.lane + dir;
          if (nl >= 0 && nl < LANE_COUNT && this.laneClear(nl, c.s, 13, c)) {
            c.blink = dir;
            c.blinkTimer = 1.1;
          }
        }
        if (c.changeCooldown <= 0) c.changeCooldown = fx.range(1.5, 4);
      }
      if (c.blink !== 0 && c.lane === c.targetLane) {
        c.blinkTimer -= dt;
        if (c.blinkTimer <= 0) {
          const nl = c.lane + c.blink;
          if (nl >= 0 && nl < LANE_COUNT && this.laneClear(nl, c.s, 11, c)) {
            c.targetLane = nl;
            c.desiredSpeed = this.laneSpeed(c, difficulty) * fx.range(0.985, 1.015);
          } else {
            c.blink = 0;
          }
        }
      }
      if (c.targetLane !== c.lane) {
        const tx = LANES_X[c.targetLane];
        c.x = approach(c.x, tx, 2.3 * dt);
        c.yaw = Math.sign(tx - c.x) * -0.06;
        if (Math.abs(c.x - tx) < 0.01) {
          c.lane = c.targetLane;
          c.blink = 0;
          c.yaw = 0;
          c.changeCooldown = fx.range(3, 7);
        }
      }

      c.s += c.speed * dt;
      if (c.s < playerS - DESPAWN_BEHIND || c.s > playerS + 800) c.active = false;
    }

    this.wallCheckTimer -= dt;
    if (this.wallCheckTimer <= 0) {
      this.wallCheckTimer = 0.4;
      this.breakWalls(playerS);
    }
  }

  /** If all lanes become blocked within a short stretch ahead, speed one car up to open a gap. */
  private breakWalls(playerS: number) {
    const ahead = this.cars.filter((c) => c.active && !c.oncoming && !c.knocked && c.s > playerS + 35 && c.s < playerS + 260).sort((a, b) => a.s - b.s);
    for (let i = 0; i < ahead.length; i++) {
      const lanes = new Set<number>();
      const group: TrafficCar[] = [];
      for (let j = i; j < ahead.length && ahead[j].s - ahead[i].s < 11; j++) {
        lanes.add(ahead[j].lane);
        lanes.add(ahead[j].targetLane);
        group.push(ahead[j]);
      }
      if (lanes.size >= LANE_COUNT) {
        const fastest = group.reduce((a, b) => (a.lane < b.lane ? a : b));
        fastest.boostTimer = 3.5;
        i += group.length - 1;
      }
    }
  }

  render() {
    const counts = new Map<TrafficKind, number>();
    let blinkCount = 0;
    const blinkOn = Math.floor(this.time * 3.2) % 2 === 0;
    for (const c of this.cars) {
      if (!c.active) continue;
      const m = this.meshes.get(c.def.kind)!;
      const i = counts.get(c.def.kind) ?? 0;
      counts.set(c.def.kind, i + 1);
      this.dummy.position.set(c.x, 0, -c.s);
      this.dummy.rotation.set(0, (c.oncoming ? Math.PI : 0) + c.yaw, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      m.body.setMatrixAt(i, this.dummy.matrix);
      m.lights.setMatrixAt(i, this.dummy.matrix);
      m.body.setColorAt(i, c.color);
      if (c.blink !== 0 && blinkOn && blinkCount < this.blinkers.instanceMatrix.count - 1) {
        const bx = c.x + c.blink * (c.def.width / 2 + 0.02);
        for (const bz of [-c.def.length / 2 + 0.2, c.def.length / 2 - 0.2]) {
          this.dummy.position.set(bx, 0.8, -c.s + bz);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.updateMatrix();
          this.blinkers.setMatrixAt(blinkCount++, this.dummy.matrix);
        }
      }
    }
    for (const [kind, m] of this.meshes) {
      const n = counts.get(kind) ?? 0;
      m.body.count = m.lights.count = n;
      m.body.instanceMatrix.needsUpdate = true;
      m.lights.instanceMatrix.needsUpdate = true;
      if (m.body.instanceColor) m.body.instanceColor.needsUpdate = true;
    }
    this.blinkers.count = blinkCount;
    this.blinkers.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const m of this.meshes.values()) {
      m.body.geometry.dispose();
      m.lights.geometry.dispose();
      m.body.dispose();
      m.lights.dispose();
    }
    this.blinkers.geometry.dispose();
    this.materials.forEach((m) => m.dispose());
  }
}
