import * as THREE from 'three';
import type { CityDefinition } from './types';
import type { LandmarkContext } from '../world/LandmarkContext';
import { CURB_H } from '../world/CityLayout';
import { billboardTexture } from '../world/textures';
import { flowerBed, statue } from './landmarks/common';

const Y = CURB_H;

/** Animated screen plane facing local +Z. */
function screen(ctx: LandmarkContext, lx: number, ly: number, lz: number, w: number, h: number, ry: number, seed: number, kind: 'ad' | 'news' | 'kanji' = 'ad') {
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
  return m;
}

// ---------------------------------------------------------------------------------------------- Times Square
function timesSquare(ctx: LandmarkContext) {
  const f = ctx.b('facade:modern');
  const p = ctx.b('plain');
  const hw = ctx.hw - 5, hd = ctx.hd - 5;
  // One Times Square at the north end
  f.facadeBox(-6, -hd, 6, -hd + 11, Y, Y + 52, '#d8d4cc', '#9aa0a8');
  p.block(0, Y + 52, -hd + 5.5, 6, 6, 5, '#8c939c');
  ctx.box(0, Y + 26, -hd + 5.5, 6, 26, 5.5);
  let seed = 1;
  for (let k = 0; k < 4; k++) screen(ctx, 0, Y + 12 + k * 9.5, -hd + 11.15, 11.4, 8.4, 0, seed++, k === 3 ? 'news' : 'ad');
  // flanking towers clad in screens
  const towers: [number, number, number, number, number][] = [
    [-hw, -hd + 14, -hw + 14, hd - 12, 46],
    [hw - 14, -hd + 14, hw, hd - 12, 40],
  ];
  for (const [x0, z0, x1, z1, h] of towers) {
    f.facadeBox(x0, z0, x1, z1, Y, Y + h, '#c9c4bb', '#8a9098');
    ctx.box((x0 + x1) / 2, Y + h / 2, (z0 + z1) / 2, (x1 - x0) / 2, h / 2, (z1 - z0) / 2);
    const inner = x0 < 0 ? x1 + 0.12 : x0 - 0.12;
    const ry = x0 < 0 ? Math.PI / 2 : -Math.PI / 2;
    const len = z1 - z0;
    for (let j = 0; j < 3; j++) {
      const z = z0 + len * (j + 0.5) / 3;
      screen(ctx, inner, Y + 9 + (j % 2) * 10, z, len / 3 - 1.2, 7.5, ry, seed++);
      screen(ctx, inner, Y + 26 + ((j + 1) % 2) * 6, z, len / 3 - 1.2, 9, ry, seed++);
    }
  }
  // TKTS red steps
  const g = ctx.b('glow');
  for (let s = 0; s < 8; s++) {
    p.block(0, Y + s * 0.42, 6 - s * 0.85, 12, 0.42, 1.2 + s * 0.0, '#b5232c');
    g.block(0, Y + s * 0.42 + 0.4, 6 - s * 0.85 + 0.62, 12, 0.03, 0.04, '#ff3b4d');
  }
  ctx.box(0, Y + 1.6, 3, 6, 1.6, 4);
  statue(ctx.b('metal'), 0, Y, 13, 1.4, '#5d7b6a');
  ctx.box(0, Y + 1.5, 13, 0.8, 1.5, 0.8);
  // crowd-friendly street furniture
  for (let k = -2; k <= 2; k++) {
    p.block(k * 4, Y, hd - 2, 1.2, 0.6, 1.2, '#7d756b');
    p.sphere(k * 4, Y + 1.0, hd - 2, 0.6, '#5c9a4e', 0);
  }
}

