import { FLOOR, type ChunkedBuilders, type GeometryBuilder } from './GeometryBuilder';
import { SIDEWALK, type Rect } from './CityLayout';
import type { ColliderDesc } from './LandmarkContext';
import type { CityDefinition, Dir } from '../cities/types';
import type { Rng } from '../core/rng';
import { clamp } from '../core/rng';
import type { FacadeStyle } from './textures';

export interface BuildCtx {
  chunks: ChunkedBuilders;
  colliders: ColliderDesc[];
  rng: Rng;
  def: CityDefinition;
  /** 0 = low, 1 = medium, 2 = high */
  detail: number;
  /** Shopfront positions (for café terraces and pedestrians). */
  shops: { x: number; z: number; nx: number; nz: number; len: number }[];
  /** Neon density multiplier per region (Times Square, Shibuya...). */
  neonBoost?: number;
}

export interface Lot extends Rect {
  face: Dir;
  corner?: boolean;
  /** Prevent towers (e.g. low-rise around landmarks). */
  low?: boolean;
  /** Skip collisions (decorative outer ring). */
  decorative?: boolean;
}

const AO = { y0: 0, h: 9, min: 0.62 };

const NEON = ['#ff3d8b', '#22e1ff', '#ffe23d', '#9d5cff', '#ff7a2f', '#3dff9a', '#ff4848', '#ffffff'];

/** Rotation that maps local +Z to the facade's outward normal. */
function faceFrame(l: Lot) {
  switch (l.face) {
    case 'N': return { px: (l.x0 + l.x1) / 2, pz: l.z0, ry: Math.PI, len: l.x1 - l.x0, depth: l.z1 - l.z0, nx: 0, nz: -1 };
    case 'S': return { px: (l.x0 + l.x1) / 2, pz: l.z1, ry: 0, len: l.x1 - l.x0, depth: l.z1 - l.z0, nx: 0, nz: 1 };
    case 'E': return { px: l.x1, pz: (l.z0 + l.z1) / 2, ry: Math.PI / 2, len: l.z1 - l.z0, depth: l.x1 - l.x0, nx: 1, nz: 0 };
    case 'W': return { px: l.x0, pz: (l.z0 + l.z1) / 2, ry: -Math.PI / 2, len: l.z1 - l.z0, depth: l.x1 - l.x0, nx: -1, nz: 0 };
  }
}

