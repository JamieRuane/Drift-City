import * as THREE from 'three';
import { ChunkedBuilders, GeometryBuilder } from './GeometryBuilder';
import { CityLayout, CURB_H, SIDEWALK, type Rect, type Region } from './CityLayout';
import { LandmarkContext, type Animated, type ColliderDesc, type TreeInstance } from './LandmarkContext';
import type { Materials } from './Materials';
import { fillBlock, outerRow, type BuildCtx } from './Buildings';
import { bench, buildLightPools, buildTrees, lamp, streetProp, type LampInfo } from './Props';
import { buildCarMerged } from '../vehicle/carModels';
import type { CityDefinition, LandmarkDef } from '../cities/types';
import { createRng, type Rng } from '../core/rng';

export interface PlacedLandmark {
  def: LandmarkDef;
  x: number;
  z: number;
}

export interface ParkedCar {
  x: number;
  z: number;
  ry: number;
  color: string;
}

export interface BuiltCity {
  def: CityDefinition;
  layout: CityLayout;
  group: THREE.Group;
  colliders: ColliderDesc[];
  lamps: LampInfo[];
  animated: Animated[];
  landmarks: PlacedLandmark[];
  pedRects: Rect[];
  shops: BuildCtx['shops'];
  tokens: { x: number; z: number; y: number }[];
  spawn: { x: number; z: number; heading: number };
  stats: { triangles: number; meshes: number; colliders: number };
  dispose(): void;
}

const HORIZON = 1800;
const WATER_Y = -3.0;
const DECK_BOTTOM = -0.9;

