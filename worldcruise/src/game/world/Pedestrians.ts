import * as THREE from 'three';
import type { Rect } from './CityLayout';
import { CURB_H } from './CityLayout';
import { createRng } from '../core/rng';

interface Ped {
  rect: Rect;
  p: number;
  dir: number;
  speed: number;
  phase: number;
  dodge: number;
  x: number;
  z: number;
  h: number;
  scale: number;
}

const SHIRTS = ['#e85d4a', '#3f7be0', '#f2c14e', '#47b37a', '#9a5bd6', '#f08fb0', '#2f3b52', '#f4f1ea', '#d9822b', '#4fb5c9'];
const SKIN = ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3b', '#f6dcc4'];
const PANTS = ['#2b3346', '#3d3d3d', '#5a4a3a', '#24324f', '#6b6f78'];

/** Low-poly pedestrians walking loops around the pavements; they hop aside when a car comes close. */
export class Pedestrians {
  readonly group = new THREE.Group();
  private peds: Ped[] = [];
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private legL: THREE.InstancedMesh;
  private legR: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private e = new THREE.Euler();

  constructor(rects: Rect[], count: number, seed: string) {
    const rng = createRng(seed + 'peds');
    const mat = new THREE.MeshLambertMaterial();
    const n = rects.length ? count : 0;
    this.body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.22, 0.55, 2, 6).translate(0, 1.15, 0), mat, Math.max(1, n));
    this.head = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.17, 0).translate(0, 1.72, 0), mat, Math.max(1, n));
    const leg = new THREE.BoxGeometry(0.13, 0.75, 0.15).translate(0, -0.375, 0);
    this.legL = new THREE.InstancedMesh(leg, mat, Math.max(1, n));
    this.legR = new THREE.InstancedMesh(leg, mat, Math.max(1, n));
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const rect = rng.pick(rects);
      this.peds.push({ rect, p: rng(), dir: rng.chance(0.5) ? 1 : -1, speed: rng.range(1.1, 1.6), phase: rng() * 10, dodge: 0, x: 0, z: 0, h: 0, scale: rng.range(0.9, 1.08) });
      this.body.setColorAt(i, c.set(rng.pick(SHIRTS)));
      this.head.setColorAt(i, c.set(rng.pick(SKIN)));
      const pc = rng.pick(PANTS);
      this.legL.setColorAt(i, c.set(pc));
      this.legR.setColorAt(i, c.set(pc));
    }
    for (const m of [this.body, this.head, this.legL, this.legR]) {
      m.count = n;
      m.castShadow = true;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
  }

  private pointOnRect(r: Rect, p: number) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, per = 2 * (w + d);
    let t = (((p % 1) + 1) % 1) * per;
    if (t < w) return { x: r.x0 + t, z: r.z0, h: Math.PI / 2, nx: 0, nz: 1 };
    t -= w;
    if (t < d) return { x: r.x1, z: r.z0 + t, h: 0, nx: -1, nz: 0 };
    t -= d;
    if (t < w) return { x: r.x1 - t, z: r.z1, h: -Math.PI / 2, nx: 0, nz: -1 };
    t -= w;
    return { x: r.x0, z: r.z1 - t, h: Math.PI, nx: 1, nz: 0 };
  }

  update(dt: number, player: THREE.Vector3 | null, playerSpeed: number, camPos: THREE.Vector3) {
    const n = this.peds.length;
    for (let i = 0; i < n; i++) {
      const pd = this.peds[i];
      const r = pd.rect;
      const per = 2 * (r.x1 - r.x0 + r.z1 - r.z0);
      // skip far-away animation work (still placed)
      const far = Math.abs(pd.x - camPos.x) + Math.abs(pd.z - camPos.z) > 260;
      pd.p += (pd.dir * pd.speed * dt) / per;
      const pt = this.pointOnRect(r, pd.p);
      let dodgeT = 0;
      if (player && playerSpeed > 1.5) {
        const d = Math.hypot(player.x - pt.x, player.z - pt.z);
        if (d < 6) dodgeT = 1;
      }
      pd.dodge += (dodgeT - pd.dodge) * Math.min(1, dt * (dodgeT > pd.dodge ? 9 : 1.5));
      pd.x = pt.x + pt.nx * pd.dodge * 0.9;
      pd.z = pt.z + pt.nz * pd.dodge * 0.9;
      pd.h = pt.h + (pd.dir < 0 ? Math.PI : 0);
      pd.phase += dt * pd.speed * 5.5 * (far ? 0 : 1);
      const hop = pd.dodge > 0.1 ? Math.abs(Math.sin(pd.phase * 1.5)) * 0.25 * pd.dodge : 0;
      const bob = Math.abs(Math.sin(pd.phase)) * 0.05 + hop;
      const sc = pd.scale;
      this.q.setFromAxisAngle(this.v.set(0, 1, 0), pd.h);
      this.m.compose(this.v.set(pd.x, CURB_H + bob, pd.z), this.q, this.s.set(sc, sc, sc));
      this.body.setMatrixAt(i, this.m);
      this.head.setMatrixAt(i, this.m);
      const swing = Math.sin(pd.phase) * 0.55;
      for (const [mesh, sgn] of [[this.legL, 1], [this.legR, -1]] as const) {
        this.e.set(swing * sgn, pd.h, 0, 'YXZ');
        this.q.setFromEuler(this.e);
        const ox = Math.cos(pd.h) * 0.11 * sgn, oz = -Math.sin(pd.h) * 0.11 * sgn;
        this.m.compose(this.v.set(pd.x + ox * sc, CURB_H + bob + 0.8 * sc, pd.z + oz * sc), this.q, this.s.set(sc, sc, sc));
        mesh.setMatrixAt(i, this.m);
      }
    }
    for (const m of [this.body, this.head, this.legL, this.legR]) m.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    for (const m of [this.body, this.head, this.legL, this.legR]) m.geometry.dispose();
  }
}
