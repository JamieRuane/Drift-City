import * as THREE from 'three';
import { LANES_X, LANE_COUNT } from '../constants';
import type { TrafficSystem } from '../traffic/TrafficSystem';
import { clamp, lerp, type Rng } from '../../utils/math';

interface Coin {
  active: boolean;
  s: number;
  x: number;
  value: number;
  gem: boolean;
  phase: number;
}

const COIN_CAP = 110;
const GEM_CAP = 8;
const SPAWN_AHEAD = 210;

/** Pooled collectible coins (and rare gems) laid out in lane patterns that avoid traffic. */
export class CoinSystem {
  readonly group = new THREE.Group();
  private coins: Coin[] = [];
  private coinMesh: THREE.InstancedMesh;
  private gemMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private nextPatternS = 0;
  private time = 0;

  constructor() {
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 22);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: '#ffc21a', metalness: 1, roughness: 0.22, emissive: '#ff9a00', emissiveIntensity: 1.1 });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, COIN_CAP);
    const gemGeo = new THREE.OctahedronGeometry(0.62, 0);
    const gemMat = new THREE.MeshStandardMaterial({ color: '#ff3df2', metalness: 0.3, roughness: 0.1, emissive: '#ff1ad9', emissiveIntensity: 1.6 });
    this.gemMesh = new THREE.InstancedMesh(gemGeo, gemMat, GEM_CAP);
    for (const m of [this.coinMesh, this.gemMesh]) {
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
    }
    for (let i = 0; i < COIN_CAP + GEM_CAP; i++) this.coins.push({ active: false, s: 0, x: 0, value: 1, gem: false, phase: 0 });
  }

  reset(playerS: number) {
    for (const c of this.coins) c.active = false;
    this.nextPatternS = playerS + 90;
  }

  private place(s: number, x: number, gem: boolean, traffic: TrafficSystem) {
    const lane = LANES_X.reduce((b, lx, i) => (Math.abs(lx - x) < Math.abs(LANES_X[b] - x) ? i : b), 0);
    if (!traffic.laneClear(lane, s, 8)) return;
    const c = this.coins.find((k) => !k.active);
    if (!c) return;
    c.active = true;
    c.s = s;
    c.x = x;
    c.gem = gem;
    c.value = gem ? 10 : 1;
    c.phase = s * 0.4;
  }

  private spawnPattern(s: number, rng: Rng, traffic: TrafficSystem) {
    // pick the lane with the most free road behind the pattern start (traffic moves into it)
    let lane = rng.int(0, LANE_COUNT - 1);
    for (let tries = 0; tries < 4; tries++) {
      if (traffic.laneClear(lane, s - 30, 45)) break;
      lane = rng.int(0, LANE_COUNT - 1);
    }
    const kind = rng.next();
    if (kind < 0.45) {
      const n = rng.int(6, 10);
      for (let i = 0; i < n; i++) this.place(s + i * 5, LANES_X[lane], false, traffic);
      if (rng.chance(0.12)) this.place(s + n * 5 + 6, LANES_X[lane], true, traffic);
      return n * 5;
    }
    if (kind < 0.8) {
      const dir = lane === 0 ? 1 : lane === LANE_COUNT - 1 ? -1 : rng.chance(0.5) ? 1 : -1;
      const to = lane + dir;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = clamp((i - 2) / 4, 0, 1);
        const e = t * t * (3 - 2 * t);
        this.place(s + i * 5, lerp(LANES_X[lane], LANES_X[to], e), false, traffic);
      }
      return n * 5;
    }
    // weaving drift arc across three lanes, gem at the apex
    const start = lane <= 1 ? 0 : LANE_COUNT - 1;
    const end = start === 0 ? 2 : 1;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = lerp(LANES_X[start], LANES_X[end], Math.sin(t * Math.PI));
      this.place(s + i * 4.5, x, i === Math.floor(n / 2) && rng.chance(0.4), traffic);
    }
    return n * 4.5;
  }

  /** Returns the total value of coins collected this step. */
  update(dt: number, playerS: number, playerX: number, difficulty: number, rng: Rng, traffic: TrafficSystem, spawn: boolean, magnet: number) {
    this.time += dt;
    if (spawn) {
      while (playerS + SPAWN_AHEAD > this.nextPatternS) {
        const len = this.spawnPattern(this.nextPatternS, rng, traffic);
        this.nextPatternS += len + rng.range(45, 110) * lerp(0.8, 1.2, difficulty);
      }
    }
    let collected = 0;
    const reachX = 1.35 + magnet;
    for (const c of this.coins) {
      if (!c.active) continue;
      const ds = c.s - playerS;
      if (ds < -8) {
        c.active = false;
        continue;
      }
      if (Math.abs(ds) < 2.3 && Math.abs(c.x - playerX) < reachX) {
        c.active = false;
        collected += c.value;
      }
    }
    return collected;
  }

  /** world positions of the last coins collected are not needed; effects are spawned at the player */
  render() {
    let ci = 0, gi = 0;
    for (const c of this.coins) {
      if (!c.active) continue;
      const y = 1.0 + Math.sin(this.time * 3 + c.phase) * 0.12;
      this.dummy.position.set(c.x, y, -c.s);
      this.dummy.rotation.set(0, this.time * 3 + c.phase, 0);
      this.dummy.updateMatrix();
      if (c.gem) this.gemMesh.setMatrixAt(gi++, this.dummy.matrix);
      else this.coinMesh.setMatrixAt(ci++, this.dummy.matrix);
    }
    this.coinMesh.count = ci;
    this.gemMesh.count = gi;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.gemMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const m of [this.coinMesh, this.gemMesh]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
  }
}