export function buildCity(def: CityDefinition, mats: Materials, detail: number): BuiltCity {
  const layout = new CityLayout(def);
  const rng = createRng(def.id);
  const chunks = new ChunkedBuilders(160);
  const colliders: ColliderDesc[] = [];
  const trees: TreeInstance[] = [];
  const lampSpots: { x: number; z: number; nx: number; nz: number }[] = [];
  /** Lamp positions requested by landmark builders. */
  const lampsFromLc: { x: number; z: number }[] = [];
  const lamps: LampInfo[] = [];
  const animated: Animated[] = [];
  const landmarks: PlacedLandmark[] = [];
  const pedRects: Rect[] = [];
  const parked: ParkedCar[] = [];
  const group = new THREE.Group();
  group.name = `city-${def.id}`;
  const pal = def.palette;
  const ctx: BuildCtx = { chunks, colliders, rng, def, detail, shops: [] };

  const ground = {
    asphalt: new GeometryBuilder(),
    paving: new GeometryBuilder(),
    grass: new GeometryBuilder(),
    cobble: new GeometryBuilder(),
    water: new GeometryBuilder(),
    marking: new GeometryBuilder(),
    plain: new GeometryBuilder(),
  };

  // ---------------------------------------------------------------- ground + water
  const waterRows = layout.waterRows().sort((a, b) => a.z0 - b.z0);
  const bands: [number, number][] = [];
  let zc = -HORIZON;
  for (const w of waterRows) {
    bands.push([zc, w.z0]);
    zc = w.z1;
  }
  bands.push([zc, HORIZON]);
  const W = layout.wall;
  for (const [za, zb] of bands) {
    const iz0 = Math.max(za, W.z0), iz1 = Math.min(zb, W.z1);
    if (iz1 > iz0) {
      ground.asphalt.rectXZ(W.x0, iz0, W.x1, iz1, 0, pal.asphalt, 7);
      ground.paving.rectXZ(-HORIZON, iz0, W.x0, iz1, 0, pal.outerGround, 4);
      ground.paving.rectXZ(W.x1, iz0, HORIZON, iz1, 0, pal.outerGround, 4);
    }
    if (za < W.z0) ground.paving.rectXZ(-HORIZON, za, HORIZON, Math.min(zb, W.z0), 0, pal.outerGround, 4);
    if (zb > W.z1) ground.paving.rectXZ(-HORIZON, Math.max(za, W.z1), HORIZON, zb, 0, pal.outerGround, 4);
  }
  for (const w of waterRows) {
    ground.water.rectXZ(-HORIZON, w.z0, HORIZON, w.z1, WATER_Y, pal.water);
    // embankment walls
    ground.plain.quad(-HORIZON, WATER_Y - 1, w.z0, HORIZON, WATER_Y - 1, w.z0, HORIZON, 0, w.z0, -HORIZON, 0, w.z0, '#b9ad98');
    ground.plain.quad(HORIZON, WATER_Y - 1, w.z1, -HORIZON, WATER_Y - 1, w.z1, -HORIZON, 0, w.z1, HORIZON, 0, w.z1, '#b9ad98');
    // river bed
    ground.plain.rectXZ(-HORIZON, w.z0, HORIZON, w.z1, WATER_Y - 1.5, '#3d5a5c');
    // balustrades outside the city
    for (const z of [w.z0, w.z1]) {
      const inward = z === w.z0 ? -1 : 1;
      for (const [x0, x1] of [[-HORIZON, W.x0], [W.x1, HORIZON]] as const) {
        ground.plain.block((x0 + x1) / 2, 0, z + inward * 0.3, x1 - x0, 0.9, 0.5, '#d3c8b3');
      }
    }
  }
  for (const run of layout.water) {
    const r = run.rect;
    // quay balustrades along the city banks
    for (const z of [r.z0, r.z1]) {
      const inward = z === r.z0 ? -1 : 1;
      chunks.get('plain', (r.x0 + r.x1) / 2, z).block((r.x0 + r.x1) / 2, 0, z + inward * 0.3, r.x1 - r.x0, 0.95, 0.5, '#d8cdb8');
      if (detail > 0) {
        for (let x = r.x0 + 1; x < r.x1; x += 2.4) chunks.get('plain', x, z).block(x, 0.95, z + inward * 0.3, 0.6, 0.12, 0.62, '#e6dcc8');
      }
    }
    colliders.push({ kind: 'box', x: (r.x0 + r.x1) / 2, y: 0.2, z: r.z0 - 0.3, hx: (r.x1 - r.x0) / 2 + 0.5, hy: 1.2, hz: 0.5, ry: 0 });
    colliders.push({ kind: 'box', x: (r.x0 + r.x1) / 2, y: 0.2, z: r.z1 + 0.3, hx: (r.x1 - r.x0) / 2 + 0.5, hy: 1.2, hz: 0.5, ry: 0 });
    colliders.push({ kind: 'box', x: r.x0 + 0.3, y: 0.2, z: (r.z0 + r.z1) / 2, hx: 0.5, hy: 1.2, hz: (r.z1 - r.z0) / 2, ry: 0 });
    colliders.push({ kind: 'box', x: r.x1 - 0.3, y: 0.2, z: (r.z0 + r.z1) / 2, hx: 0.5, hy: 1.2, hz: (r.z1 - r.z0) / 2, ry: 0 });
  }

  // ---------------------------------------------------------------- bridges & embankment roads in water rows
  for (const e of layout.edges) {
    if (e.dz === 0) continue;
    const a = layout.nodes[e.a], b = layout.nodes[e.b];
    const z0 = Math.min(a.z, b.z) + (a.z < b.z ? a.hz : b.hz), z1 = Math.max(a.z, b.z) - (a.z < b.z ? b.hz : a.hz);
    const j = Math.min(a.j, b.j);
    const i = a.i;
    const inWater = layout.isWater(i - 1, j) || layout.isWater(i, j);
    if (!inWater) continue;
    const hw = e.width / 2, x = a.x;
    if (e.bridge) {
      buildBridge(chunks, ground.asphalt, x, z0, z1, hw, pal, def, detail, lampSpots);
    } else {
      // solid embankment road next to an island
      ground.asphalt.rectXZ(x - hw, z0, x + hw, z1, 0, pal.asphalt, 7);
      const side = layout.isWater(i - 1, j) ? -1 : 1;
      const wx = x + side * hw;
      ground.plain.quad(wx, WATER_Y - 1, side > 0 ? z0 : z1, wx, WATER_Y - 1, side > 0 ? z1 : z0, wx, 0, side > 0 ? z1 : z0, wx, 0, side > 0 ? z0 : z1, '#b9ad98');
      chunks.get('plain', wx, (z0 + z1) / 2).block(wx - side * 0.3, 0, (z0 + z1) / 2, 0.5, 0.95, z1 - z0, '#d8cdb8');
    }
  }

  // ---------------------------------------------------------------- regions
  const landmarkById = new Map(def.landmarks.map((l) => [l.id, l]));
  for (const reg of layout.regions) {
    const r = reg.rect;
    const inWaterRow = waterRows.some((w) => r.z0 >= w.z0 - 1 && r.z1 <= w.z1 + 1);
    const y0 = inWaterRow ? WATER_Y - 1 : -0.6;
    if (reg.kind === 'plaza') {
      ground.cobble.rectXZ(r.x0, r.z0, r.x1, r.z1, 0.03, pal.plaza, 5);
    } else {
      const b = chunks.get('paving', (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
      b.slab(r.x0, r.z0, r.x1, r.z1, y0, CURB_H, pal.sidewalk, pal.curb, 3);
      colliders.push({ kind: 'box', x: (r.x0 + r.x1) / 2, y: (CURB_H + y0) / 2, z: (r.z0 + r.z1) / 2, hx: (r.x1 - r.x0) / 2, hy: (CURB_H - y0) / 2, hz: (r.z1 - r.z0) / 2, ry: 0 });
      pedRects.push({ x0: r.x0 + 3.2, z0: r.z0 + 3.2, x1: r.x1 - 3.2, z1: r.z1 - 3.2 });
      sidewalkProps(reg);
    }
    if (reg.kind === 'block') fillBlock(ctx, r, {});
    else if (reg.kind === 'park') buildPark(reg);
    else if (reg.kind === 'landmark' && reg.area?.ground) {
      const inner = { x0: r.x0 + SIDEWALK, z0: r.z0 + SIDEWALK, x1: r.x1 - SIDEWALK, z1: r.z1 - SIDEWALK };
      if (reg.area.ground === 'grass') chunks.get('grass', inner.x0, inner.z0).rectXZ(inner.x0, inner.z0, inner.x1, inner.z1, CURB_H + 0.01, pal.grass, 6);
      else if (reg.area.ground === 'cobble') chunks.get('cobble', inner.x0, inner.z0).rectXZ(inner.x0, inner.z0, inner.x1, inner.z1, CURB_H + 0.01, pal.plaza, 5);
    }
    if (reg.area?.landmark) {
      const ld = landmarkById.get(reg.area.landmark);
      if (ld) placeLandmark(ld, (r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, r);
    }
  }

  // anchored (non-area) landmarks
  for (const ld of def.landmarks) {
    if (landmarks.some((l) => l.def.id === ld.id)) continue;
    let x = 0, z = 0;
    if (ld.anchor.node) {
      const n = layout.node(ld.anchor.node[0], ld.anchor.node[1]);
      x = n ? n.x : layout.lineX(ld.anchor.node[0]);
      z = n ? n.z : layout.lineZ(ld.anchor.node[1]);
    } else if (ld.anchor.grid) {
      const p = layout.gridToWorld(ld.anchor.grid[0], ld.anchor.grid[1]);
      x = p.x;
      z = p.z;
    }
    placeLandmark(ld, x, z, { x0: x - ld.radius, z0: z - ld.radius, x1: x + ld.radius, z1: z + ld.radius });
  }

  function placeLandmark(ld: LandmarkDef, x: number, z: number, r: Rect) {
    const rot = ld.rotation ?? 0;
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    const w = (r.x1 - r.x0) / 2, d = (r.z1 - r.z0) / 2;
    const lc = new LandmarkContext(
      x, z, rot, swap ? d : w, swap ? w : d, r, layout, def, mats, createRng(ld.id),
      (m) => chunks.get(m, x, z), colliders, trees, group, animated, lampsFromLc,
    );
    ld.build(lc);
    lc.finish();
    landmarks.push({ def: ld, x, z });
  }


  // ---------------------------------------------------------------- road markings
  const mk = ground.marking;
  const white = pal.marking;
  for (const e of layout.edges) {
    const a = layout.nodes[e.a], b = layout.nodes[e.b];
    const horizontal = e.dz === 0;
    const startOff = horizontal ? a.hx : a.hz, endOff = horizontal ? b.hx : b.hz;
    const len = e.length - startOff - endOff;
    if (len <= 2) continue;
    const sx = a.x + e.dx * startOff, sz = a.z + e.dz * startOff;
    const px = -e.dz, pz = e.dx;
    const hw = e.width / 2;
    // centre line
    if (pal.centerLine !== white) {
      for (const o of [-0.18, 0.18]) mk.stripXZ(sx + e.dx * len / 2 + px * o, sz + e.dz * len / 2 + pz * o, e.dx, e.dz, len - 8, 0.14, 0.025, pal.centerLine);
    } else {
      for (let t = 5; t < len - 5; t += 7) mk.stripXZ(sx + e.dx * (t + 1.5), sz + e.dz * (t + 1.5), e.dx, e.dz, 3, 0.16, 0.025, white);
    }
    // lane dividers on wide roads
    if (e.width >= 19) {
      for (const o of [-hw / 2, hw / 2])
        for (let t = 6; t < len - 6; t += 9) mk.stripXZ(sx + e.dx * (t + 1.5) + px * o, sz + e.dz * (t + 1.5) + pz * o, e.dx, e.dz, 3, 0.14, 0.025, white);
    }
    // edge lines
    for (const o of [-(hw - 0.5), hw - 0.5]) mk.stripXZ(sx + e.dx * len / 2 + px * o, sz + e.dz * len / 2 + pz * o, e.dx, e.dz, len, 0.12, 0.022, '#d8d8d0');
    // zebra crossings + stop lines at both ends
    for (const end of [0, 1]) {
      const n = end === 0 ? a : b;
      if (n.edges.length < 3 || e.bridge) continue;
      const dir = end === 0 ? 1 : -1;
      const base = end === 0 ? 0 : len;
      const cxp = sx + e.dx * (base + dir * 2.6), czp = sz + e.dz * (base + dir * 2.6);
      for (let o = -hw + 0.9; o <= hw - 0.9; o += 1.1) mk.stripXZ(cxp + px * o, czp + pz * o, e.dx, e.dz, 3.2, 0.55, 0.026, white);
      // stop line on the incoming lane (traffic arriving at this node)
      const side = def.driveSide === 'right' ? 1 : -1;
      const incomingSide = end === 1 ? side : -side;
      const stopT = base + dir * 5.0;
      mk.stripXZ(sx + e.dx * stopT + px * (incomingSide * hw / 2), sz + e.dz * stopT + pz * (incomingSide * hw / 2), -e.dz, e.dx, hw - 0.6, 0.45, 0.026, white);
    }
  }

  // ---------------------------------------------------------------- city boundary
  {
    const bz0 = layout.bounds.z0 - layout.halfZ(0), bz1 = layout.bounds.z1 + layout.halfZ(layout.rows);
    const bx0 = layout.bounds.x0 - layout.halfX(0), bx1 = layout.bounds.x1 + layout.halfX(layout.cols);
    const inWater = (z0: number, z1: number) => waterRows.some((w) => z1 > w.z0 && z0 < w.z1);
    const pav = ground.paving;
    pav.slab(W.x0, W.z0, W.x1, bz0, -0.6, CURB_H, pal.sidewalk, pal.curb, 3);
    pav.slab(W.x0, bz1, W.x1, W.z1, -0.6, CURB_H, pal.sidewalk, pal.curb, 3);
    // east/west strips split around rivers
    const zs = [bz0, ...waterRows.flatMap((w) => [w.z0, w.z1]), bz1];
    for (let k = 0; k < zs.length - 1; k += 2) {
      const za = zs[k], zb = zs[k + 1];
      if (zb - za < 1 || inWater(za, zb)) continue;
      pav.slab(W.x0, za, bx0, zb, -0.6, CURB_H, pal.sidewalk, pal.curb, 3);
      pav.slab(bx1, za, W.x1, zb, -0.6, CURB_H, pal.sidewalk, pal.curb, 3);
    }
    const wallC = '#a99f8f';
    const hedge = '#4f8a4a';
    const T = 0.8;
    const plain = ground.plain;
    plain.block((W.x0 + W.x1) / 2, 0, W.z0 - T / 2, W.x1 - W.x0 + T * 2, 1.0, T, wallC);
    plain.block((W.x0 + W.x1) / 2, 0, W.z1 + T / 2, W.x1 - W.x0 + T * 2, 1.0, T, wallC);
    plain.block(W.x0 - T / 2, 0, (W.z0 + W.z1) / 2, T, 1.0, W.z1 - W.z0, wallC);
    plain.block(W.x1 + T / 2, 0, (W.z0 + W.z1) / 2, T, 1.0, W.z1 - W.z0, wallC);
    plain.block((W.x0 + W.x1) / 2, 1.0, W.z0 - T / 2, W.x1 - W.x0 + T * 2, 0.7, T * 0.9, hedge);
    plain.block((W.x0 + W.x1) / 2, 1.0, W.z1 + T / 2, W.x1 - W.x0 + T * 2, 0.7, T * 0.9, hedge);
    plain.block(W.x0 - T / 2, 1.0, (W.z0 + W.z1) / 2, T * 0.9, 0.7, W.z1 - W.z0, hedge);
    plain.block(W.x1 + T / 2, 1.0, (W.z0 + W.z1) / 2, T * 0.9, 0.7, W.z1 - W.z0, hedge);
    const H = 6;
    colliders.push({ kind: 'box', x: (W.x0 + W.x1) / 2, y: H / 2, z: W.z0 - 1, hx: (W.x1 - W.x0) / 2 + 3, hy: H, hz: 1, ry: 0 });
    colliders.push({ kind: 'box', x: (W.x0 + W.x1) / 2, y: H / 2, z: W.z1 + 1, hx: (W.x1 - W.x0) / 2 + 3, hy: H, hz: 1, ry: 0 });
    colliders.push({ kind: 'box', x: W.x0 - 1, y: H / 2, z: (W.z0 + W.z1) / 2, hx: 1, hy: H, hz: (W.z1 - W.z0) / 2 + 3, ry: 0 });
    colliders.push({ kind: 'box', x: W.x1 + 1, y: H / 2, z: (W.z0 + W.z1) / 2, hx: 1, hy: H, hz: (W.z1 - W.z0) / 2 + 3, ry: 0 });

    // decorative districts beyond the wall
    const g = 4;
    const rows: [number, number, number][] = [[g, 16, 1], [g + 26, 18, 1.35]];
    if (detail === 0) rows.pop();
    for (const [off, dep, mul] of rows) {
      outerRow(ctx, W.x0 - off - dep - 30, W.z0 - off - dep, W.x1 + off + dep + 30, W.z0 - off, 'S', mul);
      outerRow(ctx, W.x0 - off - dep - 30, W.z1 + off, W.x1 + off + dep + 30, W.z1 + off + dep, 'N', mul);
      for (let k = 0; k < zs.length - 1; k += 2) {
        let za = zs[k], zb = zs[k + 1];
        if (k === 0) za = W.z0;
        if (k + 2 >= zs.length - 1) zb = W.z1;
        if (zb - za < 6 || inWater(za + 1, zb - 1)) continue;
        outerRow(ctx, W.x0 - off - dep, za, W.x0 - off, zb, 'E', mul);
        outerRow(ctx, W.x1 + off, za, W.x1 + off + dep, zb, 'W', mul);
      }
    }
    // trees along the inside of the wall
    for (let x = W.x0 + 8; x < W.x1 - 8; x += 16) {
      trees.push({ x, z: W.z0 + 1.5, y: CURB_H, s: 0.9, kind: def.treeKind });
      trees.push({ x, z: W.z1 - 1.5, y: CURB_H, s: 0.9, kind: def.treeKind });
    }

    // distant horizon
    const far = new GeometryBuilder();
    const frng = createRng(def.id + 'far');
    const tall = def.style.towerChance > 0.1;
    for (let k = 0; k < 120; k++) {
      const a = (k / 120) * Math.PI * 2 + frng() * 0.04;
      const rad = frng.range(780, 1200);
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      if (waterRows.some((w) => z > w.z0 - 30 && z < w.z1 + 30)) continue;
      if (tall && frng.chance(0.7)) far.block(x, 0, z, frng.range(25, 50), frng.range(40, tall ? 190 : 60), frng.range(25, 50), frng.pick(['#9fb0c4', '#aab8c8', '#8fa1b8']), a);
      else far.cone(x, -5, z, frng.range(140, 260), frng.range(50, 120), pal.hills, 7);
    }
    const farMesh = new THREE.Mesh(far.build(), mats.plain);
    farMesh.name = 'horizon';
    group.add(farMesh);
  }

  // ---------------------------------------------------------------- park + sidewalk helpers
  function sidewalkProps(reg: Region) {
    const r = reg.rect;
    const sides = [
      { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z0, nx: 0, nz: -1 },
      { x0: r.x0, z0: r.z1, x1: r.x1, z1: r.z1, nx: 0, nz: 1 },
      { x0: r.x0, z0: r.z0, x1: r.x0, z1: r.z1, nx: -1, nz: 0 },
      { x0: r.x1, z0: r.z0, x1: r.x1, z1: r.z1, nx: 1, nz: 0 },
    ];
    const treeGap = def.treeKind === 'plane' ? 11 : def.treeKind === 'cherry' ? 15 : 14;
    for (const s of sides) {
      const len = Math.hypot(s.x1 - s.x0, s.z1 - s.z0);
      const ux = (s.x1 - s.x0) / len, uz = (s.z1 - s.z0) / len;
      const at = (t: number, inset: number) => ({ x: s.x0 + ux * t - s.nx * inset, z: s.z0 + uz * t - s.nz * inset });
      // is the road beside this side a quay / boundary? (no parking there)
      const roadMid = { x: s.x0 + ux * len / 2 + s.nx * 4, z: s.z0 + uz * len / 2 + s.nz * 4 };
      const near = layout.nearestRoadPoint(roadMid.x, roadMid.z);
      const roadW = near.edge.width;
      const treeChance = reg.kind === 'block' ? (def.id === 'tokyo' ? 0.45 : 0.85) : 0.9;
      for (let t = 7; t < len - 6; t += treeGap) {
        if (!rng.chance(treeChance)) continue;
        const p = at(t, 1.5);
        trees.push({ x: p.x, z: p.z, y: CURB_H, s: rng.range(0.85, 1.1), kind: def.treeKind });
        colliders.push({ kind: 'cyl', x: p.x, y: 2, z: p.z, r: 0.3, hh: 2 });
      }
      for (let t = 12; t < len - 8; t += 26) {
        const p = at(t, 0.55);
        lampSpots.push({ x: p.x, z: p.z, nx: s.nx, nz: s.nz });
      }
      if (def.streetProps.length && reg.kind === 'block') {
        for (let t = 18; t < len - 10; t += 21) {
          if (!rng.chance(0.35)) continue;
          const kind = rng.pick(def.streetProps);
          if (kind === 'cafe') continue;
          const p = at(t + 3, kind === 'hydrant' ? 0.7 : 2.4);
          streetProp(kind, chunks, def.id, p.x, p.z, s.nx, s.nz, colliders, rng);
        }
      }
      // parked cars along the kerb
      if (roadW >= 12 && !near.edge.bridge) {
        for (let t = 11; t < len - 11; t += 6.4) {
          if (!rng.chance(0.28)) continue;
          const p = at(t, -1.25);
          const ry = Math.atan2(ux, uz) + (rng.chance(0.5) ? Math.PI : 0);
          parked.push({ x: p.x, z: p.z, ry, color: rng.pick(def.traffic.colors) });
          colliders.push({ kind: 'box', x: p.x, y: 0.8, z: p.z, hx: 0.92, hy: 0.7, hz: 2.2, ry });
        }
      }
    }
  }

  function buildPark(reg: Region) {
    const r = reg.rect;
    const inner = { x0: r.x0 + SIDEWALK, z0: r.z0 + SIDEWALK, x1: r.x1 - SIDEWALK, z1: r.z1 - SIDEWALK };
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const grass = chunks.get('grass', cx, cz);
    const pave = chunks.get('paving', cx, cz);
    const plain = chunks.get('plain', cx, cz);
    const y = CURB_H + 0.01;
    grass.rectXZ(inner.x0, inner.z0, inner.x1, inner.z1, y, pal.grass, 6);
    const w = inner.x1 - inner.x0, d = inner.z1 - inner.z0;
    // paths
    const pathC = '#e5dccb';
    pave.stripXZ(cx, cz, 1, 0, w, 3.2, y + 0.015, pathC, 3);
    pave.stripXZ(cx, cz, 0, 1, d, 3.2, y + 0.015, pathC, 3);
    const diag = Math.hypot(w, d);
    pave.stripXZ(cx, cz, w / diag, d / diag, diag, 2.4, y + 0.012, pathC, 3);
    pave.stripXZ(cx, cz, w / diag, -d / diag, diag, 2.4, y + 0.012, pathC, 3);
    const pond = reg.area?.pond;
    const pr = Math.min(w, d) * (pond ? 0.28 : 0.09);
    if (pond) {
      const pw = w * 0.42, pd = d * 0.3;
      plain.slab(cx - pw / 2 - 1, cz - pd / 2 - 1, cx + pw / 2 + 1, cz + pd / 2 + 1, CURB_H, CURB_H + 0.25, '#cfc6b3', '#bfb5a0');
      const wtr = chunks.get('water', cx, cz);
      wtr.rectXZ(cx - pw / 2, cz - pd / 2, cx + pw / 2, cz + pd / 2, CURB_H + 0.28, pal.water);
      colliders.push({ kind: 'box', x: cx, y: 0.6, z: cz, hx: pw / 2 + 1, hy: 0.6, hz: pd / 2 + 1, ry: 0 });
      if (detail > 0) {
        plain.block(cx + pw * 0.3, CURB_H + 0.28, cz, 1.6, 0.4, 0.8, '#f2f2f2');
        plain.block(cx + pw * 0.3, CURB_H + 0.68, cz, 0.5, 0.6, 0.5, '#f2f2f2');
      }
    } else {
      // fountain
      plain.cyl(cx, CURB_H, cz, pr + 1, 0.6, '#d9d1c0', 16);
      chunks.get('water', cx, cz).cyl(cx, CURB_H + 0.05, cz, pr + 0.6, 0.6, pal.water, 16);
      plain.cyl(cx, CURB_H, cz, 0.6, 2.2, '#d9d1c0', 8);
      plain.cyl(cx, CURB_H + 2.2, cz, 1.4, 0.3, '#d9d1c0', 10);
      chunks.get('glow', cx, cz).cone(cx, CURB_H + 2.5, cz, 0.6, 1.6, '#cfefff', 6);
      colliders.push({ kind: 'cyl', x: cx, y: 1, z: cz, r: pr + 1, hh: 1 });
    }
    // trees
    const n = Math.floor(((w * d) / 180) * (reg.area?.trees ?? 1));
    const placed: { x: number; z: number }[] = [];
    for (let k = 0; k < n * 3 && placed.length < n; k++) {
      const x = inner.x0 + 3 + rng() * (w - 6), z = inner.z0 + 3 + rng() * (d - 6);
      const onPath = Math.abs(x - cx) < 3.5 || Math.abs(z - cz) < 3.5 ||
        Math.abs((x - cx) * d - (z - cz) * w) / diag < 3 || Math.abs((x - cx) * d + (z - cz) * w) / diag < 3;
      if (onPath) continue;
      if (pond && Math.abs(x - cx) < w * 0.24 && Math.abs(z - cz) < d * 0.18) continue;
      if (!pond && Math.hypot(x - cx, z - cz) < pr + 4) continue;
      if (placed.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < 30)) continue;
      placed.push({ x, z });
      const kind = rng.chance(0.25) ? 'conifer' : def.treeKind === 'cherry' ? (rng.chance(0.6) ? 'cherry' : 'round') : def.treeKind === 'plane' ? 'round' : def.treeKind;
      trees.push({ x, z, y: CURB_H, s: rng.range(0.9, 1.35), kind });
      colliders.push({ kind: 'cyl', x, y: 2, z, r: 0.35, hh: 2 });
    }
    // benches along the paths
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      bench(plain, cx + k * (w / 6), cz + 2.6, Math.PI);
      bench(plain, cx - 2.6, cz + k * (d / 6), Math.PI / 2);
    }
  }

  // ---------------------------------------------------------------- lamps (sidewalks, bridges, landmarks)
  for (const s of lampSpots) lamps.push(lamp(chunks, def.lampStyle, s.x, s.z, s.nx, s.nz, colliders));
  for (const p of lampsFromLc) lamps.push(lamp(chunks, 'classic', p.x, p.z, 0, 1, colliders));

  // ---------------------------------------------------------------- meshes
  const meshes: THREE.Mesh[] = [];
  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow: boolean, recv = true) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = shadow;
    mesh.receiveShadow = recv;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  for (const e of chunks.entries()) {
    if (e.b.isEmpty()) continue;
    const m = e.key === 'water' ? mats.water : mats.get(e.key);
    const shadow = e.key !== 'glow' && e.key !== 'water' && e.key !== 'grass' && e.key !== 'paving';
    addMesh(e.b.build(), m, shadow, e.key !== 'glow');
  }
  if (!ground.asphalt.isEmpty()) addMesh(ground.asphalt.build(), mats.asphalt, false);
  if (!ground.paving.isEmpty()) addMesh(ground.paving.build(), mats.paving, false);
  if (!ground.cobble.isEmpty()) addMesh(ground.cobble.build(), mats.cobble, false);
  if (!ground.marking.isEmpty()) addMesh(ground.marking.build(), mats.marking, false);
  if (!ground.plain.isEmpty()) addMesh(ground.plain.build(), mats.plain, true);
  if (!ground.water.isEmpty()) addMesh(ground.water.build(), mats.water, false);

  const treeMeshes = buildTrees(trees, mats, rng);
  for (const t of treeMeshes) group.add(t);
  const pools = buildLightPools(lamps, mats);
  group.add(pools);

  // parked cars (instanced, three body types)
  const kinds = ['sedan', 'hatch', 'van'] as const;
  const instMats: THREE.InstancedMesh[] = [];
  kinds.forEach((k, ki) => {
    const list = parked.filter((_, idx) => idx % 3 === ki);
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(buildCarMerged(k), mats.metal, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    list.forEach((p, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
      m.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.set(p.color));
    });
    mesh.castShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    instMats.push(mesh);
  });

  // ---------------------------------------------------------------- collectibles + spawn
  const trng = createRng(def.id + 'tokens');
  const tokens: BuiltCity['tokens'] = [];
  const edges = layout.edges.filter((e) => e.length > 40);
  const used = new Set<number>();
  for (let k = 0; k < 400 && tokens.length < 20; k++) {
    const e = trng.pick(edges);
    if (used.has(e.id)) continue;
    used.add(e.id);
    const a = layout.nodes[e.a];
    const t = trng.range(0.3, 0.7) * e.length;
    tokens.push({ x: a.x + e.dx * t, z: a.z + e.dz * t, y: 1.4 });
  }
  for (const reg of layout.regions) {
    if (tokens.length >= 25) break;
    if (reg.kind === 'plaza' || reg.kind === 'park') {
      const r = reg.rect;
      tokens.push({ x: (r.x0 + r.x1) / 2 + (reg.kind === 'park' ? (r.x1 - r.x0) * 0.3 : 0), z: (r.z0 + r.z1) / 2 + (reg.kind === 'park' ? 0 : (r.z1 - r.z0) * 0.35), y: 1.6 });
    }
  }
  while (tokens.length < 25) {
    const e = trng.pick(layout.edges);
    const a = layout.nodes[e.a];
    const t = trng.range(0.2, 0.8) * e.length;
    tokens.push({ x: a.x + e.dx * t, z: a.z + e.dz * t, y: 1.4 });
  }

  const sn = layout.node(def.spawn.node[0], def.spawn.node[1]) ?? layout.nodes[0];
  const heading = CityLayout.heading(def.spawn.dir);
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const lane = (def.grid.road / 4) * (def.driveSide === 'right' ? 1 : -1);
  // right of travel direction (fx, fz) is (-fz, fx)
  const spawn = { x: sn.x + fx * 14 + -fz * lane, z: sn.z + fz * 14 + fx * lane, heading };

  let triangles = 0;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const n = m.geometry.attributes.position.count / 3;
      triangles += (m as THREE.InstancedMesh).isInstancedMesh ? n * (m as THREE.InstancedMesh).count : n;
    }
  });

  return {
    def, layout, group, colliders, lamps, animated, landmarks, pedRects, shops: ctx.shops, tokens, spawn,
    stats: { triangles: Math.round(triangles), meshes: meshes.length + treeMeshes.length + instMats.length + 1, colliders: colliders.length },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          // shared cached geometries (trees, cars) are kept for the next city
          if (!(m as THREE.InstancedMesh).isInstancedMesh) m.geometry.dispose();
        }
      });
      group.removeFromParent();
    },
  };
}

