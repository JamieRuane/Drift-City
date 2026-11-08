import * as THREE from 'three';
import type { CityDefinition } from './types';
import type { LandmarkContext } from '../world/LandmarkContext';
import { CURB_H } from '../world/CityLayout';
import { billboardTexture } from '../world/textures';
import { lattice, sign } from './landmarks/common';
import type { GeometryBuilder } from '../world/GeometryBuilder';

const Y = CURB_H;

function screen(ctx: LandmarkContext, lx: number, ly: number, lz: number, w: number, h: number, ry: number, seed: number, kind: 'ad' | 'kanji' | 'news') {
  const bb = billboardTexture(seed, kind);
  const mat = new THREE.MeshBasicMaterial({ map: bb.tex, toneMapped: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  ctx.object(m, lx, ly, lz, ry);
  let acc = Math.random();
  ctx.animate({
    update(t, dt, night) {
      acc += dt;
      const s = 1 + night * 0.9;
      mat.color.setRGB(s, s, s);
      if (acc > 0.12) {
        acc = 0;
        bb.draw(t);
      }
    },
  });
}

// ---------------------------------------------------------------------------------------------- Shibuya Crossing
function shibuya(ctx: LandmarkContext) {
  const L = ctx.layout;
  const n = L.node(3, 4)!;
  const hx = n.hx, hz = n.hz;
  // scramble markings across both diagonals
  const mk = ctx.b('marking');
  const diag = Math.hypot(hx, hz) * 2;
  for (const s of [-1, 1]) {
    const dx = (hx * 2) / diag, dz = (s * hz * 2) / diag;
    for (let t = -diag / 2 + 1.5; t < diag / 2 - 1.5; t += 1.15) {
      mk.stripXZ(dx * t, dz * t, -dz, dx, 3.4, 0.55, 0.03, '#f4f4f4');
    }
  }
  // giant screens on frames at the four corners
  const p = ctx.b('plain');
  const off = hx + 3.4;
  let seed = 40;
  for (const [sx, sz] of [[1, -1], [-1, -1], [1, 1], [-1, 1]] as const) {
    const cx = sx * off, cz = sz * off;
    // screen faces diagonally toward the crossing
    const ry = Math.atan2(-sx, -sz);
    const w = sx * sz > 0 ? 14 : 10;
    p.push(cx, 0, cz, ry);
    p.block(0, Y + 10, -0.7, w + 0.8, 9.6, 1.0, '#2a2c33');
    p.block(-w / 2 + 0.4, Y, -0.7, 0.6, 10, 0.6, '#2a2c33');
    p.block(w / 2 - 0.4, Y, -0.7, 0.6, 10, 0.6, '#2a2c33');
    p.pop();
    screen(ctx, cx + Math.sin(ry) * -0.15, Y + 14.8, cz + Math.cos(ry) * -0.15, w, 8.6, ry, seed++, seed % 2 ? 'kanji' : 'ad');
    ctx.box(cx, Y + 5, cz, 1.2, 5, 1.2);
  }
  // Hachikō
  const b = ctx.b('lit');
  const hpx = -off + 1.2, hpz = off - 1.2;
  b.block(hpx, Y, hpz, 1.6, 1.0, 1.0, '#9a9690');
  const bronze = '#5d5245';
  b.block(hpx, Y + 1.0, hpz, 0.5, 0.5, 0.9, bronze);
  b.block(hpx, Y + 1.4, hpz + 0.45, 0.4, 0.55, 0.35, bronze);
  b.sphere(hpx, Y + 2.0, hpz + 0.5, 0.25, bronze, 0);
  b.cone(hpx - 0.1, Y + 2.15, hpz + 0.5, 0.08, 0.2, bronze, 4);
  b.cone(hpx + 0.1, Y + 2.15, hpz + 0.5, 0.08, 0.2, bronze, 4);
  ctx.box(hpx, Y + 0.8, hpz, 0.8, 0.8, 0.5);
}

// ---------------------------------------------------------------------------------------------- Tokyo Tower
function tokyoTower(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const O = '#ff4a1c', W = '#f4f1ec';
  const oz = -6;
  b.push(0, Y, oz);
  const B = 15;
  const band = (i: number) => (i % 2 === 0 ? O : W);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const t0 = k / 3, t1 = (k + 1) / 3;
      const lerp = (a: number, c: number, t: number) => a + (c - a) * t;
      lattice(
        b,
        { x: sx * lerp(B - 2.5, 7.5, t0), y: lerp(0, 42, t0), z: sz * lerp(B - 2.5, 7.5, t0), h: lerp(2.5, 1.4, t0) },
        { x: sx * lerp(B - 2.5, 7.5, t1), y: lerp(0, 42, t1), z: sz * lerp(B - 2.5, 7.5, t1), h: lerp(2.5, 1.4, t1) },
        2, 0.45, band(k), band(k),
      );
    }
    b.frustum(sx * (B - 2.5), 0, sz * (B - 2.5), 6, 6, 5.5, 5.5, 1, '#cfc9c0');
  }
  for (let f = 0; f < 4; f++) {
    b.push(0, 0, 0, (f * Math.PI) / 2);
    b.arch(0, 6, 11, 7, 0.8, 0.8, O, 12, 0, 0.2, Math.PI - 0.2);
    b.pop();
  }
  // main deck
  b.block(0, 42, 0, 19, 1.2, 19, W);
  const g = ctx.b('glow');
  g.block(0, 43.2, 0, 18.6, 3.2, 18.6, '#ffe2b0');
  b.block(0, 46.4, 0, 19.4, 1.2, 19.4, O);
  b.block(0, 47.6, 0, 15, 2.5, 15, W);
  const segs = 6;
  for (let k = 0; k < segs; k++) {
    const y0 = 50 + k * 8, y1 = y0 + 8;
    const h0 = 6.2 - k * 0.75, h1 = 6.2 - (k + 1) * 0.75;
    lattice(b, { x: 0, y: y0, z: 0, h: h0 }, { x: 0, y: y1, z: 0, h: h1 }, 1, 0.38, band(k), band(k));
  }
  b.block(0, 98, 0, 7, 3, 7, W);
  g.block(0, 98.6, 0, 6.6, 1.8, 6.6, '#ffe2b0');
  b.cyl(0, 101, 0, 1.6, 10, O, 8, 1.0);
  b.cyl(0, 111, 0, 0.7, 12, W, 6, 0.3);
  b.cyl(0, 123, 0, 0.3, 6, O, 6, 0.08);
  b.pop();
  g.sphere(0, Y + 129, oz, 0.5, '#ff3030', 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ctx.cyl(sx * (B - 2.5), Y + 3, oz + sz * (B - 2.5), 3.2, 3);
  // floodlight glow at night
  const light = new THREE.PointLight(0xff8a40, 0, 140, 1.6);
  ctx.object(light, 0, Y + 30, oz);
  ctx.animate({ update: (_t, _dt, night) => { light.intensity = night * 900; } });
  for (let z = -ctx.hd + 6; z < ctx.hd - 4; z += 10) {
    ctx.tree(-ctx.hw + 6, z, 1.0, 'cherry', Y);
    ctx.tree(ctx.hw - 6, z, 1.0, 'cherry', Y);
  }
}

// ---------------------------------------------------------------------------------------------- Sensō-ji
function roofTier(b: GeometryBuilder, x: number, y: number, z: number, w: number, d: number, color: string) {
  b.frustum(x, y, z, w + 3.2, d + 3.2, w * 0.55, d * 0.55, 1.6, color);
  b.block(x, y - 0.15, z, w + 3.4, 0.2, d + 3.4, '#3a2a24');
}

function sensoji(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const red = '#c8281e', roof = '#3f4650', wood = '#7a2a1e';
  const hd = ctx.hd - 5;
  // Kaminarimon gate (south)
  const gz = hd - 4;
  for (const s of [-1, 1]) {
    b.block(s * 5.5, Y, gz, 3.2, 7, 4, red);
    ctx.box(s * 5.5, Y + 3.5, gz, 1.6, 3.5, 2);
  }
  b.block(0, Y + 7, gz, 15, 1.2, 5, red);
  roofTier(b, 0, Y + 8.2, gz, 14, 5, roof);
  // giant lantern
  b.cyl(0, Y + 3.4, gz, 1.7, 3.4, '#d42b20', 12);
  b.cyl(0, Y + 3.2, gz, 1.0, 0.3, '#1d1d1d', 10);
  b.cyl(0, Y + 6.7, gz, 1.0, 0.3, '#1d1d1d', 10);
  ctx.b('glow').cyl(0, Y + 3.6, gz, 1.65, 2.9, '#ff5a3c', 12);
  sign(ctx, '雷門', 0, Y + 5.1, gz + 1.72, 1.6, 1.0, '#d42b20', '#1a1a1a');
  // Nakamise shopping street
  for (const s of [-1, 1]) {
    for (let z = gz - 9; z > -hd + 30; z -= 4.2) {
      b.block(s * 6.5, Y, z, 4, 3.2, 3.8, '#efe6d6');
      b.block(s * 6.5 - s * 2.05, Y + 0.3, z, 0.1, 2.2, 3.2, '#e8b24a');
      roofTier(b, s * 6.5, Y + 3.2, z, 3.6, 3.4, '#9a3324');
    }
    ctx.box(s * 6.5, Y + 2, (gz - 9 + -hd + 30) / 2, 2.2, 2, Math.abs(gz - 9 - (-hd + 30)) / 2 + 2);
  }
  // Five-storey pagoda (west) and main hall (north)
  const px = -ctx.hw + 12, pz = -hd + 16;
  b.block(px, Y, pz, 9, 1.2, 9, '#d8d2c4');
  for (let k = 0; k < 5; k++) {
    const y = Y + 1.2 + k * 5.2;
    const w = 6.5 - k * 0.45;
    b.block(px, y, pz, w, 3.6, w, wood);
    roofTier(b, px, y + 3.6, pz, w, w, roof);
  }
  b.cyl(px, Y + 28, pz, 0.25, 10, '#c9a24a', 6);
  for (let k = 0; k < 7; k++) b.cyl(px, Y + 29 + k * 1.1, pz, 0.7 - k * 0.06, 0.18, '#c9a24a', 8);
  ctx.box(px, Y + 13, pz, 4.5, 13, 4.5);
  // main hall
  const mz = -hd + 9;
  b.block(6, Y, mz, 20, 1.6, 14, '#d8d2c4');
  b.block(6, Y + 1.6, mz, 16, 7, 10, red);
  roofTier(b, 6, Y + 8.6, mz, 16, 10, roof);
  b.frustum(6, Y + 10.2, mz, 10, 6, 6, 1, 4, roof);
  ctx.box(6, Y + 6, mz, 10, 6, 7);
  // incense burner
  b.cyl(0, Y, -hd + 22, 1.4, 1.2, '#4a4038', 8);
  b.pyramid(0, Y + 2.4, -hd + 22, 2, 2, 1.4, '#4a4038');
  for (const s of [-1, 1]) b.block(s * 1.2, Y + 1.2, -hd + 22, 0.3, 1.2, 0.3, '#4a4038');
  ctx.cyl(0, Y + 1, -hd + 22, 1.5, 1);
  for (let z = -hd + 4; z < hd - 10; z += 9) ctx.tree(ctx.hw - 6, z, 1.0, 'cherry', Y);
}

// ---------------------------------------------------------------------------------------------- Kabukichō gate
function kabukicho(ctx: LandmarkContext) {
  const L = ctx.layout;
  const hz = L.halfZ(2);
  const b = ctx.b('lit');
  const g = ctx.b('glow');
  const span = hz + 2.6;
  for (const s of [-1, 1]) {
    b.block(0, 0, s * span, 0.7, 8.6, 0.7, '#9a1a20');
    ctx.box(0, 4, s * span, 0.4, 4, 0.4);
  }
  b.block(0, 8.6, 0, 0.9, 0.6, span * 2 + 1.2, '#9a1a20');
  g.block(0, 7.0, 0, 0.5, 1.6, span * 2 - 0.4, '#ff2a3a');
  const m1 = sign(ctx, '歌舞伎町一番街', 0.27, 7.0, 0, span * 2 - 0.8, 1.4, '#120406', '#ff3b4d', Math.PI / 2);
  m1.renderOrder = 2;
  const m2 = sign(ctx, '歌舞伎町一番街', -0.27, 7.0, 0, span * 2 - 0.8, 1.4, '#120406', '#ff3b4d', -Math.PI / 2);
  m2.renderOrder = 2;
  // lantern strings along the street
  for (let x = -24; x <= 24; x += 3) {
    if (Math.abs(x) < 2) continue;
    for (const s of [-1, 1]) g.sphere(x, 6.2 + Math.sin(x) * 0.2, s * (hz + 2.2), 0.28, x % 6 === 0 ? '#ff3d8b' : '#ffd23a', 0);
  }
}

export const TOKYO: CityDefinition = {
  id: 'tokyo',
  name: 'Tokyo',
  country: 'Japan',
  flag: '🇯🇵',
  tagline: 'Neon After Dark',
  description: 'Dense streets, vending machines on every corner and the world’s busiest crossing under giant screens.',
  theme: { sky: ['#7a3fb0', '#160f3a'], accent: '#ff3d8b', ground: '#1c1f44' },
  grid: { cols: 8, rows: 8, block: 48, road: 12 },
  wideX: { 3: 16 },
  wideZ: { 4: 16 },
  areas: [
    { type: 'landmark', c0: 6, r0: 5, r1: 6, ground: 'grass', landmark: 'tokyotower' },
    { type: 'landmark', c0: 1, r0: 1, r1: 2, ground: 'cobble', landmark: 'sensoji' },
    { type: 'park', c0: 4, r0: 1, trees: 1.4 },
    { type: 'park', c0: 1, r0: 6, pond: true },
  ],
  style: {
    facades: [['modern', 5], ['brick', 1], ['stone', 2]],
    wallColors: ['#e8e6e1', '#d6d2cb', '#c4c8cc', '#efe9df', '#b9bec4', '#d9d0c4', '#a9b0b8', '#f2efe9'],
    roofColors: ['#8a9098', '#7d838b', '#9aa0a8'],
    trimColor: '#cfd2d6',
    floors: [4, 10],
    towerChance: 0.16,
    towerFloors: [14, 34],
    glassTowerChance: 0.5,
    roof: 'flat',
    lotWidth: [7, 13],
    shopChance: 0.7,
    awningColors: ['#d42b20', '#1f4f8a', '#2a8a5a', '#f2b31a', '#2a2a30'],
    shopColors: ['#2a2d33', '#d42b20', '#1f3d6b', '#f2f2f2', '#2a8a5a'],
    neonChance: 0.42,
  },
  palette: {
    asphalt: '#4a4e57', sidewalk: '#c9c9c6', curb: '#a7a8a6', grass: '#86b863', plaza: '#cfc6b6',
    marking: '#f4f4f4', centerLine: '#f4f4f4', outerGround: '#bdbcb8', hills: '#6c7aa0', water: '#3f6f8f',
  },
  treeKind: 'cherry',
  lampStyle: 'modern',
  streetProps: ['vending', 'vending', 'bike', 'planter'],
  driveSide: 'left',
  traffic: {
    colors: ['#f4f4f0', '#e8e8ea', '#2b2f36', '#9aa3ad', '#c0c4ca', '#1f3f7a', '#8a1f2a'],
    taxi: { color: '#2f7d55', share: 0.25 },
    buses: '#3fa66b',
  },
  spawn: { node: [3, 6], dir: 'N' },
  startHour: 19.6,
  landmarks: [
    {
      id: 'shibuya', name: 'Shibuya Crossing', icon: '🚦', xp: 300, anchor: { node: [3, 4] }, radius: 30,
      description: 'Up to 3,000 people cross in every direction at once. Hachikō, the loyal dog statue, waits on the corner.',
      build: shibuya,
    },
    {
      id: 'tokyotower', name: 'Tokyo Tower', icon: '🗼', xp: 250, anchor: { area: true }, radius: 55,
      description: 'Inspired by the Eiffel Tower but taller, it is painted orange and white to satisfy air-safety rules.',
      build: tokyoTower,
    },
    {
      id: 'sensoji', name: 'Sensō-ji Temple', icon: '⛩️', xp: 250, anchor: { area: true }, radius: 60,
      description: 'Tokyo’s oldest temple, founded in 645. The Thunder Gate’s giant red lantern weighs about 700 kg.',
      build: sensoji,
    },
    {
      id: 'kabukicho', name: 'Kabukichō Neon Gate', icon: '🏮', xp: 200, anchor: { grid: [5.5, 2] }, radius: 30,
      description: 'The red gate of Kabukichō Ichiban-gai marks the entrance to Shinjuku’s glowing entertainment district.',
      build: kabukicho,
    },
  ],
};
