import * as THREE from 'three';

/**
 * Accumulates flat-shaded, vertex-coloured triangles into one merged BufferGeometry.
 * Every static object in a city (buildings, props, landmarks) is written through a builder so a whole
 * chunk of the city renders in a handful of draw calls.
 */

export type ColorInput = THREE.ColorRepresentation;

const _c = new THREE.Color();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/** Window-bay width and floor height used for facade UVs (metres). The facade texture tiles 8×8 bays. */
export const BAY = 3.1;
export const FLOOR = 3.3;
export const FACADE_TILE = 8;

export interface AoOptions {
  /** World height where darkening is strongest. */
  y0: number;
  /** Height over which the darkening fades out. */
  h: number;
  /** Colour multiplier at y0. */
  min: number;
}

const geomCache = new Map<string, THREE.BufferGeometry>();

/** Non-indexed, cached unit primitives. */
export function prim(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geomCache.get(key);
  if (!g) {
    g = make();
    if (g.index) g = g.toNonIndexed();
    geomCache.set(key, g);
  }
  return g;
}

export const unitBox = () => prim('box', () => new THREE.BoxGeometry(1, 1, 1));
export const unitCyl = (seg: number) =>
  prim(`cyl${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1).translate(0, 0.5, 0));
export const unitCone = (seg: number) =>
  prim(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1).translate(0, 0.5, 0));
export const unitSphere = (detail: number) => prim(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail));
export const unitSphereUV = (w: number, h: number) =>
  prim(`sph${w}_${h}`, () => new THREE.SphereGeometry(1, w, h));
export const unitHemi = (w: number, h: number) =>
  prim(`hemi${w}_${h}`, () => new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2));

export class GeometryBuilder {
  pos: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  nor: number[] = [];
  matrix = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];
  ao: AoOptions | null = null;

  get vertexCount() {
    return this.pos.length / 3;
  }

  /** Push a local transform (translation, Y rotation, uniform or xyz scale). */
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    this.stack.push(this.matrix.clone());
    _q.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.matrix.multiply(_m);
    return this;
  }

  pop() {
    const m = this.stack.pop();
    if (m) this.matrix = m;
    return this;
  }

  /** Emits one triangle given world-ish (pre-matrix) coordinates. */
  tri(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    color: ColorInput,
    uvs?: [number, number, number, number, number, number],
  ) {
    _a.set(ax, ay, az).applyMatrix4(this.matrix);
    _b.set(bx, by, bz).applyMatrix4(this.matrix);
    _d.set(cx, cy, cz).applyMatrix4(this.matrix);
    this.pushTri(_a, _b, _d, color, uvs);
  }

  quad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    color: ColorInput,
    uvs?: [number, number, number, number, number, number, number, number],
  ) {
    this.tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, uvs && [uvs[0], uvs[1], uvs[2], uvs[3], uvs[4], uvs[5]]);
    this.tri(ax, ay, az, cx, cy, cz, dx, dy, dz, color, uvs && [uvs[0], uvs[1], uvs[4], uvs[5], uvs[6], uvs[7]]);
  }

  private pushTri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: ColorInput, uvs?: number[]) {
    _e1.subVectors(b, a);
    _e2.subVectors(c, a);
    _n.crossVectors(_e1, _e2);
    const len = _n.length();
    if (len < 1e-10) return;
    _n.multiplyScalar(1 / len);
    _c.set(color);
    for (let i = 0; i < 3; i++) {
      const v = i === 0 ? a : i === 1 ? b : c;
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      let f = 1;
      if (this.ao) {
        const t = Math.min(1, Math.max(0, (v.y - this.ao.y0) / this.ao.h));
        f = this.ao.min + (1 - this.ao.min) * t;
      }
      this.col.push(_c.r * f, _c.g * f, _c.b * f);
      if (uvs) this.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
      else this.uv.push(0.001, 0.001);
    }
  }

  /** Adds a (cached, non-indexed) geometry with a TRS transform. */
  geom(
    g: THREE.BufferGeometry,
    color: ColorInput,
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    ry = 0, rx = 0, rz = 0,
  ) {
    _q.setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    const full = new THREE.Matrix4().multiplyMatrices(this.matrix, _m);
    const p = g.attributes.position.array as ArrayLike<number>;
    for (let i = 0; i < p.length; i += 9) {
      _a.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(full);
      _b.set(p[i + 3], p[i + 4], p[i + 5]).applyMatrix4(full);
      _d.set(p[i + 6], p[i + 7], p[i + 8]).applyMatrix4(full);
      this.pushTri(_a, _b, _d, color);
    }
    return this;
  }

  /** Axis-aligned (in local frame) box from its centre and size. */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: ColorInput, ry = 0) {
    return this.geom(unitBox(), color, cx, cy, cz, sx, sy, sz, ry);
  }

  /** Box rotated about its local X axis (awnings, ramps). */
  tiltBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, color: ColorInput, rx: number, ry = 0) {
    return this.geom(unitBox(), color, cx, cy, cz, sx, sy, sz, ry, rx, 0);
  }

  /** Box sitting on y0 (bottom face at y0). */
  block(cx: number, y0: number, cz: number, sx: number, sy: number, sz: number, color: ColorInput, ry = 0) {
    return this.geom(unitBox(), color, cx, y0 + sy / 2, cz, sx, sy, sz, ry);
  }

  cyl(cx: number, y0: number, cz: number, r: number, h: number, color: ColorInput, seg = 8, rTop = r) {
    if (rTop === r) return this.geom(unitCyl(seg), color, cx, y0, cz, r, h, r);
    const g = prim(`cyl${seg}_${(rTop / r).toFixed(3)}`, () =>
      new THREE.CylinderGeometry(rTop / r, 1, 1, seg, 1).translate(0, 0.5, 0),
    );
    return this.geom(g, color, cx, y0, cz, r, h, r);
  }

  cone(cx: number, y0: number, cz: number, r: number, h: number, color: ColorInput, seg = 8) {
    return this.geom(unitCone(seg), color, cx, y0, cz, r, h, r);
  }

  sphere(cx: number, cy: number, cz: number, r: number, color: ColorInput, detail = 1, sy = r) {
    return this.geom(unitSphere(detail), color, cx, cy, cz, r, sy, r);
  }

  /** A square beam between two points. */
  beam(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w: number, color: ColorInput) {
    _a.set(x0, y0, z0);
    _b.set(x1, y1, z1);
    const len = _a.distanceTo(_b);
    if (len < 1e-5) return this;
    _d.subVectors(_b, _a).normalize();
    _q.setFromUnitVectors(_up, _d);
    _m.compose(_p.addVectors(_a, _b).multiplyScalar(0.5), _q, _s.set(w, len, w));
    const full = new THREE.Matrix4().multiplyMatrices(this.matrix, _m);
    const p = unitBox().attributes.position.array as ArrayLike<number>;
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    for (let i = 0; i < p.length; i += 9) {
      v0.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(full);
      v1.set(p[i + 3], p[i + 4], p[i + 5]).applyMatrix4(full);
      v2.set(p[i + 6], p[i + 7], p[i + 8]).applyMatrix4(full);
      this.pushTri(v0, v1, v2, color);
    }
    return this;
  }

  /** Tapered box: bottom (w0×d0) at y0, top (w1×d1) at y0+h. */
  frustum(cx: number, y0: number, cz: number, w0: number, d0: number, w1: number, d1: number, h: number, color: ColorInput, ry = 0, top = true) {
    this.push(cx, y0, cz, ry);
    const a = [-w0 / 2, 0, -d0 / 2], b = [w0 / 2, 0, -d0 / 2], c = [w0 / 2, 0, d0 / 2], d = [-w0 / 2, 0, d0 / 2];
    const A = [-w1 / 2, h, -d1 / 2], B = [w1 / 2, h, -d1 / 2], C = [w1 / 2, h, d1 / 2], D = [-w1 / 2, h, d1 / 2];
    const q = (p: number[], r: number[], s: number[], t: number[]) =>
      this.quad(p[0], p[1], p[2], r[0], r[1], r[2], s[0], s[1], s[2], t[0], t[1], t[2], color);
    q(d, c, C, D); // front (+z)
    q(b, a, A, B); // back
    q(c, b, B, C); // right
    q(a, d, D, A); // left
    if (top && w1 > 0.001 && d1 > 0.001) q(D, C, B, A);
    this.pop();
    return this;
  }

  /** Gable (triangular prism) roof along local X: width w (x), depth d (z), ridge height h. */
  gable(cx: number, y0: number, cz: number, w: number, d: number, h: number, color: ColorInput, ry = 0, gableColor: ColorInput = color) {
    this.push(cx, y0, cz, ry);
    const hw = w / 2, hd = d / 2;
    this.quad(-hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, h, 0, color);
    this.quad(hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, h, 0, color);
    this.tri(hw, 0, hd, hw, 0, -hd, hw, h, 0, gableColor);
    this.tri(-hw, 0, -hd, -hw, 0, hd, -hw, h, 0, gableColor);
    this.pop();
    return this;
  }

  /** Hip/pyramid roof. */
  pyramid(cx: number, y0: number, cz: number, w: number, d: number, h: number, color: ColorInput, ry = 0) {
    return this.frustum(cx, y0, cz, w, d, 0.001, 0.001, h, color, ry, false);
  }

  /** Horizontal rectangle (facing +Y) with world-scaled UVs. */
  rectXZ(x0: number, z0: number, x1: number, z1: number, y: number, color: ColorInput, uvScale = 0) {
    if (uvScale > 0) {
      const u0 = x0 / uvScale, u1 = x1 / uvScale, v0 = -z0 / uvScale, v1 = -z1 / uvScale;
      this.quad(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0, color, [u0, v1, u1, v1, u1, v0, u0, v0]);
    } else this.quad(x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0, color);
    return this;
  }

  /** Oriented flat quad on the ground: centre, length along dir, width across. */
  stripXZ(cx: number, cz: number, dirX: number, dirZ: number, len: number, wid: number, y: number, color: ColorInput, uvScale = 0) {
    const hx = (dirX * len) / 2, hz = (dirZ * len) / 2;
    const px = (-dirZ * wid) / 2, pz = (dirX * wid) / 2;
    const ax = cx - hx - px, az = cz - hz - pz;
    const bx = cx + hx - px, bz = cz + hz - pz;
    const ccx = cx + hx + px, ccz = cz + hz + pz;
    const dx = cx - hx + px, dz = cz - hz + pz;
    if (uvScale > 0) {
      const s = 1 / uvScale;
      this.quad(ax, y, az, dx, y, dz, ccx, y, ccz, bx, y, bz, color, [ax * s, -az * s, dx * s, -dz * s, ccx * s, -ccz * s, bx * s, -bz * s]);
    } else this.quad(ax, y, az, dx, y, dz, ccx, y, ccz, bx, y, bz, color);
    // ensure facing up
    return this;
  }

  /** Thick slab with top + 4 sides (no bottom), top UV world-scaled. */
  slab(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, topColor: ColorInput, sideColor: ColorInput, uvScale = 0) {
    this.rectXZ(x0, z0, x1, z1, y1, topColor, uvScale);
    this.quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, sideColor);
    this.quad(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, sideColor);
    this.quad(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, sideColor);
    this.quad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, sideColor);
    return this;
  }

  /**
   * Building volume with facade UVs (bay/floor scaled) on the four walls and a flat roof.
   * uOff/vOff shift the window pattern so neighbouring buildings differ.
   */
  facadeBox(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, color: ColorInput, roofColor: ColorInput, uOff = 0, vOff = 0, roof = true) {
    const su = 1 / (BAY * FACADE_TILE), sv = 1 / (FLOOR * FACADE_TILE);
    const v0 = vOff, v1 = vOff + (y1 - y0) * sv;
    const wall = (ax: number, az: number, bx: number, bz: number) => {
      const len = Math.hypot(bx - ax, bz - az);
      const u0 = uOff, u1 = uOff + len * su;
      this.quad(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az, color, [u0, v0, u1, v0, u1, v1, u0, v1]);
    };
    wall(x0, z1, x1, z1);
    wall(x1, z0, x0, z0);
    wall(x1, z1, x1, z0);
    wall(x0, z0, x0, z1);
    if (roof) {
      const saved = this.ao;
      this.ao = null;
      this.rectXZ(x0, z0, x1, z1, y1, roofColor);
      this.ao = saved;
    }
    return this;
  }

  /** Extruded polygon (counter-clockwise when seen from above, i.e. x right / z down → clockwise in x,z) with facade UVs and a flat cap. */
  facadePrism(pts: [number, number][], y0: number, y1: number, color: ColorInput, roofColor: ColorInput, uOff = 0, vOff = 0) {
    const su = 1 / (BAY * FACADE_TILE), sv = 1 / (FLOOR * FACADE_TILE);
    const v0 = vOff, v1 = vOff + (y1 - y0) * sv;
    // make sure walls face outward: compute signed area in x/z
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      area += ax * bz - bx * az;
    }
    const P = area < 0 ? pts : [...pts].reverse();
    let u = uOff;
    for (let i = 0; i < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length];
      const len = Math.hypot(bx - ax, bz - az);
      this.quad(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az, color, [u, v0, u + len * su, v0, u + len * su, v1, u, v1]);
      u += len * su;
    }
    const saved = this.ao;
    this.ao = null;
    const tris = THREE.ShapeUtils.triangulateShape(P.map(([x, z]) => new THREE.Vector2(x, z)), []);
    for (const [a, b, c] of tris) {
      const A = P[a], B = P[b], C = P[c];
      // ensure upward normal
      const cross = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (cross < 0) this.tri(A[0], y1, A[1], B[0], y1, B[1], C[0], y1, C[1], roofColor);
      else this.tri(A[0], y1, A[1], C[0], y1, C[1], B[0], y1, B[1], roofColor);
    }
    this.ao = saved;
    return this;
  }

  /** Arch (half torus-like ring) in the local XY plane, centred at (cx, cy, cz). */
  arch(cx: number, cy: number, cz: number, r: number, thick: number, depth: number, color: ColorInput, seg = 10, ry = 0, start = 0, end = Math.PI) {
    this.push(cx, cy, cz, ry);
    for (let i = 0; i < seg; i++) {
      const a0 = start + ((end - start) * i) / seg, a1 = start + ((end - start) * (i + 1)) / seg;
      const ix0 = Math.cos(a0) * r, iy0 = Math.sin(a0) * r, ix1 = Math.cos(a1) * r, iy1 = Math.sin(a1) * r;
      const R = r + thick;
      const ox0 = Math.cos(a0) * R, oy0 = Math.sin(a0) * R, ox1 = Math.cos(a1) * R, oy1 = Math.sin(a1) * R;
      const hd = depth / 2;
      this.quad(ix0, iy0, hd, ox0, oy0, hd, ox1, oy1, hd, ix1, iy1, hd, color); // front
      this.quad(ix1, iy1, -hd, ox1, oy1, -hd, ox0, oy0, -hd, ix0, iy0, -hd, color); // back
      this.quad(ox0, oy0, hd, ox0, oy0, -hd, ox1, oy1, -hd, ox1, oy1, hd, color); // outer
      this.quad(ix1, iy1, hd, ix1, iy1, -hd, ix0, iy0, -hd, ix0, iy0, hd, color); // inner
    }
    this.pop();
    return this;
  }

  /** Lathe: profile of [radius, y] points revolved around Y. */
  lathe(cx: number, y0: number, cz: number, profile: [number, number][], color: ColorInput, seg = 12) {
    const key = `lathe${seg}:${profile.map((p) => p.join(',')).join(';')}`;
    const g = prim(key, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg));
    return this.geom(g, color, cx, y0, cz, 1, 1, 1);
  }

  isEmpty() {
    return this.pos.length === 0;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Groups builders by spatial chunk and material key so frustum culling still works on merged geometry. */
export class ChunkedBuilders {
  private map = new Map<string, { key: string; cx: number; cz: number; b: GeometryBuilder }>();
  constructor(public chunkSize: number) {}

  get(material: string, x: number, z: number): GeometryBuilder {
    const cx = Math.floor(x / this.chunkSize), cz = Math.floor(z / this.chunkSize);
    const k = `${material}|${cx}|${cz}`;
    let e = this.map.get(k);
    if (!e) {
      e = { key: material, cx, cz, b: new GeometryBuilder() };
      this.map.set(k, e);
    }
    return e.b;
  }

  entries() {
    return [...this.map.values()];
  }
}