export function fillBlock(ctx: BuildCtx, r: Rect, opts: { low?: boolean } = {}) {
  const { rng } = ctx;
  const st = ctx.def.style;
  const ix0 = r.x0 + SIDEWALK, ix1 = r.x1 - SIDEWALK, iz0 = r.z0 + SIDEWALK, iz1 = r.z1 - SIDEWALK;
  const W = ix1 - ix0, D = iz1 - iz0;
  if (W < 8 || D < 8) return;
  const depth = clamp(Math.min(W, D) * 0.42, 9, 17);
  const [minW, maxW] = st.lotWidth;

  const along = (a: number, b: number, cb: (p0: number, p1: number, corner: boolean) => void) => {
    let p = a;
    while (p < b - 0.5) {
      let w = rng.range(minW, maxW);
      if (b - (p + w) < minW * 0.7) w = b - p;
      cb(p, p + w, p === a || p + w >= b - 0.01);
      p += w;
    }
  };

  if (Math.min(W, D) < depth * 2 + 5) {
    // narrow block: two back-to-back rows along the long axis
    if (W >= D) {
      const mid = (iz0 + iz1) / 2;
      along(ix0, ix1, (a, b, c) => building(ctx, { x0: a, x1: b, z0: iz0, z1: mid, face: 'N', corner: c, low: opts.low }));
      along(ix0, ix1, (a, b, c) => building(ctx, { x0: a, x1: b, z0: mid, z1: iz1, face: 'S', corner: c, low: opts.low }));
    } else {
      const mid = (ix0 + ix1) / 2;
      along(iz0, iz1, (a, b, c) => building(ctx, { x0: ix0, x1: mid, z0: a, z1: b, face: 'W', corner: c, low: opts.low }));
      along(iz0, iz1, (a, b, c) => building(ctx, { x0: mid, x1: ix1, z0: a, z1: b, face: 'E', corner: c, low: opts.low }));
    }
    return;
  }

  along(ix0, ix1, (a, b, c) => building(ctx, { x0: a, x1: b, z0: iz0, z1: iz0 + depth, face: 'N', corner: c, low: opts.low }));
  along(ix0, ix1, (a, b, c) => building(ctx, { x0: a, x1: b, z0: iz1 - depth, z1: iz1, face: 'S', corner: c, low: opts.low }));
  along(iz0 + depth, iz1 - depth, (a, b) => building(ctx, { x0: ix0, x1: ix0 + depth, z0: a, z1: b, face: 'W', low: opts.low }));
  along(iz0 + depth, iz1 - depth, (a, b) => building(ctx, { x0: ix1 - depth, x1: ix1, z0: a, z1: b, face: 'E', low: opts.low }));

  // A tall core tower rising from the courtyard gives dense cities their skyline.
  if (!opts.low && st.towerChance > 0 && rng.chance(st.towerChance * 1.6)) {
    const cx = (ix0 + ix1) / 2, cz = (iz0 + iz1) / 2;
    const tw = Math.min(W - depth * 2 + 6, rng.range(16, 26)), td = Math.min(D - depth * 2 + 6, rng.range(16, 26));
    if (tw > 10 && td > 10) {
      tower(ctx, { x0: cx - tw / 2, x1: cx + tw / 2, z0: cz - td / 2, z1: cz + td / 2, face: 'S' }, rng.int(st.towerFloors[0], st.towerFloors[1]));
    }
  }
}

function tower(ctx: BuildCtx, l: Lot, floors: number) {
  const { rng, chunks } = ctx;
  const st = ctx.def.style;
  const glass = rng.chance(st.glassTowerChance);
  const style: FacadeStyle = glass ? 'glass' : rng.chance(0.5) ? 'modern' : rng.weighted(st.facades);
  const cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2;
  const fb = chunks.get(`facade:${style}`, cx, cz);
  const plain = chunks.get('plain', cx, cz);
  const wall = glass ? rng.pick(['#bcd6ea', '#a9c4dc', '#cfe0ea', '#9fb7cf', '#d9e4ec']) : rng.pick(st.wallColors);
  const trim = st.trimColor;
  const h = 4.5 + floors * FLOOR;
  const uo = rng.int(0, 7) / 8, vo = rng.int(0, 7) / 8;
  fb.ao = AO;
  const tiers = floors > 22 ? 3 : 2;
  let x0 = l.x0, x1 = l.x1, z0 = l.z0, z1 = l.z1, y = 0;
  for (let t = 0; t < tiers; t++) {
    const top = t === tiers - 1 ? h : h * (t === 0 ? rng.range(0.45, 0.6) : rng.range(0.75, 0.85));
    fb.facadeBox(x0, z0, x1, z1, y, top, wall, trim, uo, vo + y / (FLOOR * 8));
    if (t < tiers - 1) plain.block((x0 + x1) / 2, top, (z0 + z1) / 2, x1 - x0 + 0.6, 0.6, z1 - z0 + 0.6, trim);
    y = top;
    const inset = Math.min((x1 - x0) * 0.14, (z1 - z0) * 0.14, 3);
    x0 += inset; x1 -= inset; z0 += inset; z1 -= inset;
  }
  fb.ao = null;
  // crown
  const w = x1 - x0, d = z1 - z0;
  if (rng.chance(0.4)) {
    plain.frustum(cx, h, cz, w * 0.7, d * 0.7, w * 0.2, d * 0.2, rng.range(4, 9), trim);
  } else {
    plain.block(cx, h, cz, w * 0.5, 3, d * 0.5, '#9aa3ad');
    if (ctx.detail > 0) plain.cyl(cx, h + 3, cz, 0.15, rng.range(6, 16), '#c8ccd2', 5);
  }
  if (ctx.detail > 0) chunks.get('glow', cx, cz).sphere(cx, h + 0.6, cz, 0.35, '#ff3030', 0);
  ctx.colliders.push({ kind: 'box', x: cx, y: h / 2, z: cz, hx: (l.x1 - l.x0) / 2, hy: h / 2, hz: (l.z1 - l.z0) / 2, ry: 0 });
}

