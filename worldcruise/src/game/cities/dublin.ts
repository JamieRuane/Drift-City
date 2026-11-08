import type { CityDefinition } from './types';
import type { LandmarkContext } from '../world/LandmarkContext';
import { CURB_H } from '../world/CityLayout';
import { colonnade, pediment, sign, statue } from './landmarks/common';

const Y = CURB_H;
const PORTLAND = '#e6ddcc';

// ---------------------------------------------------------------------------------------------- The Spire / O'Connell St
function spire(ctx: LandmarkContext) {
  const L = ctx.layout;
  const P = L.pitch;
  const segs: [number, number][] = [
    [-0.5 * P + L.halfZ(0) + 3, 0.5 * P - L.halfZ(1) - 3],
    [0.5 * P + L.halfZ(1) + 3, 1.5 * P - L.halfZ(2) - 3],
  ];
  const p = ctx.b('paving');
  const b = ctx.b('lit');
  for (const [z0, z1] of segs) {
    p.slab(-1.6, z0, 1.6, z1, 0, CURB_H + 0.04, '#cfccc4', '#a29e95', 3);
    ctx.box(0, 0.1, (z0 + z1) / 2, 1.6, 0.4, (z1 - z0) / 2);
    for (let z = z0 + 6; z < z1 - 4; z += 12) {
      if (Math.abs(z) < 6) continue;
      ctx.tree(0, z, 0.8, 'round', Y + 0.04);
    }
    for (let z = z0 + 12; z < z1 - 4; z += 24) ctx.lamp(0, z);
  }
  // the Spire of Light
  const m = ctx.b('metal');
  m.cyl(0, Y, 0, 1.5, 100, '#dfe5ea', 10, 0.06);
  b.cyl(0, Y, 0, 2.2, 0.6, '#8a8f96', 10);
  ctx.b('glow').cyl(0, Y + 88, 0, 0.32, 12, '#e8f4ff', 8, 0.06);
  ctx.cyl(0, Y + 3, 0, 1.6, 3);
  // Daniel O'Connell monument at the bridge end
  const oz = 1.5 * P - L.halfZ(2) - 10;
  b.cyl(0, Y, oz, 2.6, 2, '#bfb8aa', 10);
  b.cyl(0, Y + 2, oz, 2.0, 5, '#cfc8b8', 10);
  b.cyl(0, Y + 7, oz, 1.4, 2.2, '#cfc8b8', 10);
  statue(b, 0, Y + 9.2, oz, 1.6, '#4c5a4e');
  ctx.cyl(0, Y + 3, oz, 2.6, 3);
}

// ---------------------------------------------------------------------------------------------- GPO
function gpo(ctx: LandmarkContext) {
  const f = ctx.b('facade:stone');
  const b = ctx.b('lit');
  const hw = Math.min(ctx.hw - 5, 26), hd = ctx.hd - 5;
  const z1 = hd, z0 = hd - 24;
  f.ao = { y0: Y, h: 8, min: 0.75 };
  f.facadeBox(-hw, z0, hw, z1, Y, Y + 17, PORTLAND, '#8a8d93');
  f.ao = null;
  b.block(0, Y + 17, (z0 + z1) / 2, hw * 2 + 0.6, 1.2, z1 - z0 + 0.6, '#d7cdb9');
  // portico
  b.block(0, Y, z1 + 3.4, 22, 1, 7, '#d7cdb9');
  colonnade(b, -9.5, 9.5, z1 + 5.6, Y + 1, 14, 6, 0.75, PORTLAND);
  b.block(0, Y + 15, z1 + 3.4, 22, 1.6, 7, PORTLAND);
  pediment(b, 0, Y + 16.6, z1 + 3.4, 22, 7, 3.6, PORTLAND);
  for (const x of [-8, 0, 8]) statue(b, x, x === 0 ? Y + 20.2 : Y + 16.6, z1 + 4, 1.3, '#cfc8b8');
  // tricolour
  b.cyl(0, Y + 18.2, (z0 + z1) / 2, 0.12, 9, '#ddd', 6);
  const fl = ctx.b('plain');
  fl.block(1.0, Y + 25.2, (z0 + z1) / 2, 1.0, 1.8, 0.06, '#169b62');
  fl.block(2.0, Y + 25.2, (z0 + z1) / 2, 1.0, 1.8, 0.06, '#f5f5f5');
  fl.block(3.0, Y + 25.2, (z0 + z1) / 2, 1.0, 1.8, 0.06, '#ff883e');
  ctx.box(0, Y + 8.5, (z0 + z1) / 2 + 3, hw, 8.5, (z1 - z0) / 2 + 5);
  sign(ctx, 'GENERAL POST OFFICE', 0, Y + 13.4, z1 + 6.95, 14, 1.1, '#e6ddcc', '#3b3a36');
}