// ---------------------------------------------------------------------------------------------- Empire State
function empireState(ctx: LandmarkContext) {
  const f = ctx.b('facade:stone');
  const l = ctx.b('lit');
  const g = ctx.b('glow');
  const c = '#ddd3c0';
  const tiers: [number, number, number][] = [
    [40, 0, 22], [32, 22, 60], [25, 60, 150], [18, 150, 168], [12, 168, 178],
  ];
  f.ao = { y0: Y, h: 12, min: 0.75 };
  for (const [w, y0, y1] of tiers) {
    const h = w / 2;
    f.facadeBox(-h, -h, h, h, Y + y0, Y + y1, c, '#bdb4a3', 0, y0 / (3.3 * 8));
    l.block(0, Y + y1, 0, w + 0.6, 0.6, w + 0.6, '#c8bea9');
  }
  f.ao = null;
  // art-deco vertical piers on the shaft
  for (let k = -3; k <= 3; k++) {
    for (const s of [-1, 1]) {
      l.block(k * 3.4, Y + 60, s * 12.7, 0.6, 90, 0.4, '#e9e2d4');
      l.block(s * 12.7, Y + 60, k * 3.4, 0.4, 90, 0.6, '#e9e2d4');
    }
  }
  l.cyl(0, Y + 178, 0, 4.5, 10, '#c9c4bb', 12, 3.5);
  l.cyl(0, Y + 188, 0, 3.0, 8, '#b9c0c8', 12, 1.4);
  l.cyl(0, Y + 196, 0, 0.5, 24, '#d5d9de', 6, 0.12);
  // tower lights
  for (const [w, y] of [[18.4, 160], [12.4, 172], [9.5, 182]] as const) {
    for (const s of [-1, 1]) {
      g.block(0, Y + y, (s * w) / 2, w * 0.9, 1.4, 0.1, y > 175 ? '#ff4060' : '#f8f4e6');
      g.block((s * w) / 2, Y + y, 0, 0.1, 1.4, w * 0.9, y > 175 ? '#4f7dff' : '#f8f4e6');
    }
  }
  g.sphere(0, Y + 220, 0, 0.5, '#ff3030', 0);
  ctx.box(0, Y + 11, 0, 20, 11, 20);
  // entrance canopy
  l.block(0, Y, 20.6, 8, 5, 1.2, '#2a2d33');
  ctx.b('shop').block(0, Y, 20.1, 6, 3.6, 0.1, '#ffd59a');
}

// ---------------------------------------------------------------------------------------------- Flatiron
function flatiron(ctx: LandmarkContext) {
  const f = ctx.b('facade:stone');
  const hw = ctx.hw - 5, hd = ctx.hd - 5;
  // wedge pointing north (-z)
  const pts: [number, number][] = [
    [-2.2, -hd], [2.2, -hd], [hw, hd - 2], [hw - 3, hd], [-hw + 3, hd], [-hw, hd - 2],
  ];
  f.ao = { y0: Y, h: 8, min: 0.72 };
  f.facadePrism(pts, Y, Y + 62, '#e8d9c2', '#8e8a84');
  f.ao = null;
  const l = ctx.b('lit');
  // cornice + crown
  const crown = pts.map(([x, z]) => [x * 1.02, z * 1.02] as [number, number]);
  l.facadePrism(crown, Y + 62, Y + 63.4, '#d9c8ab', '#7a7670');
  l.facadePrism(pts.map(([x, z]) => [x * 0.96, z * 0.96] as [number, number]), Y + 63.4, Y + 66, '#cbbb9f', '#6f6b65');
  // ground floor shops
  ctx.b('shop').facadePrism(pts.map(([x, z]) => [x * 1.005, z * 1.005] as [number, number]), Y, Y + 4.2, '#6a7c8c', '#555');
  // collider: approximate with three boxes along the wedge
  ctx.box(0, Y + 30, hd * 0.55, hw * 0.95, 30, hd * 0.42);
  ctx.box(0, Y + 30, 0, hw * 0.5, 30, hd * 0.25);
  ctx.box(0, Y + 30, -hd * 0.6, hw * 0.18, 30, hd * 0.35);
}

