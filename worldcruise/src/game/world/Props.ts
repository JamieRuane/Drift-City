import * as THREE from 'three';
import { GeometryBuilder, type ChunkedBuilders } from './GeometryBuilder';
import type { ColliderDesc, TreeInstance, TreeKind } from './LandmarkContext';
import type { Materials } from './Materials';
import type { CityDefinition, StreetProp } from '../cities/types';
import type { Rng } from '../core/rng';

const treeGeoms = new Map<TreeKind, THREE.BufferGeometry>();

function treeGeometry(kind: TreeKind) {
  const hit = treeGeoms.get(kind);
  if (hit) return hit;
  const b = new GeometryBuilder();
  const trunk = '#7a5a43';
  switch (kind) {
    case 'round':
      b.cyl(0, 0, 0, 0.22, 2.6, trunk, 6, 0.16);
      b.sphere(0, 3.6, 0, 2.0, '#5d9b4a', 0, 1.8);
      b.sphere(0.9, 3.0, 0.5, 1.3, '#6aa954', 0);
      b.sphere(-0.8, 4.2, -0.4, 1.2, '#548f43', 0);
      break;
    case 'plane':
      b.cyl(0, 0, 0, 0.26, 3.6, '#a59a86', 6, 0.18);
      b.sphere(0, 5.2, 0, 2.6, '#6f9e48', 0, 2.0);
      b.sphere(1.3, 4.6, 0.3, 1.6, '#7cae55', 0);
      b.sphere(-1.2, 4.9, -0.5, 1.5, '#62913f', 0);
      break;
    case 'cherry':
      b.cyl(0, 0, 0, 0.2, 2.2, '#5d4034', 6, 0.14);
      b.beam(0, 2.0, 0, 0.9, 3.0, 0.3, 0.14, '#5d4034');
      b.beam(0, 2.0, 0, -0.8, 3.1, -0.3, 0.14, '#5d4034');
      b.sphere(0, 3.4, 0, 1.9, '#f6b7cf', 0, 1.5);
      b.sphere(1.1, 3.1, 0.4, 1.2, '#f9c9da', 0);
      b.sphere(-1.0, 3.5, -0.5, 1.2, '#f2a6c2', 0);
      break;
    case 'conifer':
      b.cyl(0, 0, 0, 0.2, 1.4, trunk, 6);
      b.cone(0, 1.0, 0, 1.8, 2.8, '#3f7a4d', 7);
      b.cone(0, 2.6, 0, 1.4, 2.4, '#468656', 7);
      b.cone(0, 4.0, 0, 0.95, 2.0, '#4f915e', 7);
      break;
    case 'palm':
      b.cyl(0, 0, 0, 0.2, 6, '#9b7a55', 6, 0.15);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        b.beam(0, 6, 0, Math.cos(a) * 2.4, 5.2, Math.sin(a) * 2.4, 0.25, '#4f9a4a');
      }
      break;
  }
  const g = b.build();
  treeGeoms.set(kind, g);
  return g;
}

export function buildTrees(trees: TreeInstance[], mats: Materials, rng: Rng): THREE.InstancedMesh[] {
  const byKind = new Map<TreeKind, TreeInstance[]>();
  for (const t of trees) {
    let l = byKind.get(t.kind);
    if (!l) byKind.set(t.kind, (l = []));
    l.push(t);
  }
  const out: THREE.InstancedMesh[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  for (const [kind, list] of byKind) {
    const mesh = new THREE.InstancedMesh(treeGeometry(kind), mats.plain, list.length);
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
      m.compose(p.set(t.x, t.y, t.z), q, s.set(t.s, t.s * (0.9 + rng() * 0.25), t.s));
      mesh.setMatrixAt(i, m);
      const v = 0.85 + rng() * 0.25;
      mesh.setColorAt(i, c.setRGB(v, v * (0.95 + rng() * 0.1), v * 0.95));
    });
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.computeBoundingSphere();
    out.push(mesh);
  }
  return out;
}

export interface LampInfo {
  x: number;
  z: number;
  /** Position of the light pool on the ground. */
  px: number;
  pz: number;
}

