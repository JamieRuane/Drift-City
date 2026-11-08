import * as THREE from 'three';
import type { CityLayout, RoadEdge, RoadNode } from './CityLayout';
import { RAPIER, GROUP_PLAYER, GROUP_TRAFFIC, groups, type PhysicsWorld } from '../physics/Physics';
import { buildCarMerged, buildCarParts } from '../vehicle/carModels';
import { GeometryBuilder } from './GeometryBuilder';
import type { CityDefinition } from '../cities/types';
import type { BodyKind } from '../../data/vehicles';
import { clamp, createRng, damp, type Rng } from '../core/rng';

interface Turn {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  len: number;
  t: number;
  next: RoadEdge;
  nextFrom: number;
  nextTo: number;
}

interface TCar {
  kind: number;
  slot: number;
  edge: RoadEdge;
  from: number;
  to: number;
  s: number;
  speed: number;
  max: number;
  turn: Turn | null;
  body: RAPIER.RigidBody;
  x: number;
  z: number;
  heading: number;
  blockedByPlayer: number;
  length: number;
}

const CYCLE = 18;

/**
 * Ambient traffic driving the road graph: lane following, smooth Bézier turns through intersections,
 * traffic-light phases, car-following gaps and yielding to the player. Cars are instanced meshes with
 * kinematic Rapier bodies so the player can bump into them.
 */
export class Traffic {
  readonly group = new THREE.Group();
  readonly cars: TCar[] = [];
  private meshes: THREE.InstancedMesh[] = [];
  private kinds: BodyKind[] = ['sedan', 'hatch', 'taxi', 'van', 'bus'];
  private rng: Rng;
  private lights: { node: RoadNode; axis: 'x' | 'z'; base: number }[] = [];
  private lampMesh: THREE.InstancedMesh | null = null;
  private lastPhaseKey = '';
  private time = 0;
  private side: number;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  /** Called when a car honks at the player. */
  onHonk: (x: number, z: number) => void = () => {};