// ---------------------------------------------------------------------------------------------- Central Park
function centralPark(ctx: LandmarkContext) {
  const hw = ctx.hw - 5, hd = ctx.hd - 5;
  const p = ctx.b('plain');
  const pave = ctx.b('paving');
  const w = ctx.b('water');
  const path = '#e2d8c2';
  // paths: perimeter loop and a cross
  pave.stripXZ(0, -hd + 8, 1, 0, hw * 2 - 10, 3.4, Y + 0.02, path, 3);
  pave.stripXZ(0, hd - 8, 1, 0, hw * 2 - 10, 3.4, Y + 0.02, path, 3);
  pave.stripXZ(-hw + 8, 0, 0, 1, hd * 2 - 10, 3.4, Y + 0.02, path, 3);
  pave.stripXZ(hw - 8, 0, 0, 1, hd * 2 - 10, 3.4, Y + 0.02, path, 3);
  pave.stripXZ(0, 0, 0, 1, hd * 2 - 10, 4, Y + 0.025, path, 3);
  // The Lake (south-west) and the Reservoir (north)
  const lakes: [number, number, number, number][] = [[-38, 26, 34, 22], [-52, 40, 18, 14], [30, -40, 30, 24]];
  for (const [x, z, a, b] of lakes) {
    p.cyl(x, Y - 0.05, z, 1, 0.35, '#c9bfa8', 20);
    p.push(x, 0, z, 0, 0, 0, a, 1, b);
    p.cyl(0, Y - 0.05, 0, 1.06, 0.33, '#bfb49c', 20);
    p.pop();
    w.push(x, 0, z, 0, 0, 0, a, 1, b);
    w.cyl(0, Y + 0.05, 0, 1, 0.26, '#4f8fa6', 20);
    w.pop();
    ctx.box(x, Y + 0.6, z, a * 0.75, 0.8, b * 0.75);
  }
  // Bow bridge
  p.arch(-38, Y - 1.2, 26, 7, 0.6, 3, '#e8e2d4', 10, Math.PI / 2, 0.5, Math.PI - 0.5);
  // Bethesda fountain + terrace
  pave.rectXZ(-14, -6, 14, 6, Y + 0.03, '#d8c9a8', 3);
  p.cyl(0, Y, 0, 5, 0.8, '#cbbf9f', 16);
  w.cyl(0, Y + 0.2, 0, 4.3, 0.65, '#5aa0b8', 16);
  p.cyl(0, Y, 0, 0.8, 3.2, '#cbbf9f', 8);
  statue(ctx.b('metal'), 0, Y + 3.2, 0, 1.0, '#7aa58c');
  ctx.cyl(0, Y + 1, 0, 5, 1);
  // Wollman rink
  p.slab(18, 30, 46, 48, Y, Y + 0.3, '#eef6ff', '#bfc8d2');
  for (let k = 0; k < 6; k++) p.block(20 + k * 5, Y + 0.3, 39 + Math.sin(k) * 4, 0.4, 1.6, 0.4, ['#e85d4a', '#3f7be0', '#f2c14e'][k % 3]);
  ctx.box(32, Y + 0.3, 39, 14, 0.4, 9);
  // granite outcrops
  for (const [x, z, r] of [[50, 10, 4], [-60, -30, 5], [-20, -60, 3.5], [60, 58, 3]] as const) {
    p.sphere(x, Y, z, r, '#8e8f95', 0, r * 0.55);
    ctx.cyl(x, Y + 1, z, r * 0.8, 1.2);
  }
  // trees
  const r = ctx.rng;
  let placed = 0;
  for (let i = 0; i < 400 && placed < 90; i++) {
    const x = r.range(-hw + 4, hw - 4), z = r.range(-hd + 4, hd - 4);
    if (Math.abs(x) < 4 || Math.abs(Math.abs(z) - (hd - 8)) < 3 || Math.abs(Math.abs(x) - (hw - 8)) < 3) continue;
    if (lakes.some(([lx, lz, a, b]) => ((x - lx) / (a + 4)) ** 2 + ((z - lz) / (b + 4)) ** 2 < 1)) continue;
    if (Math.abs(x) < 16 && Math.abs(z) < 9) continue;
    if (x > 16 && x < 48 && z > 28 && z < 50) continue;
    ctx.tree(x, z, r.range(0.9, 1.4), r.chance(0.2) ? 'conifer' : 'round', Y);
    placed++;
  }
  for (let k = -3; k <= 3; k++) flowerBed(p, k * 9, Y, -14, 6, 3, ['#e85b7a', '#f2c94c', '#9a5bd6'][(k + 3) % 3]);
}