// ---------------------------------------------------------------------------------------------- Custom House
function customHouse(ctx: LandmarkContext) {
  const f = ctx.b('facade:stone');
  const b = ctx.b('lit');
  const hw = ctx.hw - 6, hd = ctx.hd - 5;
  const z0 = -hd + 10, z1 = hd - 4;
  f.ao = { y0: Y, h: 8, min: 0.75 };
  f.facadeBox(-hw, z0, hw, z1, Y, Y + 15, PORTLAND, '#7a7d84');
  f.ao = null;
  b.block(0, Y + 15, (z0 + z1) / 2, hw * 2 + 0.6, 1, z1 - z0 + 0.6, '#d7cdb9');
  // end pavilions
  for (const s of [-1, 1]) {
    b.block(s * (hw - 8), Y, z1 + 1.2, 16, 16.5, 2.4, '#ece4d6');
    colonnade(b, s * (hw - 8) - 5, s * (hw - 8) + 5, z1 + 2.8, Y, 13, 4, 0.55, PORTLAND);
  }
  // central portico, drum and green copper dome
  b.block(0, Y, z1 + 2, 22, 1.2, 5, '#d7cdb9');
  colonnade(b, -9, 9, z1 + 3.8, Y + 1.2, 13.5, 4, 0.7, PORTLAND);
  b.block(0, Y + 14.7, z1 + 2, 22, 1.4, 5, PORTLAND);
  pediment(b, 0, Y + 16.1, z1 + 2, 22, 5, 3.4, PORTLAND);
  const dz = (z0 + z1) / 2;
  b.block(0, Y + 16, dz, 14, 3, 14, PORTLAND);
  colonnade(b, -5.5, 5.5, dz + 6.4, Y + 19, 6, 5, 0.4, PORTLAND);
  b.cyl(0, Y + 19, dz, 6, 6, '#e1d8c6', 16);
  b.lathe(0, Y + 25, dz, [[6.4, 0], [6.0, 2.4], [4.8, 4.6], [2.6, 6.2], [0.8, 7], [0.05, 7.3]], '#5fa58a', 18);
  b.cyl(0, Y + 32.3, dz, 0.8, 2, '#5fa58a', 8);
  statue(b, 0, Y + 34.3, dz, 1.5, '#5fa58a');
  ctx.box(0, Y + 8, (z0 + z1) / 2 + 2, hw, 8, (z1 - z0) / 2 + 2);
  for (let x = -hw + 4; x <= hw - 4; x += 10) ctx.tree(x, -hd + 4, 0.9, 'round', Y);
}

// ---------------------------------------------------------------------------------------------- Ha'penny Bridge
function hapenny(ctx: LandmarkContext) {
  const L = ctx.layout;
  const row = 2;
  const z0 = L.lineZ(row) + L.halfZ(row), z1 = L.lineZ(row + 1) - L.halfZ(row + 1);
  const half = (z1 - z0) / 2 + 0.6;
  const b = ctx.b('lit');
  const white = '#f4f4f2';
  const rise = 3.6;
  const y = (z: number) => 0.9 + rise * (1 - (z / half) ** 2);
  const N = 24;
  const W = 1.8;
  for (let i = 0; i < N; i++) {
    const za = -half + (i / N) * half * 2, zb = -half + ((i + 1) / N) * half * 2;
    const ya = y(za), yb = y(zb);
    b.beam(0, ya - 0.25, za, 0, yb - 0.25, zb, 0.3, white);
    // deck
    b.quad(-W, ya, za, W, ya, za, W, yb, zb, -W, yb, zb, '#cfc9be');
    b.quad(-W, yb - 0.08, zb, W, yb - 0.08, zb, W, ya - 0.08, za, -W, ya - 0.08, za, '#e8e8e4');
    for (const s of [-1, 1]) {
      b.beam(s * W, ya - 0.5, za, s * W, yb - 0.5, zb, 0.22, white);
      b.beam(s * W, ya + 1.1, za, s * W, yb + 1.1, zb, 0.14, white);
      b.beam(s * W, ya - 0.5, za, s * W, yb + 1.1, zb, 0.06, white);
      b.beam(s * W, ya + 1.1, za, s * W, yb - 0.5, zb, 0.06, white);
    }
  }
  // three lamp arches
  const g = ctx.b('glow');
  for (const z of [-half * 0.55, 0, half * 0.55]) {
    const yy = y(z);
    b.arch(0, yy + 1.1, z, W, 0.12, 0.12, white, 8, Math.PI / 2);
    g.sphere(0, yy + 1.1 + W + 0.25, z, 0.35, '#fff1c4', 0);
  }
}

