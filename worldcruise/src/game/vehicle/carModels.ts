import * as THREE from 'three';
import { GeometryBuilder } from '../world/GeometryBuilder';
import type { BodyKind } from '../../data/vehicles';

/**
 * Procedural low-poly car bodies. Side profiles (z forward, y up) are extruded across the car's width with
 * a slight taper, which gives each body type a readable silhouette at very low triangle counts.
 * Models face +Z with the ground at y = 0.
 */

type P = [number, number];

export interface CarParts {
  paint: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  reverse: THREE.BufferGeometry;
  wheel: THREE.BufferGeometry;
  /** Wheel centres (x, y, z) in model space: FL, FR, RL, RR. */
  wheels: [number, number, number][];
  wheelRadius: number;
  /** Headlight positions for light sources / glows. */
  headPos: [number, number, number][];
  tailPos: [number, number, number][];
  length: number;
  width: number;
  height: number;
}

function extrude(b: GeometryBuilder, prof: P[], wBottom: number, wTop: number, color: THREE.ColorRepresentation, xOff = 0) {
  const ys = prof.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const half = (y: number) => (wBottom + (wTop - wBottom) * ((y - y0) / Math.max(0.001, y1 - y0))) / 2;
  const contour = prof.map(([z, y]) => new THREE.Vector2(z, y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const ccw = THREE.ShapeUtils.isClockWise(contour) ? false : true;
  for (const [a, c, d] of tris) {
    const A = prof[a], C = prof[c], D = prof[d];
    const s2 = (C[0] - A[0]) * (D[1] - A[1]) - (D[0] - A[0]) * (C[1] - A[1]);
    const r = (p: P) => [xOff + half(p[1]), p[1], p[0]] as const;
    const l = (p: P) => [xOff - half(p[1]), p[1], p[0]] as const;
    // seen from +x the z axis points left, so the right side needs the opposite 2D winding
    if (s2 > 0) {
      b.tri(...r(A), ...r(D), ...r(C), color);
      b.tri(...l(A), ...l(C), ...l(D), color);
    } else {
      b.tri(...r(A), ...r(C), ...r(D), color);
      b.tri(...l(A), ...l(D), ...l(C), color);
    }
  }
  for (let i = 0; i < prof.length; i++) {
    const p = prof[i], q = prof[(i + 1) % prof.length];
    const pr = [xOff + half(p[1]), p[1], p[0]], pl = [xOff - half(p[1]), p[1], p[0]];
    const qr = [xOff + half(q[1]), q[1], q[0]], ql = [xOff - half(q[1]), q[1], q[0]];
    if (ccw) b.quad(pl[0], pl[1], pl[2], pr[0], pr[1], pr[2], qr[0], qr[1], qr[2], ql[0], ql[1], ql[2], color);
    else b.quad(pr[0], pr[1], pr[2], pl[0], pl[1], pl[2], ql[0], ql[1], ql[2], qr[0], qr[1], qr[2], color);
  }
}

interface BodyDef {
  L: number;
  W: number;
  lower: P[];
  cabin: P[];
  roof?: P[];
  wheelR: number;
  wheelW: number;
  wheelBase: number;
  /** Wheel z offset (centre of wheelbase relative to body centre). */
  wbOff: number;
  rideY: number;
  cabinW: number;
  extra?: (paint: GeometryBuilder, trim: GeometryBuilder, glass: GeometryBuilder, glow: GeometryBuilder) => void;
  headZ: number;
  headY: number;
  tailZ: number;
  tailY: number;
  round?: boolean;
}

function scaleProf(p: P[], sz: number, sy = 1, oy = 0): P[] {
  return p.map(([z, y]) => [z * sz, y * sy + oy]);
}

function bodyDef(kind: BodyKind): BodyDef {
  switch (kind) {
    case 'sports':
      return {
        L: 4.4, W: 1.92, wheelR: 0.36, wheelW: 0.3, wheelBase: 2.65, wbOff: -0.05, rideY: 0.3, cabinW: 1.5,
        lower: [[-2.2, 0.3], [2.18, 0.3], [2.24, 0.52], [2.12, 0.72], [1.0, 0.86], [-1.7, 0.94], [-2.2, 0.92], [-2.26, 0.55]],
        cabin: [[1.0, 0.85], [-1.55, 0.93], [-1.05, 1.28], [0.1, 1.3]],
        roof: [[0.05, 1.29], [-1.0, 1.27], [-0.95, 1.33], [0.0, 1.345]],
        headZ: 2.12, headY: 0.68, tailZ: -2.23, tailY: 0.78,
        extra: (paint, trim) => {
          trim.block(0, 0.92, -2.05, 1.7, 0.06, 0.32, '#1b1d22');
          trim.block(-0.7, 0.86, -2.05, 0.08, 0.1, 0.12, '#1b1d22');
          trim.block(0.7, 0.86, -2.05, 0.08, 0.1, 0.12, '#1b1d22');
          trim.block(0, 0.3, 2.2, 1.2, 0.18, 0.08, '#1b1d22');
          paint.block(0.92, 0.95, 0.75, 0.12, 0.1, 0.22, '#ffffff');
          paint.block(-0.92, 0.95, 0.75, 0.12, 0.1, 0.22, '#ffffff');
        },
      };
    case 'super':
      return {
        L: 4.5, W: 2.04, wheelR: 0.36, wheelW: 0.34, wheelBase: 2.7, wbOff: -0.1, rideY: 0.22, cabinW: 1.55,
        lower: [[-2.25, 0.24], [2.2, 0.24], [2.3, 0.4], [2.0, 0.6], [0.7, 0.8], [-1.9, 0.86], [-2.3, 0.82], [-2.3, 0.45]],
        cabin: [[0.75, 0.78], [-1.55, 0.86], [-0.85, 1.14], [-0.1, 1.16]],
        headZ: 2.15, headY: 0.52, tailZ: -2.29, tailY: 0.68,
        extra: (paint, trim) => {
          trim.block(0, 0.96, -2.1, 1.9, 0.05, 0.38, '#15171b');
          trim.block(-0.8, 0.84, -2.1, 0.07, 0.14, 0.1, '#15171b');
          trim.block(0.8, 0.84, -2.1, 0.07, 0.14, 0.1, '#15171b');
          trim.block(1.0, 0.4, -0.55, 0.06, 0.32, 0.9, '#15171b');
          trim.block(-1.0, 0.4, -0.55, 0.06, 0.32, 0.9, '#15171b');
          trim.block(0, 0.22, 2.25, 1.6, 0.12, 0.12, '#15171b');
          paint.block(0.97, 0.8, 0.55, 0.12, 0.08, 0.2, '#ffffff');
          paint.block(-0.97, 0.8, 0.55, 0.12, 0.08, 0.2, '#ffffff');
        },
      };
    case 'hatch':
      return {
        L: 3.9, W: 1.78, wheelR: 0.33, wheelW: 0.26, wheelBase: 2.45, wbOff: 0, rideY: 0.3, cabinW: 1.56,
        lower: [[-1.92, 0.3], [1.9, 0.3], [1.97, 0.55], [1.85, 0.82], [0.95, 0.98], [-1.85, 1.0], [-1.95, 0.6]],
        cabin: [[0.95, 0.97], [-1.85, 0.99], [-1.75, 1.48], [0.15, 1.52]],
        roof: [[0.12, 1.51], [-1.72, 1.47], [-1.7, 1.55], [0.1, 1.58]],
        headZ: 1.88, headY: 0.76, tailZ: -1.92, tailY: 0.86,
        extra: (paint, trim) => {
          trim.block(0, 0.3, 1.95, 1.4, 0.2, 0.1, '#2a2d33');
          trim.block(0, 0.3, -1.93, 1.4, 0.2, 0.1, '#2a2d33');
          paint.block(0.86, 1.03, 0.85, 0.1, 0.1, 0.18, '#ffffff');
          paint.block(-0.86, 1.03, 0.85, 0.1, 0.1, 0.18, '#ffffff');
        },
      };
    case 'classic':
      return {
        L: 4.7, W: 1.94, wheelR: 0.36, wheelW: 0.26, wheelBase: 2.8, wbOff: 0, rideY: 0.36, cabinW: 1.5,
        lower: [[-2.35, 0.38], [2.3, 0.38], [2.38, 0.62], [2.3, 0.86], [0.9, 0.92], [-1.5, 0.95], [-2.35, 0.9], [-2.42, 0.62]],
        cabin: [[0.85, 0.92], [-1.3, 0.95], [-0.95, 1.42], [0.35, 1.42]],
        roof: [[0.33, 1.41], [-0.93, 1.41], [-0.9, 1.49], [0.3, 1.49]],
        round: true,
        headZ: 2.34, headY: 0.76, tailZ: -2.4, tailY: 0.8,
        extra: (_paint, trim) => {
          trim.block(0, 0.32, 2.42, 1.98, 0.18, 0.14, '#e6e9ee');
          trim.block(0, 0.32, -2.46, 1.98, 0.18, 0.14, '#e6e9ee');
          trim.block(0, 0.55, 2.39, 0.9, 0.24, 0.05, '#cfd4da');
          trim.block(0.98, 0.62, 0, 0.03, 0.04, 4.2, '#e6e9ee');
          trim.block(-0.98, 0.62, 0, 0.03, 0.04, 4.2, '#e6e9ee');
        },
      };
    case 'offroad':
      return {
        L: 4.3, W: 2.0, wheelR: 0.46, wheelW: 0.36, wheelBase: 2.6, wbOff: 0, rideY: 0.55, cabinW: 1.84,
        lower: [[-2.1, 0.55], [2.05, 0.55], [2.15, 0.8], [2.1, 1.12], [0.85, 1.2], [-2.1, 1.2], [-2.15, 0.8]],
        cabin: [[0.85, 1.19], [-2.05, 1.19], [-2.0, 1.85], [0.55, 1.85]],
        roof: [[0.55, 1.84], [-2.0, 1.84], [-2.0, 1.92], [0.55, 1.92]],
        headZ: 2.1, headY: 0.98, tailZ: -2.12, tailY: 1.0,
        extra: (paint, trim) => {
          trim.block(0, 0.42, 2.18, 2.0, 0.28, 0.2, '#2b2e33');
          trim.block(0, 0.42, -2.18, 2.0, 0.28, 0.2, '#2b2e33');
          for (const s of [-1, 1]) {
            trim.block(s * 1.0, 0.95, 1.3, 0.16, 0.12, 1.0, '#2b2e33');
            trim.block(s * 1.0, 0.95, -1.3, 0.16, 0.12, 1.0, '#2b2e33');
          }
          trim.block(0, 1.95, -0.7, 1.6, 0.06, 2.2, '#2b2e33');
          for (let k = 0; k < 4; k++) trim.block(0, 2.0, -1.6 + k * 0.6, 1.7, 0.06, 0.06, '#2b2e33');
          trim.cyl(0, 0.85, -2.3, 0.42, 0.25, '#1d1f23', 10);
          trim.geom(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 12).rotateX(Math.PI / 2).toNonIndexed(), '#1d1f23', 0, 1.15, -2.3, 1, 1, 1);
          trim.block(0, 1.1, 2.12, 1.1, 0.3, 0.05, '#40444b');
          paint.block(1.05, 1.25, 0.65, 0.12, 0.14, 0.24, '#ffffff');
          paint.block(-1.05, 1.25, 0.65, 0.12, 0.14, 0.24, '#ffffff');
        },
      };
    case 'taxi':
    case 'sedan':
      return {
        L: 4.5, W: 1.84, wheelR: 0.34, wheelW: 0.26, wheelBase: 2.7, wbOff: 0, rideY: 0.32, cabinW: 1.56,
        lower: [[-2.25, 0.32], [2.2, 0.32], [2.27, 0.58], [2.18, 0.82], [1.0, 0.92], [-1.4, 0.95], [-2.22, 0.92], [-2.28, 0.6]],
        cabin: [[1.0, 0.91], [-1.4, 0.94], [-0.95, 1.42], [0.35, 1.44]],
        roof: [[0.33, 1.43], [-0.93, 1.41], [-0.9, 1.48], [0.3, 1.5]],
        headZ: 2.2, headY: 0.72, tailZ: -2.26, tailY: 0.8,
        extra: kind === 'taxi'
          ? (_p, trim, _g, glow) => {
            trim.block(0, 1.48, -0.3, 0.7, 0.2, 0.3, '#2a2a2a');
            glow.block(0, 1.52, -0.3, 0.6, 0.14, 0.32, '#fff6b0');
          }
          : undefined,
      };
    case 'van':
      return {
        L: 5.0, W: 2.0, wheelR: 0.37, wheelW: 0.28, wheelBase: 3.1, wbOff: 0, rideY: 0.36, cabinW: 1.9,
        lower: [[-2.5, 0.36], [2.4, 0.36], [2.5, 0.65], [2.4, 1.0], [1.6, 1.3], [1.2, 2.2], [-2.5, 2.25]],
        cabin: [[1.62, 1.28], [1.0, 1.32], [1.0, 2.05], [1.25, 2.05]],
        headZ: 2.42, headY: 0.82, tailZ: -2.52, tailY: 1.0,
      };
    case 'bus':
      return {
        L: 10.5, W: 2.5, wheelR: 0.5, wheelW: 0.32, wheelBase: 6.2, wbOff: -0.4, rideY: 0.4, cabinW: 2.52,
        lower: [[-5.25, 0.4], [5.2, 0.4], [5.25, 1.2], [5.1, 3.2], [-5.25, 3.25]],
        cabin: [[5.15, 1.5], [-5.2, 1.5], [-5.2, 2.6], [5.12, 2.6]],
        headZ: 5.22, headY: 0.9, tailZ: -5.27, tailY: 1.1,
      };
  }
}

const partCache = new Map<BodyKind, CarParts>();

export function buildCarParts(kind: BodyKind): CarParts {
  const hit = partCache.get(kind);
  if (hit) return hit;
  const d = bodyDef(kind);
  const paint = new GeometryBuilder(), trim = new GeometryBuilder(), glass = new GeometryBuilder();
  const head = new GeometryBuilder(), tail = new GeometryBuilder(), rev = new GeometryBuilder();
  const glowX = new GeometryBuilder();

  extrude(paint, d.lower, d.W, d.W * 0.94, '#ffffff');
  extrude(glass, d.cabin, d.cabinW, d.cabinW * 0.82, '#ffffff');
  if (d.roof) extrude(paint, d.roof, d.cabinW * 0.86, d.cabinW * 0.8, '#ffffff');
  // underbody / sills
  trim.block(0, d.rideY - 0.05, 0, d.W * 0.86, 0.12, d.L * 0.9, '#22252a');
  // headlights
  const hx = d.W * 0.33;
  for (const s of [-1, 1]) {
    if (d.round) head.geom(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 10).rotateX(Math.PI / 2).toNonIndexed(), '#ffffff', s * hx, d.headY, d.headZ, 1, 1, 1);
    else head.box(s * hx, d.headY, d.headZ, 0.42, 0.12, 0.08, '#ffffff');
    tail.box(s * (d.W * 0.36), d.tailY, d.tailZ, 0.4, 0.12, 0.06, '#ffffff');
    rev.box(s * (d.W * 0.2), d.tailY - 0.12, d.tailZ, 0.16, 0.08, 0.05, '#ffffff');
  }
  d.extra?.(paint, trim, glass, glowX);
  if (kind === 'bus') {
    paint.block(0, 3.25, 0, 2.3, 0.18, 10, '#ffffff');
    trim.block(0, 0.4, 5.23, 2.2, 0.4, 0.06, '#222');
  }
  // merge taxi glow into head geometry for simplicity (it is always on)
  if (!glowX.isEmpty()) {
    head.pos.push(...glowX.pos);
    head.nor.push(...glowX.nor);
    head.col.push(...glowX.col);
    head.uv.push(...glowX.uv);
  }

  // wheel (axle along X)
  const w = new GeometryBuilder();
  const tire = new THREE.CylinderGeometry(d.wheelR, d.wheelR, d.wheelW, 14).rotateZ(Math.PI / 2).toNonIndexed();
  w.geom(tire, '#1c1d20', 0, 0, 0, 1, 1, 1);
  const rim = new THREE.CylinderGeometry(d.wheelR * 0.62, d.wheelR * 0.62, d.wheelW + 0.02, 10).rotateZ(Math.PI / 2).toNonIndexed();
  w.geom(rim, '#c9ced6', 0, 0, 0, 1, 1, 1);
  const hub = new THREE.CylinderGeometry(d.wheelR * 0.18, d.wheelR * 0.18, d.wheelW + 0.05, 6).rotateZ(Math.PI / 2).toNonIndexed();
  w.geom(hub, '#5a5f66', 0, 0, 0, 1, 1, 1);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    w.box(0, Math.cos(a) * d.wheelR * 0.38, Math.sin(a) * d.wheelR * 0.38, d.wheelW + 0.035, d.wheelR * 0.42, 0.06, '#8f959d');
  }

  const tx = d.W / 2 - d.wheelW / 2 + 0.03;
  const fz = d.wbOff + d.wheelBase / 2, rz = d.wbOff - d.wheelBase / 2;
  const parts: CarParts = {
    paint: paint.build(), trim: trim.build(), glass: glass.build(),
    head: head.build(), tail: tail.build(), reverse: rev.build(), wheel: w.build(),
    wheels: [[tx, d.wheelR, fz], [-tx, d.wheelR, fz], [tx, d.wheelR, rz], [-tx, d.wheelR, rz]],
    wheelRadius: d.wheelR,
    headPos: [[hx, d.headY, d.headZ], [-hx, d.headY, d.headZ]],
    tailPos: [[d.W * 0.36, d.tailY, d.tailZ], [-d.W * 0.36, d.tailY, d.tailZ]],
    length: d.L, width: d.W,
    height: Math.max(...d.cabin.map((p) => p[1]), ...d.lower.map((p) => p[1])),
  };
  partCache.set(kind, parts);
  return parts;
}