// ---------------------------------------------------------------------------------------------- Brooklyn Bridge
function brooklynBridge(ctx: LandmarkContext) {
  const L = ctx.layout;
  const hw = L.halfX(4);
  const row = 7;
  const z0 = L.lineZ(row) + L.halfZ(row), z1 = L.lineZ(row + 1) - L.halfZ(row + 1);
  const half = (z1 - z0) / 2;
  const b = ctx.b('lit');
  const stone = '#c9a985';
  const towersZ = [-half * 0.42, half * 0.42];
  const H = 42;
  for (const tz of towersZ) {
    for (const s of [-1, 1]) {
      const x = s * (hw + 3.2);
      b.block(x, -3, tz, 5, H + 3, 7, stone);
      b.block(x, H, tz, 5.6, 1.2, 7.6, '#b8956f');
      ctx.box(x, H / 2, tz, 2.5, H / 2 + 2, 3.5);
    }
    // gothic arches over the road
    b.block(0, H - 12, tz, hw * 2 + 1.4, 12, 7, stone);
    b.block(0, H - 22, tz, hw * 2 + 1.4, 1.2, 7, '#b8956f');
    // pointed arch openings (dark insets)
    for (const s of [-1, 1]) {
      b.block(s * (hw + 3.2), H - 20, tz + 3.55, 2.4, 14, 0.1, '#5c4a3a');
      b.block(s * (hw + 3.2), H - 20, tz - 3.55, 2.4, 14, 0.1, '#5c4a3a');
    }
  }
  // main cables (catenary) + suspenders
  const c = ctx.b('plain');
  const cableY = (z: number) => {
    const [ta, tb] = towersZ;
    if (z < ta) return H - (ta - z) * ((H - 2) / (ta - -half)) * 0.9;
    if (z > tb) return H - (z - tb) * ((H - 2) / (half - tb)) * 0.9;
    const t = (z - ta) / (tb - ta);
    return 6 + (H - 6) * (4 * (t - 0.5) ** 2);
  };
  for (const s of [-1, 1]) {
    const x = s * (hw + 3.2);
    let pz = -half - 6, py = 2;
    for (let z = -half - 6 + 4; z <= half + 6; z += 4) {
      const y = Math.max(1.2, cableY(z));
      c.beam(x, py, pz, x, y, z, 0.35, '#e9e4da');
      if (z > -half && z < half && y > 2) c.beam(x, y, z, x, 1.2, z, 0.06, '#d9d4ca');
      pz = z;
      py = y;
    }
    // diagonal stays
    for (const tz of towersZ) for (let k = 1; k <= 4; k++) for (const d of [-1, 1]) c.beam(x, H - 2, tz, x, 1.2, tz + d * k * 6, 0.07, '#d9d4ca');
  }
  // lamp posts
  for (let z = -half + 4; z < half; z += 12) {
    ctx.lamp(-hw - 0.6, z);
    ctx.lamp(hw + 0.6, z);
  }
}

// ---------------------------------------------------------------------------------------------- Statue of Liberty
function liberty(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const copper = '#6fb9a2';
  // island + star fort
  b.cyl(0, -4, 0, 16, 4.6, '#7d8c6a', 10);
  b.cyl(0, 0.6, 0, 12, 0.2, '#86a86a', 10);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2;
    b.frustum(Math.cos(a) * 5, 0.6, Math.sin(a) * 5, 5, 5, 4.4, 4.4, 2.4, '#c8b89a', -a);
  }
  b.cyl(0, 0.6, 0, 6, 2.4, '#c8b89a', 11);
  // pedestal
  b.frustum(0, 3, 0, 9, 9, 7, 7, 12, '#d6c8ab');
  b.block(0, 15, 0, 7.6, 1.2, 7.6, '#c9bb9d');
  b.frustum(0, 16.2, 0, 6.4, 6.4, 5.2, 5.2, 4, '#d6c8ab');
  // statue
  b.cyl(0, 20.2, 0, 2.5, 9, copper, 10, 1.6);
  b.cyl(0, 29.2, 0, 1.6, 4, copper, 10, 1.3);
  b.sphere(0, 34.4, 0, 1.25, copper, 1);
  for (let k = 0; k < 7; k++) {
    const a = -Math.PI / 2 + (k - 3) * 0.32;
    b.beam(0, 35, 0, Math.cos(a) * 2.6, 35.6 + Math.abs(k - 3) * -0.2, Math.sin(a) * 2.6 + 0.4, 0.22, copper);
  }
  b.beam(1.2, 31.5, 0, 1.6, 39, 0.4, 0.6, copper);
  b.cyl(1.6, 39, 0.4, 0.5, 1, '#c9a24a', 8, 0.7);
  ctx.b('glow').cone(1.6, 40, 0.4, 0.55, 1.6, '#ffc94d', 6);
  b.block(-1.6, 28, 0.6, 1.0, 2.2, 0.4, copper);
}