export function building(ctx: BuildCtx, l: Lot) {
  const { rng, chunks, def } = ctx;
  const st = def.style;
  const w = l.x1 - l.x0, d = l.z1 - l.z0;
  if (w < 3 || d < 3) return;
  const cx = (l.x0 + l.x1) / 2, cz = (l.z0 + l.z1) / 2;

  if (!l.low && !l.decorative && st.towerChance > 0 && w * d > 180 && rng.chance(st.towerChance)) {
    tower(ctx, l, rng.int(Math.max(st.floors[1], st.towerFloors[0] - 6), st.towerFloors[0] + 4));
    return;
  }

  const floors = rng.int(st.floors[0], st.floors[1]) - (l.low ? 1 : 0);
  const style = rng.weighted(st.facades);
  const wall = rng.pick(st.wallColors);
  const roofColor = rng.pick(st.roofColors);
  const h = 4.3 + (floors - 1) * FLOOR;
  const fb = chunks.get(`facade:${style}`, cx, cz);
  const plain = chunks.get('plain', cx, cz);
  fb.ao = AO;
  fb.facadeBox(l.x0, l.z0, l.x1, l.z1, 0, h, wall, roofColor, rng.int(0, 7) / 8, rng.int(0, 7) / 8);
  fb.ao = null;
  if (!l.decorative) ctx.colliders.push({ kind: 'box', x: cx, y: h / 2, z: cz, hx: w / 2, hy: h / 2, hz: d / 2, ry: 0 });

  const f = faceFrame(l);
  // decorative buildings beyond the city wall skip fine roof details
  const detail = l.decorative ? 0 : ctx.detail;
  let roof = st.roof;
  if (roof === 'mixed') roof = rng.weighted([['pitched', 3], ['parapet', 2], ['flat', 2]]);

  // roof
  switch (roof) {
    case 'mansard': {
      plain.block(cx, h, cz, w + 0.5, 0.45, d + 0.5, st.trimColor);
      const mh = rng.range(2.8, 3.6);
      const ins = Math.min(2.6, w * 0.25, d * 0.25);
      plain.frustum(cx, h + 0.45, cz, w, d, w - ins * 2, d - ins * 2, mh, roofColor);
      if (detail > 0) {
        // dormers on the street side
        plain.push(f.px, 0, f.pz, f.ry);
        const n = Math.max(1, Math.floor(f.len / 4.2));
        for (let k = 0; k < n; k++) {
          const x = -f.len / 2 + (k + 0.5) * (f.len / n);
          plain.block(x, h + 0.9, -0.9, 1.2, 1.5, 1.1, st.trimColor);
          plain.block(x, h + 1.05, -0.33, 0.7, 1.0, 0.04, '#33415a');
          plain.gable(x, h + 2.4, -0.9, 1.4, 1.3, 0.6, roofColor, Math.PI / 2);
        }
        plain.pop();
        const nc = rng.int(1, 3);
        for (let k = 0; k < nc; k++) {
          const t = (k + 0.5) / nc;
          const px = l.face === 'N' || l.face === 'S' ? l.x0 + w * t : cx;
          const pz = l.face === 'N' || l.face === 'S' ? cz : l.z0 + d * t;
          plain.block(px, h + mh - 0.4, pz, 0.9, 1.6, 2.4, rng.pick(['#c46a4a', '#e2d6c4', '#b55a3f']));
          plain.cyl(px, h + mh + 1.2, pz - 0.6, 0.14, 0.4, '#b25032', 5);
          plain.cyl(px, h + mh + 1.2, pz + 0.6, 0.14, 0.4, '#b25032', 5);
        }
      }
      if (l.corner && st.cornerTurrets && detail > 0 && rng.chance(0.35)) {
        plain.cyl(cx, h + mh + 0.45, cz, Math.min(w, d) * 0.18, 1.2, roofColor, 10);
        plain.lathe(cx, h + mh + 1.6, cz, [[Math.min(w, d) * 0.2, 0], [Math.min(w, d) * 0.17, 1.2], [Math.min(w, d) * 0.09, 2.4], [0.05, 3.4]], '#5f7186', 10);
      }
      break;
    }
    case 'flat': {
      plain.slab(l.x0 - 0.15, l.z0 - 0.15, l.x1 + 0.15, l.z1 + 0.15, h, h + 0.7, st.trimColor, st.trimColor);
      if (detail > 0) {
        const n = rng.int(0, 3);
        for (let k = 0; k < n; k++)
          plain.block(l.x0 + rng.range(2, w - 2), h, l.z0 + rng.range(2, d - 2), rng.range(1.2, 2.6), rng.range(0.8, 1.6), rng.range(1.2, 2.2), '#a8adb4');
        if (st.waterTanks && rng.chance(0.45) && w > 7 && d > 7) waterTank(plain, cx + rng.range(-w / 5, w / 5), h, cz + rng.range(-d / 5, d / 5));
      }
      break;
    }
    case 'pitched': {
      plain.block(cx, h, cz, w + 0.3, 0.3, d + 0.3, st.trimColor);
      const along = l.face === 'N' || l.face === 'S';
      const rh = Math.min(d, w) * rng.range(0.28, 0.4);
      if (along) plain.gable(cx, h + 0.3, cz, w + 0.2, d + 0.6, rh, roofColor, 0, wall);
      else plain.gable(cx, h + 0.3, cz, d + 0.2, w + 0.6, rh, roofColor, Math.PI / 2, wall);
      if (detail > 0) chimneyStack(plain, along ? l.x0 + 0.6 : cx, h + 0.3 + rh * 0.6, along ? cz : l.z0 + 0.6, rh * 0.6 + 1.4);
      break;
    }
    case 'parapet': {
      plain.slab(l.x0, l.z0, l.x1, l.z1, h, h + 1.0, '#55575e', st.trimColor);
      if (detail > 0) {
        chimneyStack(plain, l.face === 'N' || l.face === 'S' ? l.x0 + 0.5 : cx, h + 1, l.face === 'N' || l.face === 'S' ? cz : l.z0 + 0.5, 1.8);
      }
      break;
    }
  }

  // street level
  plain.push(f.px, 0, f.pz, f.ry);
  const isGlassy = style === 'glass';
  const neonP = st.neonChance * (ctx.neonBoost ?? 1);
  if (!l.decorative && !isGlassy && rng.chance(st.shopChance) && f.len > 5) {
    const L = f.len;
    const fascia = rng.pick(st.shopColors);
    plain.block(0, 0, 0.18, L - 0.6, 4.1, 0.36, fascia);
    const shop = chunks.get('shop', cx, cz);
    shop.push(f.px, 0, f.pz, f.ry);
    shop.block(0, 0.35, 0.38, L - 2.0, 2.6, 0.06, rng.pick(['#6d8396', '#7b8d9c', '#5e7488']));
    shop.pop();
    plain.block(0, 3.25, 0.4, L - 1.2, 0.75, 0.12, rng.pick(st.shopColors));
    if (detail > 0) {
      // striped awning
      const a1 = rng.pick(st.awningColors), a2 = '#f6f1e8';
      const stripes = Math.max(4, Math.floor((L - 1.6) / 0.6));
      const sw = (L - 1.6) / stripes;
      for (let s = 0; s < stripes; s++) {
        plain.tiltBox(-L / 2 + 0.8 + sw * (s + 0.5), 3.0, 1.05, sw, 0.07, 1.5, s % 2 ? a2 : a1, -0.38);
      }
    }
    ctx.shops.push({ x: f.px + f.nx * 1.2, z: f.pz + f.nz * 1.2, nx: f.nx, nz: f.nz, len: L });
  } else if (st.doorColors && !l.decorative) {
    const dc = rng.pick(st.doorColors);
    plain.block(0, 0, 0.06, 1.6, 2.9, 0.12, '#f3efe6');
    plain.block(0, 0, 0.1, 1.1, 2.4, 0.12, dc);
    chunks.get('glow', cx, cz).push(f.px, 0, f.pz, f.ry).arch(0, 2.45, 0.16, 0.05, 0.45, 0.05, '#ffe0a0', 6).pop();
    plain.block(0, 0, 0.5, 2.0, 0.25, 1.0, '#d9d4cb');
  }
  plain.pop();

  if (!l.decorative && neonP > 0 && rng.chance(neonP)) {
    const glow = chunks.get('glow', cx, cz);
    glow.push(f.px, 0, f.pz, f.ry);
    const c = rng.pick(NEON);
    const side = rng.chance(0.5) ? -1 : 1;
    const top = Math.min(h - 1, rng.range(9, 16));
    glow.block(side * (f.len / 2 - 0.9), 4.5, 0.75, 0.3, top - 4.5, 1.2, c);
    plain.push(f.px, 0, f.pz, f.ry).block(side * (f.len / 2 - 0.9), 4.3, 0.75, 0.5, top - 4.1, 1.4, '#20222a').pop();
    if (rng.chance(0.6)) {
      const y = rng.range(5, Math.max(6, h - 3));
      glow.block(0, y, 0.12, f.len * rng.range(0.4, 0.8), 1.1, 0.12, rng.pick(NEON));
    }
    glow.pop();
  }
}