  constructor(private layout: CityLayout, private physics: PhysicsWorld, def: CityDefinition, count: number, avoid: { x: number; z: number }) {
    this.rng = createRng(def.id + 'traffic');
    this.side = def.driveSide === 'right' ? 1 : -1;
    const taxi = def.traffic.taxi;
    const weights: [number, number][] = [[0, 5], [1, 3], [2, taxi ? taxi.share * 10 : 0], [3, 1.4], [4, def.traffic.buses ? 0.6 : 0]];
    const counts = new Array(this.kinds.length).fill(0);
    const plan: number[] = [];
    for (let i = 0; i < count; i++) {
      const k = this.rng.weighted(weights);
      plan.push(k);
      counts[k]++;
    }
    this.kinds.forEach((k, i) => {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.45 });
      const mesh = new THREE.InstancedMesh(buildCarMerged(k), mat, Math.max(1, counts[i]));
      mesh.count = counts[i];
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.push(mesh);
      this.group.add(mesh);
    });
    const slots = new Array(this.kinds.length).fill(0);
    const edges = layout.edges.filter((e) => e.length > 30);
    for (let i = 0; i < count; i++) {
      const k = plan[i];
      const kind = this.kinds[k];
      const parts = buildCarParts(kind);
      let edge = this.rng.pick(edges);
      for (let tries = 0; tries < 20; tries++) {
        const a = layout.nodes[edge.a];
        if (Math.hypot(a.x - avoid.x, a.z - avoid.z) > 60) break;
        edge = this.rng.pick(edges);
      }
      const forward = this.rng.chance(0.5);
      const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(parts.width / 2, parts.height / 2, parts.length / 2)
          .setTranslation(0, parts.height / 2 + 0.1, 0)
          .setCollisionGroups(groups(GROUP_TRAFFIC, GROUP_PLAYER)),
        body,
      );
      const car: TCar = {
        kind: k, slot: slots[k]++, edge,
        from: forward ? edge.a : edge.b, to: forward ? edge.b : edge.a,
        s: this.rng.range(14, Math.max(15, edge.length - 20)), speed: 0, max: this.rng.range(9, kind === 'bus' ? 10 : 13.5),
        turn: null, body, x: 0, z: 0, heading: 0, blockedByPlayer: 0, length: parts.length,
      };
      // avoid stacking: nudge along the edge
      for (const o of this.cars) if (o.edge === car.edge && o.from === car.from && Math.abs(o.s - car.s) < 9) car.s = (car.s + 11) % Math.max(20, edge.length - 15);
      this.cars.push(car);
      const color = kind === 'taxi' && taxi ? taxi.color : kind === 'bus' ? def.traffic.buses ?? '#d33' : this.rng.pick(def.traffic.colors);
      this.meshes[k].setColorAt(car.slot, new THREE.Color(color));
    }
    for (const m of this.meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.buildLights();
    this.updatePoses(0);
  }

  private laneOffset(e: RoadEdge) {
    return clamp(e.width / 4, 2.4, 3.8) * this.side;
  }

  /** Lane point at distance s along edge from→to. */
  private lanePoint(e: RoadEdge, from: number, to: number, s: number, out: THREE.Vector3) {
    const a = this.layout.nodes[from], b = this.layout.nodes[to];
    const dx = (b.x - a.x) / e.length, dz = (b.z - a.z) / e.length;
    const L = this.laneOffset(e);
    return out.set(a.x + dx * s + -dz * L, 0, a.z + dz * s + dx * L);
  }

  private dir(from: number, to: number) {
    const a = this.layout.nodes[from], b = this.layout.nodes[to];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    return { dx: (b.x - a.x) / l, dz: (b.z - a.z) / l };
  }

  private halfAlong(n: RoadNode, dx: number) {
    return Math.abs(dx) > 0.5 ? n.hx : n.hz;
  }

  lightState(node: RoadNode, axis: 'x' | 'z', t = this.time): 'green' | 'amber' | 'red' {
    const ph = ((t + (node.i * 3.1 + node.j * 5.3)) % CYCLE + CYCLE) % CYCLE;
    const xs = ph < 7 ? 'green' : ph < 9 ? 'amber' : 'red';
    const zs = ph >= 9 && ph < 16 ? 'green' : ph >= 16 ? 'amber' : 'red';
    return axis === 'x' ? xs : zs;
  }

  private buildLights() {
    const b = new GeometryBuilder();
    const heads: { x: number; y: number; z: number; ry: number; node: RoadNode; axis: 'x' | 'z' }[] = [];
    for (const n of this.layout.nodes) {
      if (!n.hasLight) continue;
      for (const id of n.edges) {
        const e = this.layout.edges[id];
        const other = e.a === n.id ? e.b : e.a;
        const { dx, dz } = this.dir(other, n.id); // approach direction
        const rx = -dz * this.side, rz = dx * this.side;
        const along = this.halfAlong(n, dx), across = Math.abs(dx) > 0.5 ? n.hz : n.hx;
        const x = n.x - dx * (along + 1.2) + rx * (across + 0.8);
        const z = n.z - dz * (along + 1.2) + rz * (across + 0.8);
        const ry = Math.atan2(-dx, -dz);
        b.cyl(x, 0, z, 0.1, 3.4, '#33373d', 6);
        b.push(x, 0, z, ry);
        b.block(0, 3.0, 0.15, 0.42, 1.3, 0.32, '#22252a');
        b.block(0, 3.0, 0.3, 0.6, 1.5, 0.04, '#111316');
        b.pop();
        heads.push({ x, y: 3.0, z, ry, node: n, axis: Math.abs(dx) > 0.5 ? 'x' : 'z' });
      }
    }
    if (!heads.length) return;
    const poles = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    poles.castShadow = true;
    this.group.add(poles);
    const lamp = new THREE.SphereGeometry(0.13, 8, 6);
    this.lampMesh = new THREE.InstancedMesh(lamp, new THREE.MeshBasicMaterial({ toneMapped: false }), heads.length * 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    heads.forEach((h, i) => {
      q.setFromAxisAngle(this.up, h.ry);
      for (let k = 0; k < 3; k++) {
        const local = new THREE.Vector3(0, 3.0 + 1.0 - k * 0.4, 0.34).applyQuaternion(q);
        m.makeTranslation(h.x + local.x, local.y, h.z + local.z);
        this.lampMesh!.setMatrixAt(i * 3 + k, m);
      }
      this.lights.push({ node: h.node, axis: h.axis, base: i * 3 });
    });
    this.lampMesh.setColorAt(0, new THREE.Color());
    this.group.add(this.lampMesh);
    this.updateLampColors(true);
  }

  private updateLampColors(force = false) {
    if (!this.lampMesh) return;
    const key = this.lights.map((l) => this.lightState(l.node, l.axis)[0]).join('');
    if (!force && key === this.lastPhaseKey) return;
    this.lastPhaseKey = key;
    const on = [new THREE.Color(3, 0.25, 0.2), new THREE.Color(3, 1.8, 0.2), new THREE.Color(0.3, 3, 0.8)];
    const off = [new THREE.Color(0.25, 0.04, 0.04), new THREE.Color(0.25, 0.18, 0.03), new THREE.Color(0.03, 0.2, 0.08)];
    this.lights.forEach((l, i) => {
      const st = key[i];
      const idx = st === 'r' ? 0 : st === 'a' ? 1 : 2;
      for (let k = 0; k < 3; k++) this.lampMesh!.setColorAt(l.base + k, k === idx ? on[k] : off[k]);
    });
    this.lampMesh.instanceColor!.needsUpdate = true;
  }

  private startTurn(c: TCar) {
    const n = this.layout.nodes[c.to];
    const opts = n.edges.map((id) => this.layout.edges[id]).filter((e) => e !== c.edge);
    let next: RoadEdge;
    let nextTo: number;
    if (!opts.length) {
      next = c.edge;
      nextTo = c.from;
    } else {
      next = this.rng.pick(opts);
      nextTo = next.a === c.to ? next.b : next.a;
    }
    const d1 = this.dir(c.from, c.to), d2 = this.dir(c.to, nextTo);
    const h1 = this.halfAlong(n, d1.dx), h2 = this.halfAlong(n, d2.dx);
    const p0 = this.lanePoint(c.edge, c.from, c.to, c.edge.length - h1 - 1, new THREE.Vector3());
    const p2 = this.lanePoint(next, c.to, nextTo, h2 + 1, new THREE.Vector3());
    // control point: intersection of the two lane lines (or midpoint when parallel)
    const cross = d1.dx * d2.dz - d1.dz * d2.dx;
    let p1: THREE.Vector3;
    if (Math.abs(cross) < 0.1) p1 = p0.clone().add(p2).multiplyScalar(0.5);
    else {
      const t = ((p2.x - p0.x) * d2.dz - (p2.z - p0.z) * d2.dx) / cross;
      p1 = new THREE.Vector3(p0.x + d1.dx * t, 0, p0.z + d1.dz * t);
    }
    if (next === c.edge) p1 = new THREE.Vector3(n.x, 0, n.z);
    const len = p0.distanceTo(p1) + p1.distanceTo(p2);
    c.turn = { p0, p1, p2, len: Math.max(1, len), t: 0, next, nextFrom: c.to, nextTo };
  }

  fixedUpdate(dt: number, player: { x: number; z: number; speed: number } | null) {
    this.time += dt;
    const tmp = new THREE.Vector3();
    for (const c of this.cars) {
      const hx = Math.sin(c.heading), hz = Math.cos(c.heading);
      // nearest obstacle ahead
      let gap = Infinity;
      for (const o of this.cars) {
        if (o === c) continue;
        const rx = o.x - c.x, rz = o.z - c.z;
        const f = rx * hx + rz * hz;
        if (f <= 0 || f > 22) continue;
        const l = Math.abs(rx * hz - rz * hx);
        if (l < 1.9) gap = Math.min(gap, f - (o.length + c.length) / 2);
      }
      let byPlayer = false;
      if (player) {
        const rx = player.x - c.x, rz = player.z - c.z;
        const f = rx * hx + rz * hz;
        const l = Math.abs(rx * hz - rz * hx);
        if (f > 0 && f < 18 && l < 2.6) {
          const g = f - c.length / 2 - 2.4;
          if (g < gap) {
            gap = g;
            byPlayer = true;
          }
        }
      }
      let target = c.turn ? Math.min(c.max, 6.5) : c.max;
      // traffic lights
      if (!c.turn) {
        const n = this.layout.nodes[c.to];
        const d = this.dir(c.from, c.to);
        const stopAt = c.edge.length - this.halfAlong(n, d.dx) - 7.5;
        const toStop = stopAt - c.s;
        if (n.hasLight && toStop > -1.5) {
          const st = this.lightState(n, Math.abs(d.dx) > 0.5 ? 'x' : 'z');
          if (st === 'red' || (st === 'amber' && toStop > 6)) gap = Math.min(gap, Math.max(0, toStop));
        }
        if (toStop < 12 && !n.hasLight) target = Math.min(target, 8);
      }
      if (gap < Infinity) target = Math.min(target, clamp((gap - 2.5) * 1.1, 0, c.max));
      c.speed = target < c.speed ? damp(c.speed, target, 5, dt) : Math.min(target, c.speed + 3.2 * dt);
      if (gap < 1.5) c.speed = Math.min(c.speed, 0);

      if (byPlayer && c.speed < 0.5) {
        c.blockedByPlayer += dt;
        if (c.blockedByPlayer > 2.5) {
          c.blockedByPlayer = -this.rng.range(3, 6);
          this.onHonk(c.x, c.z);
        }
      } else if (c.blockedByPlayer > 0) c.blockedByPlayer = 0;

      // advance
      const move = c.speed * dt;
      if (c.turn) {
        const tr = c.turn;
        tr.t += move / tr.len;
        if (tr.t >= 1) {
          c.edge = tr.next;
          c.from = tr.nextFrom;
          c.to = tr.nextTo;
          const d = this.dir(c.from, c.to);
          c.s = this.halfAlong(this.layout.nodes[c.from], d.dx) + 1 + (tr.t - 1) * tr.len;
          c.turn = null;
        }
      } else {
        c.s += move;
        const n = this.layout.nodes[c.to];
        const d = this.dir(c.from, c.to);
        if (c.s >= c.edge.length - this.halfAlong(n, d.dx) - 1) this.startTurn(c);
      }
      // pose
      let x: number, z: number, hd: number;
      if (c.turn) {
        const { p0, p1, p2, t } = c.turn;
        const u = Math.min(1, t), iu = 1 - u;
        x = iu * iu * p0.x + 2 * iu * u * p1.x + u * u * p2.x;
        z = iu * iu * p0.z + 2 * iu * u * p1.z + u * u * p2.z;
        const tx = 2 * iu * (p1.x - p0.x) + 2 * u * (p2.x - p1.x);
        const tz = 2 * iu * (p1.z - p0.z) + 2 * u * (p2.z - p1.z);
        hd = Math.atan2(tx, tz);
      } else {
        this.lanePoint(c.edge, c.from, c.to, c.s, tmp);
        x = tmp.x;
        z = tmp.z;
        const d = this.dir(c.from, c.to);
        hd = Math.atan2(d.dx, d.dz);
      }
      c.x = x;
      c.z = z;
      c.heading = hd;
      this.q.setFromAxisAngle(this.up, hd);
      c.body.setNextKinematicTranslation({ x, y: 0, z });
      c.body.setNextKinematicRotation({ x: this.q.x, y: this.q.y, z: this.q.z, w: this.q.w });
    }
    this.updateLampColors();
  }

  updatePoses(_alpha: number) {
    for (const c of this.cars) {
      const mesh = this.meshes[c.kind];
      this.q.setFromAxisAngle(this.up, c.heading);
      this.m.compose(new THREE.Vector3(c.x, 0, c.z), this.q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(c.slot, this.m);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }

  /** Hide one instance (used when the menu's hero car replaces a traffic car). */
  hide(index: number) {
    const c = this.cars[index];
    if (!c) return;
    this.m.makeScale(0, 0, 0);
    this.meshes[c.kind].setMatrixAt(c.slot, this.m);
  }

  dispose() {
    for (const c of this.cars) this.physics.world.removeRigidBody(c.body);
    this.group.removeFromParent();
    for (const m of this.meshes) (m.material as THREE.Material).dispose();
  }
}