/**
 * Single merged geometry for instanced traffic / parked cars. The body is white so the instance colour
 * paints it; glass, trim and lights keep fixed colours by being stored darker / brighter.
 */
const mergedCache = new Map<BodyKind, THREE.BufferGeometry>();
export function buildCarMerged(kind: BodyKind): THREE.BufferGeometry {
  const hit = mergedCache.get(kind);
  if (hit) return hit;
  const p = buildCarParts(kind);
  const b = new GeometryBuilder();
  const add = (g: THREE.BufferGeometry, tint: [number, number, number] | null, m?: THREE.Matrix4) => {
    const pos = g.attributes.position.array as Float32Array;
    const col = g.attributes.color.array as Float32Array;
    const v = new THREE.Vector3();
    const nor = g.attributes.normal.array as Float32Array;
    const n = new THREE.Vector3();
    const nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null;
    for (let i = 0; i < pos.length; i += 3) {
      v.set(pos[i], pos[i + 1], pos[i + 2]);
      n.set(nor[i], nor[i + 1], nor[i + 2]);
      if (m) {
        v.applyMatrix4(m);
        n.applyMatrix3(nm!).normalize();
      }
      b.pos.push(v.x, v.y, v.z);
      b.nor.push(n.x, n.y, n.z);
      if (tint) b.col.push(tint[0], tint[1], tint[2]);
      else b.col.push(col[i], col[i + 1], col[i + 2]);
      b.uv.push(0, 0);
    }
  };
  add(p.paint, null);
  add(p.trim, null);
  add(p.glass, [0.12, 0.16, 0.22]);
  add(p.head, [1.6, 1.55, 1.4]);
  add(p.tail, [0.9, 0.08, 0.08]);
  for (const [x, y, z] of p.wheels) add(p.wheel, null, new THREE.Matrix4().makeTranslation(x, y, z));
  const g = b.build();
  mergedCache.set(kind, g);
  return g;
}