function waterTank(b: GeometryBuilder, x: number, y: number, z: number) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.beam(x + dx * 1.1, y, z + dz * 1.1, x + dx * 1.1, y + 2.2, z + dz * 1.1, 0.18, '#4a3b30');
  b.cyl(x, y + 2.2, z, 1.6, 2.8, '#8a6446', 10);
  b.cone(x, y + 5.0, z, 1.75, 1.1, '#5d4637', 10);
}

function chimneyStack(b: GeometryBuilder, x: number, y: number, z: number, h: number) {
  b.block(x, y - 1, z, 0.9, h + 1, 2.2, '#9a5844');
  for (let k = -1; k <= 1; k++) b.cyl(x, y + h, z + k * 0.6, 0.15, 0.45, '#c9703f', 5);
}

/** Decorative buildings outside the playable boundary (no colliders, no street details). */
export function outerRow(ctx: BuildCtx, x0: number, z0: number, x1: number, z1: number, face: Dir, heightMul = 1) {
  const st = ctx.def.style;
  const alongX = face === 'N' || face === 'S';
  const a0 = alongX ? x0 : z0, a1 = alongX ? x1 : z1;
  let p = a0;
  while (p < a1 - 1) {
    const w = Math.min(a1 - p, ctx.rng.range(st.lotWidth[0] * 1.2, st.lotWidth[1] * 1.6));
    const lot: Lot = alongX
      ? { x0: p, x1: p + w, z0, z1, face, decorative: true }
      : { x0, x1, z0: p, z1: p + w, face, decorative: true };
    const saved = st.floors;
    if (heightMul !== 1) (st as { floors: [number, number] }).floors = [Math.round(saved[0] * heightMul), Math.round(saved[1] * heightMul)];
    building(ctx, lot);
    (st as { floors: [number, number] }).floors = saved;
    p += w;
  }
}