/** Street lamp geometry. (nx, nz) points from the kerb toward the road. */
export function lamp(chunks: ChunkedBuilders, style: CityDefinition['lampStyle'], x: number, z: number, nx: number, nz: number, colliders: ColliderDesc[]): LampInfo {
  const plain = chunks.get('plain', x, z), glow = chunks.get('glow', x, z);
  const ry = Math.atan2(nx, nz);
  colliders.push({ kind: 'cyl', x, y: 2, z, r: 0.18, hh: 2 });
  if (style === 'paris') {
    plain.cyl(x, 0, z, 0.24, 0.8, '#26332c', 8, 0.16);
    plain.cyl(x, 0.8, z, 0.09, 3.4, '#26332c', 6);
    plain.push(x, 0, z, ry);
    plain.beam(0, 4.0, 0, 0, 4.25, 0.8, 0.07, '#26332c');
    plain.beam(0, 4.0, 0, 0, 4.25, -0.8, 0.07, '#26332c');
    plain.pop();
    glow.push(x, 0, z, ry);
    for (const s of [-1, 1]) {
      glow.frustum(0, 3.85, s * 0.85, 0.22, 0.22, 0.38, 0.38, 0.45, '#ffd27a');
      plain.push(x, 0, z, ry).pyramid(0, 4.3, s * 0.85, 0.48, 0.48, 0.3, '#26332c').pop();
    }
    glow.pop();
    return { x, z, px: x + nx * 0.8, pz: z + nz * 0.8 };
  }
  if (style === 'classic') {
    plain.cyl(x, 0, z, 0.2, 0.6, '#1f2328', 8, 0.12);
    plain.cyl(x, 0.6, z, 0.08, 3.6, '#1f2328', 6);
    glow.frustum(x, 4.15, z, 0.26, 0.26, 0.42, 0.42, 0.55, '#ffd890');
    plain.pyramid(x, 4.7, z, 0.56, 0.56, 0.35, '#1f2328');
    plain.cyl(x, 4.0, z, 0.2, 0.15, '#1f2328', 6);
    return { x, z, px: x + nx * 0.6, pz: z + nz * 0.6 };
  }
  plain.cyl(x, 0, z, 0.12, 7.2, '#8b939c', 6, 0.09);
  plain.push(x, 0, z, ry);
  plain.beam(0, 7.1, 0, 0, 7.4, 2.2, 0.1, '#8b939c');
  plain.block(0, 7.2, 2.5, 0.5, 0.18, 1.0, '#6f7780');
  plain.pop();
  glow.push(x, 0, z, ry).block(0, 7.12, 2.5, 0.4, 0.08, 0.8, '#fff2d0').pop();
  return { x, z, px: x + nx * 2.5, pz: z + nz * 2.5 };
}

export function buildLightPools(lamps: LampInfo[], mats: Materials) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mats.lightPool, Math.max(1, lamps.length));
  const m = new THREE.Matrix4();
  lamps.forEach((l, i) => {
    m.makeScale(15, 1, 15).setPosition(l.px, 0.2, l.pz);
    mesh.setMatrixAt(i, m);
  });
  mesh.count = lamps.length;
  mesh.renderOrder = 2;
  mesh.computeBoundingSphere();
  return mesh;
}

export function bench(b: GeometryBuilder, x: number, z: number, ry: number) {
  b.push(x, 0.16, z, ry);
  b.block(0, 0.42, 0, 1.8, 0.08, 0.5, '#8a5a36');
  b.block(0, 0.6, -0.24, 1.8, 0.4, 0.06, '#8a5a36');
  b.block(-0.75, 0, 0, 0.08, 0.42, 0.45, '#2c2f33');
  b.block(0.75, 0, 0, 0.08, 0.42, 0.45, '#2c2f33');
  b.pop();
}