function buildBridge(
  chunks: ChunkedBuilders, asphalt: GeometryBuilder, x: number, z0: number, z1: number, hw: number,
  pal: CityDefinition['palette'], def: CityDefinition, detail: number, lampSpots: { x: number; z: number; nx: number; nz: number }[],
) {
  const cz = (z0 + z1) / 2;
  const b = chunks.get('plain', x, cz);
  const stone = '#d2c6ae', stoneDark = '#b8ab92';
  asphalt.rectXZ(x - hw, z0, x + hw, z1, 0, pal.asphalt, 7);
  // deck edges
  b.block(x - hw - 0.6, DECK_BOTTOM, cz, 1.2, -DECK_BOTTOM + 0.2, z1 - z0, stone);
  b.block(x + hw + 0.6, DECK_BOTTOM, cz, 1.2, -DECK_BOTTOM + 0.2, z1 - z0, stone);
  b.rectXZ(x - hw - 1.2, z0, x + hw + 1.2, z1, DECK_BOTTOM, stoneDark);
  // parapets
  for (const s of [-1, 1]) {
    b.block(x + s * (hw + 0.6), 0.2, cz, 0.7, 0.9, z1 - z0, '#e2d8c4');
    if (detail > 0) for (let z = z0 + 2; z < z1 - 1; z += 3) b.block(x + s * (hw + 0.6), 1.1, z, 0.85, 0.16, 0.9, '#efe7d6');
  }
  // arches seen from the river (in the z–y plane)
  const span = z1 - z0;
  const n = span > 60 ? 3 : 2;
  const pier = 3.2;
  const archW = (span - pier * (n - 1)) / n;
  const r = archW * 0.62;
  for (const s of [-1, 1]) {
    const fx = x + s * (hw + 1.2);
    for (let k = 0; k < n; k++) {
      const a0 = z0 + k * (archW + pier), a1 = a0 + archW;
      const ac = (a0 + a1) / 2;
      const cy = DECK_BOTTOM - 0.7 - r;
      // spandrel wall with arched opening: quads from the intrados to the deck
      const segs = 12;
      const half = archW / 2;
      const aStart = Math.acos(Math.min(1, half / r));
      let prevZ = ac - half, prevY = cy + Math.sin(aStart) * r;
      for (let i = 1; i <= segs; i++) {
        const ang = Math.PI - aStart - ((Math.PI - 2 * aStart) * i) / segs;
        const zz = ac + Math.cos(ang) * r, yy = cy + Math.sin(ang) * r;
        if (s > 0) b.quad(fx, DECK_BOTTOM, prevZ, fx, DECK_BOTTOM, zz, fx, yy, zz, fx, prevY, prevZ, stone);
        else b.quad(fx, prevY, prevZ, fx, yy, zz, fx, DECK_BOTTOM, zz, fx, DECK_BOTTOM, prevZ, stone);
        // intrados (underside)
        b.quad(x - hw - 1.2, prevY, prevZ, x + hw + 1.2, prevY, prevZ, x + hw + 1.2, yy, zz, x - hw - 1.2, yy, zz, stoneDark);
        prevZ = zz;
        prevY = yy;
      }
      // pier below each arch spring
      if (k < n - 1) {
        const pz = a1 + pier / 2;
        b.block(x, WATER_Y - 1, pz, hw * 2 + 2.6, -WATER_Y + 1 + DECK_BOTTOM, pier, stone);
        b.frustum(x, WATER_Y - 0.5, pz, hw * 2 + 3.4, pier + 0.8, hw * 2 + 2.6, pier, 1.0, stoneDark);
      }
    }
  }
  if (def.lampStyle !== 'modern') {
    for (let z = z0 + 6; z < z1 - 4; z += 16) {
      lampSpots.push({ x: x - hw - 0.6, z, nx: 1, nz: 0 });
      lampSpots.push({ x: x + hw + 0.6, z, nx: -1, nz: 0 });
    }
  }
}
