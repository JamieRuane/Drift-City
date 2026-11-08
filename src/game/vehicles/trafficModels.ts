import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type TrafficKind = 'sedan' | 'sports' | 'van' | 'truck' | 'bus' | 'vault';

export interface TrafficTypeDef {
  kind: TrafficKind;
  length: number;
  width: number;
  height: number;
  /** multiplier on the shared traffic flow speed (uniform flow keeps rows from merging into walls) */
  flow: number;
  spawnWeight: number;
  laneChangeRate: number;
  colors: string[];
  capacity: number;
  points: number;
}

export const TRAFFIC_TYPES: Record<TrafficKind, TrafficTypeDef> = {
  sedan: { kind: 'sedan', length: 4.5, width: 1.85, height: 1.45, flow: 1, spawnWeight: 5, laneChangeRate: 0.5, colors: ['#d8dde6', '#3a3f4b', '#9b1b2a', '#1d4f9c', '#2f6e4b', '#b9b9b9', '#121317', '#c8a96a'], capacity: 34, points: 1 },
  sports: { kind: 'sports', length: 4.4, width: 1.95, height: 1.2, flow: 1.14, spawnWeight: 1.6, laneChangeRate: 1.0, colors: ['#ffcc00', '#ff4d00', '#00a2ff', '#e6e6e6', '#d6005c'], capacity: 12, points: 1.5 },
  van: { kind: 'van', length: 5.2, width: 2.05, height: 2.2, flow: 1, spawnWeight: 1.6, laneChangeRate: 0.35, colors: ['#e9ebef', '#2f3a4a', '#c95a1a', '#3c6b7a'], capacity: 12, points: 1.2 },
  truck: { kind: 'truck', length: 10.5, width: 2.5, height: 3.6, flow: 1, spawnWeight: 1.1, laneChangeRate: 0.15, colors: ['#c7202e', '#1f4fb8', '#e8e8e8', '#2b8a3e', '#f2a516'], capacity: 10, points: 2 },
  bus: { kind: 'bus', length: 12, width: 2.55, height: 3.3, flow: 1, spawnWeight: 0.7, laneChangeRate: 0.1, colors: ['#ffb000', '#2c7be5', '#e03a3a', '#18a999'], capacity: 8, points: 2 },
  vault: { kind: 'vault', length: 6.6, width: 2.4, height: 2.6, flow: 1, spawnWeight: 0.08, laneChangeRate: 0.2, colors: ['#ffffff'], capacity: 3, points: 6 },
};

type RGB = [number, number, number];
const PAINT: RGB = [1, 1, 1];
const GLASS: RGB = [0.05, 0.06, 0.08];
const TYRE: RGB = [0.03, 0.03, 0.035];
const TRIM: RGB = [0.12, 0.12, 0.14];
const GREY: RGB = [0.75, 0.76, 0.78];
const HEAD: RGB = [3.2, 3.0, 2.6];
const TAIL: RGB = [2.4, 0.08, 0.12];

function cbox(w: number, h: number, d: number, x: number, y: number, z: number, c: RGB) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colorize(g, c);
}

function colorize(g: THREE.BufferGeometry, c: RGB) {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}

function wheel(r: number, w: number, x: number, z: number) {
  const g = new THREE.CylinderGeometry(r, r, w, 10);
  g.rotateZ(Math.PI / 2);
  g.translate(x, r, z);
  return colorize(g, TYRE);
}

function wheels(r: number, halfTrack: number, zs: number[]) {
  const out: THREE.BufferGeometry[] = [];
  for (const z of zs) for (const sx of [-1, 1]) out.push(wheel(r, 0.28, sx * halfTrack, z));
  return out;
}