// ---------------------------------------------------------------------------------------------- Temple Bar
function templeBar(ctx: LandmarkContext) {
  const f = ctx.b('facade:georgian');
  const p = ctx.b('plain');
  const hw = ctx.hw - 4.5, hd = ctx.hd - 4.5;
  const D = 12;
  const colors = ['#c8282e', '#1f6b4a', '#1f4f8a', '#f2b31a', '#7a2a6a', '#e86f2a', '#2a8a8a', '#3a3a40'];
  let ci = 0;
  const pub = (x0: number, z0: number, x1: number, z1: number, face: 'N' | 'S' | 'E' | 'W', name?: string) => {
    const col = name ? '#c8282e' : colors[ci++ % colors.length];
    const h = 11 + (ci % 3) * 2.5;
    f.ao = { y0: Y, h: 6, min: 0.75 };
    f.facadeBox(x0, z0, x1, z1, Y, Y + h, col, '#4c5058', ctx.rng(), 0);
    f.ao = null;
    p.block((x0 + x1) / 2, Y + h, (z0 + z1) / 2, x1 - x0 + 0.3, 0.6, z1 - z0 + 0.3, '#e8e2d4');
    ctx.box((x0 + x1) / 2, Y + h / 2, (z0 + z1) / 2, (x1 - x0) / 2, h / 2, (z1 - z0) / 2);
    // ground floor pub front with gold lettering band and flower baskets
    const fz = face === 'N' ? z0 - 0.15 : face === 'S' ? z1 + 0.15 : 0;
    const fx = face === 'W' ? x0 - 0.15 : face === 'E' ? x1 + 0.15 : 0;
    const along = face === 'N' || face === 'S';
    const len = along ? x1 - x0 : z1 - z0;
    const cxp = along ? (x0 + x1) / 2 : fx, czp = along ? fz : (z0 + z1) / 2;
    p.block(cxp, Y, czp, along ? len - 0.4 : 0.3, 4, along ? 0.3 : len - 0.4, '#1d1f22');
    ctx.b('shop').block(cxp, Y + 0.6, czp + (face === 'S' ? 0.1 : face === 'N' ? -0.1 : 0), along ? len - 2 : 0.1, 2.4, along ? 0.1 : len - 2, '#ffcf8a');
    ctx.b('glow').block(cxp, Y + 3.4, czp + (face === 'S' ? 0.18 : face === 'N' ? -0.18 : 0), along ? len - 1.2 : 0.06, 0.4, along ? 0.06 : len - 1.2, '#f2c14e');
    for (let k = -1; k <= 1; k += 2) {
      const bx = along ? cxp + k * (len / 2 - 1.2) : cxp + (face === 'E' ? 0.7 : -0.7);
      const bz = along ? czp + (face === 'S' ? 0.7 : -0.7) : czp + k * (len / 2 - 1.2);
      p.sphere(bx, Y + 4.6, bz, 0.55, '#3f8a3a', 0);
      p.sphere(bx, Y + 4.8, bz, 0.35, '#ff6fa5', 0);
    }
    if (name) {
      const ry = face === 'S' ? 0 : face === 'N' ? Math.PI : face === 'E' ? Math.PI / 2 : -Math.PI / 2;
      sign(ctx, name, cxp + (face === 'E' ? 0.3 : face === 'W' ? -0.3 : 0), Y + 5.6, czp + (face === 'S' ? 0.3 : face === 'N' ? -0.3 : 0), len - 1.5, 1.2, '#8a1218', '#ffe08a', ry);
    }
  };
  // perimeter terraces facing the surrounding streets
  const lots = (a: number, b: number) => {
    const out: [number, number][] = [];
    let x = a;
    while (x < b - 1) {
      const w = Math.min(b - x, 8 + ctx.rng() * 4);
      out.push([x, x + w]);
      x += w;
    }
    return out;
  };
  const north = lots(-hw, hw);
  north.forEach(([a, c], i) => pub(a, -hd, c, -hd + D, 'N', i === north.length - 1 ? 'THE TEMPLE BAR' : undefined));
  lots(-hw, hw).forEach(([a, c]) => pub(a, hd - D, c, hd, 'S'));
  lots(-hd + D, hd - D).forEach(([a, c]) => pub(-hw, a, -hw + D, c, 'W'));
  lots(-hd + D, hd - D).forEach(([a, c]) => pub(hw - D, a, hw, c, 'E'));
  // Meeting House Square
  for (const [x, z] of [[-6, -4], [6, -4], [0, 6]]) {
    p.cyl(x, Y, z, 0.08, 3, '#333', 5);
    p.cone(x, Y + 2.4, z, 2.6, 0.9, '#e8e4dc', 8);
    p.cyl(x, Y, z, 0.6, 0.75, '#5a3a2a', 8);
  }
  statue(ctx.b('metal'), 0, Y, -2, 1.1, '#5d6b5a');
}