export const NEW_YORK: CityDefinition = {
  id: 'newyork',
  name: 'New York',
  country: 'United States',
  flag: '🇺🇸',
  tagline: 'The City That Never Sleeps',
  description: 'Glass canyons, yellow cabs, Times Square’s glowing screens and the bridge to Brooklyn.',
  theme: { sky: ['#9fd0ff', '#3c6fc2'], accent: '#ffc21a', ground: '#cfcac2' },
  grid: { cols: 7, rows: 9, block: 56, road: 16 },
  wideX: { 3: 20 },
  bridges: [1, 4],
  areas: [
    { type: 'water', c0: 0, r0: 7, c1: 6 },
    { type: 'landmark', c0: 2, r0: 0, c1: 4, r1: 2, ground: 'grass', landmark: 'centralpark' },
    { type: 'landmark', c0: 3, r0: 4, ground: 'paved', landmark: 'times' },
    { type: 'landmark', c0: 4, r0: 5, ground: 'paved', landmark: 'empire' },
    { type: 'landmark', c0: 1, r0: 5, ground: 'paved', landmark: 'flatiron' },
    { type: 'park', c0: 0, r0: 3, trees: 1.2 },
    { type: 'park', c0: 5, r0: 8, pond: true },
  ],
  style: {
    facades: [['brick', 5], ['modern', 3], ['stone', 2]],
    wallColors: ['#c98a6a', '#b8775c', '#d9a27e', '#a86a52', '#e2d6c2', '#cfc4b2', '#d8b48f', '#9c6a55'],
    roofColors: ['#6b6b70', '#5d5f66', '#77787d'],
    trimColor: '#d8d2c6',
    floors: [5, 12],
    towerChance: 0.22,
    towerFloors: [18, 44],
    glassTowerChance: 0.5,
    roof: 'flat',
    lotWidth: [12, 22],
    shopChance: 0.55,
    awningColors: ['#1f4f8a', '#2f2f35', '#8a1f2a', '#1f6b4a'],
    shopColors: ['#2a2d33', '#3c3c44', '#5a2a2a', '#1f3d4f'],
    neonChance: 0.07,
    waterTanks: true,
  },
  palette: {
    asphalt: '#4f535b', sidewalk: '#d2cdc5', curb: '#b3ada3', grass: '#86b863', plaza: '#cbbfae',
    marking: '#f4f4f4', centerLine: '#f2c230', outerGround: '#c8c2b8', hills: '#9fb0c4', water: '#3f7d9a',
  },
  treeKind: 'round',
  lampStyle: 'modern',
  streetProps: ['hydrant', 'planter', 'bike'],
  driveSide: 'right',
  traffic: {
    colors: ['#f4f4f0', '#2b2f36', '#9aa3ad', '#1f3f7a', '#8a1f2a', '#3a5a40', '#c0c4ca'],
    taxi: { color: '#f6c21a', share: 0.35 },
    buses: '#2f6fd6',
  },
  spawn: { node: [3, 6], dir: 'N' },
  startHour: 18.2,
  waterName: 'East River',
  landmarks: [
    {
      id: 'times', name: 'Times Square', icon: '📺', xp: 250, anchor: { area: true }, radius: 50,
      description: 'The “Crossroads of the World” is lit by so many screens that the New Year’s Eve ball has dropped here since 1907.',
      build: timesSquare,
    },
    {
      id: 'empire', name: 'Empire State Building', icon: '🏙️', xp: 300, anchor: { area: true }, radius: 55,
      description: 'Built in just 410 days during the Great Depression, it was the world’s tallest building for nearly 40 years.',
      build: empireState,
    },
    {
      id: 'centralpark', name: 'Central Park', icon: '🌳', xp: 250, anchor: { area: true }, radius: 110,
      description: 'An 843-acre green heart designed in 1858. Almost everything in it, from lakes to hills, was landscaped by hand.',
      build: centralPark,
    },
    {
      id: 'brooklyn', name: 'Brooklyn Bridge', icon: '🌉', xp: 250, anchor: { grid: [4, 7.5] }, radius: 50,
      description: 'Opened in 1883 as the world’s longest suspension bridge, its Gothic granite towers still guard the East River.',
      build: brooklynBridge,
    },
    {
      id: 'flatiron', name: 'Flatiron Building', icon: '📐', xp: 150, anchor: { area: true }, radius: 45,
      description: 'Its triangular plot made it look like a clothes iron. Locals bet it would topple in the wind. It never did.',
      build: flatiron,
    },
    {
      id: 'liberty', name: 'Statue of Liberty', icon: '🗽', xp: 200, anchor: { grid: [5.5, 7.5] }, radius: 75,
      description: 'A gift from France in 1886, Lady Liberty’s copper skin is thinner than two pennies and turned green within 30 years.',
      build: liberty,
    },
  ],
};