/** Builds merged, vertex-coloured geometry for a traffic type: body (tinted per instance) + emissive lights. */
export function buildTrafficGeometry(kind: TrafficKind) {
  const t = TRAFFIC_TYPES[kind];
  const L = t.length, W = t.width;
  const f = -L / 2, r = L / 2; // front (-z), rear (+z)
  const body: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const headPair = (y: number, inset: number, size = 0.32) => {
    for (const sx of [-1, 1]) lights.push(cbox(size, 0.12, 0.05, sx * (W / 2 - inset), y, f - 0.02, HEAD));
  };
  const tailPair = (y: number, inset: number, size = 0.34) => {
    for (const sx of [-1, 1]) lights.push(cbox(size, 0.14, 0.05, sx * (W / 2 - inset), y, r + 0.02, TAIL));
  };

  switch (kind) {
    case 'sedan':
    case 'sports': {
      const low = kind === 'sports';
      const bh = low ? 0.55 : 0.68;
      body.push(cbox(W, bh, L, 0, 0.3 + bh / 2, 0, PAINT));
      body.push(cbox(W * 0.84, low ? 0.42 : 0.52, L * (low ? 0.42 : 0.5), 0, 0.3 + bh + (low ? 0.21 : 0.26), low ? 0.25 : 0.2, GLASS));
      body.push(cbox(W * 0.8, 0.06, L * (low ? 0.34 : 0.42), 0, 0.3 + bh + (low ? 0.43 : 0.53), low ? 0.3 : 0.22, PAINT));
      body.push(cbox(W + 0.02, 0.16, 0.18, 0, 0.36, f + 0.08, TRIM), cbox(W + 0.02, 0.16, 0.18, 0, 0.36, r - 0.08, TRIM));
      if (low) body.push(cbox(W * 0.9, 0.05, 0.3, 0, 0.3 + bh + 0.22, r - 0.18, TRIM));
      body.push(...wheels(0.34, W / 2 - 0.12, [f + 0.9, r - 0.9]));
      headPair(0.3 + bh * 0.7, 0.3);
      tailPair(0.3 + bh * 0.75, 0.28);
      break;
    }
    case 'van': {
      body.push(cbox(W, 1.85, L * 0.82, 0, 0.35 + 0.92, 0.45, PAINT));
      body.push(cbox(W, 1.1, L * 0.2, 0, 0.35 + 0.55, f + L * 0.1, PAINT));
      body.push(cbox(W * 0.92, 0.65, 0.1, 0, 1.55, f + L * 0.19, GLASS));
      body.push(cbox(W + 0.02, 0.5, L * 0.6, 0, 1.75, 0.6, GLASS));
      body.push(cbox(W + 0.02, 0.16, 0.18, 0, 0.42, f + 0.08, TRIM), cbox(W + 0.02, 0.16, 0.18, 0, 0.42, r - 0.08, TRIM));
      body.push(...wheels(0.36, W / 2 - 0.14, [f + 1.0, r - 1.0]));
      headPair(0.8, 0.3);
      tailPair(1.0, 0.16, 0.2);
      break;
    }
    case 'truck': {
      const cabL = 2.4;
      body.push(cbox(W, 2.6, cabL, 0, 0.5 + 1.3, f + cabL / 2, PAINT));
      body.push(cbox(W * 0.94, 0.9, 0.1, 0, 2.25, f - 0.01, GLASS));
      body.push(cbox(W * 1.02, 3.2, L - cabL - 0.3, 0, 0.6 + 1.6, f + cabL + 0.3 + (L - cabL - 0.3) / 2, GREY));
      body.push(cbox(W * 0.98, 0.4, L - cabL, 0, 0.55, f + cabL + (L - cabL) / 2, TRIM));
      body.push(cbox(W * 1.03, 0.12, L - cabL - 0.4, 0, 2.9, f + cabL + 0.3 + (L - cabL - 0.3) / 2, PAINT));
      body.push(...wheels(0.5, W / 2 - 0.2, [f + 1.2, r - 2.6, r - 1.4]));
      headPair(0.95, 0.3, 0.38);
      tailPair(0.9, 0.2, 0.3);
      lights.push(cbox(W, 0.06, 0.06, 0, 3.85, r + 0.02, [2.8, 1.2, 0.2]));
      break;
    }
    case 'bus': {
      body.push(cbox(W, 2.9, L, 0, 0.35 + 1.45, 0, PAINT));
      for (const sx of [-1, 1]) body.push(cbox(0.03, 0.95, L * 0.86, sx * (W / 2 + 0.01), 2.15, 0.3, GLASS));
      body.push(cbox(W * 0.92, 1.3, 0.06, 0, 1.95, f - 0.01, GLASS));
      body.push(cbox(W * 1.01, 0.3, L, 0, 0.45, 0, TRIM));
      body.push(...wheels(0.5, W / 2 - 0.2, [f + 2.4, r - 2.6]));
      headPair(0.75, 0.3, 0.4);
      tailPair(0.95, 0.15, 0.2);
      lights.push(cbox(W * 0.6, 0.28, 0.05, 0, 3.0, f - 0.03, [2.6, 1.4, 0.1])); // destination sign
      for (const sx of [-1, 1]) lights.push(cbox(0.04, 0.9, L * 0.82, sx * (W / 2 + 0.02), 2.15, 0.3, [0.7, 0.75, 0.55])); // lit cabin
      break;
    }
    case 'vault': {
      const GOLD: RGB = [1.0, 0.72, 0.18];
      body.push(cbox(W, 1.2, L, 0, 0.35 + 0.6, 0, GOLD));
      body.push(cbox(W * 0.98, 1.2, L * 0.62, 0, 1.55 + 0.6 - 0.05, 0.6, GOLD));
      body.push(cbox(W * 0.9, 0.7, L * 0.22, 0, 1.85, f + L * 0.2, GLASS));
      body.push(...wheels(0.42, W / 2 - 0.16, [f + 1.2, r - 1.4, r - 0.5]));
      headPair(0.9, 0.3);
      tailPair(1.0, 0.2);
      for (const sx of [-1, 1]) lights.push(cbox(0.05, 0.08, L * 0.9, sx * (W / 2 + 0.02), 1.4, 0, [3.2, 2.2, 0.4]));
      lights.push(cbox(0.6, 0.18, 0.6, 0, 2.86, 0.6, [3.2, 2.0, 0.2]));
      break;
    }
  }
  return { body: mergeGeometries(body)!, lights: mergeGeometries(lights)! };
}