/** City-specific street furniture. (nx, nz) points toward the road. */
export function streetProp(kind: StreetProp, chunks: ChunkedBuilders, cityId: string, x: number, z: number, nx: number, nz: number, colliders: ColliderDesc[], rng: Rng) {
  const b = chunks.get('plain', x, z);
  const ry = Math.atan2(nx, nz);
  const y = 0.16;
  switch (kind) {
    case 'morris': {
      b.cyl(x, y, z, 0.7, 0.3, '#22432f', 12);
      b.cyl(x, y + 0.3, z, 0.6, 2.4, '#e8dcc0', 12);
      for (let k = 0; k < 4; k++) {
        b.push(x, 0, z, (k / 4) * Math.PI * 2 + 0.3);
        b.block(0, y + 0.7, 0.59, 0.7, 1.4, 0.04, rng.pick(['#d9493e', '#2d6cdf', '#f2b32b', '#2e9e6a']));
        b.pop();
      }
      b.cyl(x, y + 2.7, z, 0.72, 0.25, '#22432f', 12);
      b.lathe(x, y + 2.95, z, [[0.7, 0], [0.5, 0.4], [0.1, 0.8], [0.02, 1.0]], '#22432f', 12);
      colliders.push({ kind: 'cyl', x, y: 1.5, z, r: 0.7, hh: 1.5 });
      break;
    }
    case 'kiosk': {
      b.push(x, y, z, ry);
      b.block(0, 0, 0, 2.2, 2.3, 1.6, '#2f5d43');
      b.block(0, 1.0, 0.81, 1.8, 0.9, 0.04, '#f0e2b6');
      b.pyramid(0, 2.3, 0, 2.6, 2.0, 0.8, '#2f5d43');
      b.pop();
      colliders.push({ kind: 'box', x, y: 1.2, z, hx: 1.2, hy: 1.2, hz: 1.2, ry });
      break;
    }
    case 'cafe': {
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 1.7;
        b.push(x, y, z, ry);
        b.cyl(ox, 0, 0, 0.05, 0.75, '#333', 5);
        b.cyl(ox, 0.72, 0, 0.38, 0.05, '#f2efe8', 10);
        b.block(ox - 0.5, 0, 0, 0.4, 0.45, 0.4, '#b6312c');
        b.block(ox + 0.5, 0, 0, 0.4, 0.45, 0.4, '#b6312c');
        b.block(ox - 0.5, 0.45, -0.18, 0.4, 0.4, 0.05, '#b6312c');
        b.pop();
      }
      break;
    }
    case 'phonebox': {
      b.push(x, y, z, ry);
      b.block(0, 0, 0, 1.0, 2.4, 1.0, '#d32a2a');
      b.block(0, 0.9, 0.505, 0.75, 1.2, 0.02, '#cfe3ef');
      b.block(0, 2.4, 0, 1.08, 0.18, 1.08, '#d32a2a');
      b.gable(0, 2.58, 0, 1.0, 1.0, 0.18, '#d32a2a');
      b.pop();
      chunks.get('glow', x, z).push(x, y, z, ry).block(0, 2.2, 0.52, 0.6, 0.14, 0.02, '#fff7d6').pop();
      colliders.push({ kind: 'box', x, y: 1.3, z, hx: 0.55, hy: 1.3, hz: 0.55, ry });
      break;
    }
    case 'postbox': {
      const c = cityId === 'dublin' ? '#2f8a4a' : '#cf2a2a';
      b.cyl(x, y, z, 0.3, 1.25, c, 10);
      b.lathe(x, y + 1.25, z, [[0.33, 0], [0.25, 0.15], [0.02, 0.25]], c, 10);
      b.push(x, 0, z, ry).block(0, 0.95, 0.27, 0.3, 0.06, 0.08, '#222').pop();
      colliders.push({ kind: 'cyl', x, y: 0.8, z, r: 0.32, hh: 0.8 });
      break;
    }
    case 'hydrant': {
      const c = rng.pick(['#d33a2c', '#e8b923']);
      b.cyl(x, y, z, 0.2, 0.6, c, 8);
      b.sphere(x, y + 0.65, z, 0.2, c, 0);
      b.push(x, y, z, ry).cyl(0.22, 0.38, 0, 0.08, 0.1, c, 6).cyl(-0.22, 0.38, 0, 0.08, 0.1, c, 6).pop();
      break;
    }
    case 'vending': {
      const c = rng.pick(['#e8eef2', '#d8312e', '#2d6fd6', '#f2f2f2']);
      b.push(x, y, z, ry);
      b.block(0, 0, -0.1, 1.0, 1.9, 0.8, c);
      b.pop();
      const g = chunks.get('glow', x, z);
      g.push(x, y, z, ry);
      g.block(0, 0.85, 0.31, 0.8, 0.85, 0.02, '#cfe8ff');
      for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) g.block(-0.3 + j * 0.2, 1.05 + k * 0.22, 0.33, 0.12, 0.14, 0.02, rng.pick(['#ff6b6b', '#ffd66b', '#6bd0ff', '#8cff6b']));
      g.pop();
      colliders.push({ kind: 'box', x, y: 1.1, z, hx: 0.55, hy: 1.0, hz: 0.45, ry });
      break;
    }
    case 'bike': {
      b.push(x, y, z, ry);
      for (let k = 0; k < 4; k++) b.arch(-1.2 + k * 0.8, 0, 0, 0.35, 0.06, 0.06, '#9aa1a8', 6, Math.PI / 2);
      b.pop();
      break;
    }
    case 'planter': {
      b.block(x, y, z, 1.2, 0.6, 1.2, '#c9b8a0');
      b.sphere(x, y + 1.0, z, 0.7, '#5c9a4e', 0);
      colliders.push({ kind: 'box', x, y: 0.5, z, hx: 0.6, hy: 0.5, hz: 0.6, ry: 0 });
      break;
    }
  }
}