export const DUBLIN: CityDefinition = {
  id: 'dublin',
  name: 'Dublin',
  country: 'Ireland',
  flag: '🇮🇪',
  tagline: 'Céad Míle Fáilte',
  description: 'Georgian terraces with bright front doors, the Liffey’s bridges and a 120-metre steel Spire.',
  theme: { sky: ['#bfe8d4', '#5c9ab8'], accent: '#2fb36b', ground: '#c8c5bd' },
  grid: { cols: 7, rows: 6, block: 56, road: 13 },
  wideX: { 3: 24 },
  bridges: [3, 5],
  areas: [
    { type: 'water', c0: 0, r0: 2, c1: 6 },
    { type: 'landmark', c0: 2, r0: 1, ground: 'paved', landmark: 'gpo' },
    { type: 'landmark', c0: 4, r0: 1, c1: 5, ground: 'grass', landmark: 'customhouse' },
    { type: 'landmark', c0: 2, r0: 3, ground: 'cobble', landmark: 'templebar' },
    { type: 'park', c0: 4, r0: 4, pond: true, trees: 1.3 },
    { type: 'park', c0: 6, r0: 4 },
    { type: 'park', c0: 1, r0: 0 },
  ],
  style: {
    facades: [['georgian', 7], ['brick', 2], ['stone', 1]],
    wallColors: ['#a5523d', '#b3604a', '#8f4636', '#c46e52', '#e8dcc4', '#9c5a46', '#b86b52', '#dfd4bf'],
    roofColors: ['#4c5058', '#555a62'],
    trimColor: '#efe9dd',
    floors: [3, 5],
    towerChance: 0.02,
    towerFloors: [12, 20],
    glassTowerChance: 1,
    roof: 'parapet',
    lotWidth: [7, 10],
    shopChance: 0.42,
    awningColors: ['#1f6b4a', '#1f3d6b', '#7d1f2a', '#2a2a30'],
    shopColors: ['#1f6b4a', '#7d1f2a', '#1f2f4f', '#2a2a30', '#c8282e'],
    neonChance: 0.02,
    doorColors: ['#d33a3a', '#2f6fd6', '#2f9a5a', '#f2b93a', '#8a3fd6', '#1f2a44', '#e86fa5'],
  },
  palette: {
    asphalt: '#56595e', sidewalk: '#c8c5bd', curb: '#9f9b92', grass: '#7cbc63', plaza: '#c7bda9',
    marking: '#f4f4ee', centerLine: '#f4f4ee', outerGround: '#c4c0b6', hills: '#7fae84', water: '#46707a',
  },
  treeKind: 'round',
  lampStyle: 'classic',
  streetProps: ['postbox', 'bike', 'postbox'],
  driveSide: 'left',
  traffic: {
    colors: ['#f4f4f0', '#2b2f36', '#9aa3ad', '#1f6b4a', '#7d1f2a', '#1f3f7a', '#c0c4ca'],
    buses: '#f3c623',
  },
  spawn: { node: [3, 4], dir: 'N' },
  startHour: 15,
  waterName: 'Liffey',
  landmarks: [
    {
      id: 'spire', name: 'O’Connell Street & The Spire', icon: '📍', xp: 250, anchor: { grid: [3, 0.5] }, radius: 40,
      description: 'Dublin’s grandest boulevard is pierced by the Spire of Light, a 120-metre stainless-steel needle that glows at its tip after dark.',
      build: spire,
    },
    {
      id: 'gpo', name: 'General Post Office', icon: '🏛️', xp: 200, anchor: { area: true }, radius: 45, rotation: Math.PI / 2,
      description: 'Headquarters of the 1916 Easter Rising. Bullet marks are still visible in the columns of its portico.',
      build: gpo,
    },
    {
      id: 'customhouse', name: 'The Custom House', icon: '🏛️', xp: 200, anchor: { area: true }, radius: 65,
      description: 'James Gandon’s neoclassical masterpiece on the Liffey, crowned by a copper dome that has weathered to green.',
      build: customHouse,
    },
    {
      id: 'hapenny', name: 'Ha’penny Bridge', icon: '🌉', xp: 200, anchor: { grid: [1.5, 2.5] }, radius: 42,
      description: 'This cast-iron footbridge of 1816 earned its name from the halfpenny toll charged to cross the Liffey.',
      build: hapenny,
    },
    {
      id: 'templebar', name: 'Temple Bar', icon: '🍀', xp: 200, anchor: { area: true }, radius: 45,
      description: 'Dublin’s cobbled cultural quarter, famous for live music, street performers and its bright red pub.',
      build: templeBar,
    },
  ],
};
