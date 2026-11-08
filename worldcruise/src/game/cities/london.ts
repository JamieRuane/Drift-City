import * as THREE from 'three';
import type { CityDefinition } from './types';
import type { LandmarkContext } from '../world/LandmarkContext';
import { CURB_H } from '../world/CityLayout';
import { GeometryBuilder } from '../world/GeometryBuilder';
import { colonnade, flowerBed, pediment, statue } from './landmarks/common';

const Y = CURB_H;
const HONEY = '#dcc59a';
const SLATE = '#4c5260';

// ---------------------------------------------------------------------------------------------- Big Ben + Parliament
function bigBen(ctx: LandmarkContext) {
  const f = ctx.b('facade:stone');
  const b = ctx.b('lit');
  const hw = ctx.hw - 5, hd = ctx.hd - 5;
  // Palace of Westminster along the river (+z)
  const x0 = -hw + 16, x1 = hw - 16, z0 = -hd + 4, z1 = hd - 2;
  f.ao = { y0: Y, h: 8, min: 0.72 };
  f.facadeBox(x0, z0, x1, z1, Y, Y + 18, HONEY, SLATE);
  f.ao = null;
  b.gable(0, Y + 18, (z0 + z1) / 2, x1 - x0, z1 - z0, 6, SLATE, 0, HONEY);
  for (let x = x0 + 2; x < x1; x += 4.2) {
    b.cone(x, Y + 18, z1, 0.35, 3.2, HONEY, 4);
    b.cone(x, Y + 18, z0, 0.35, 3.2, HONEY, 4);
  }
  // buttress ribs on the river facade
  for (let x = x0 + 4; x < x1; x += 8.4) b.block(x, Y, z1 + 0.25, 0.8, 18, 0.5, '#e4d0a8');
  ctx.box(0, Y + 9, (z0 + z1) / 2, (x1 - x0) / 2, 9, (z1 - z0) / 2);
  // Central tower
  b.cyl(0, Y + 18, (z0 + z1) / 2, 4.5, 14, HONEY, 8);
  b.cone(0, Y + 32, (z0 + z1) / 2, 4.6, 16, '#5d6370', 8);
  // Victoria Tower (east)
  const vx = hw - 9, vz = 0;
  f.facadeBox(vx - 7, vz - 7, vx + 7, vz + 7, Y, Y + 58, HONEY, SLATE);
  b.block(vx, Y + 58, vz, 15, 1.2, 15, '#cbb48a');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.cyl(vx + sx * 6.8, Y + 50, vz + sz * 6.8, 0.9, 12, HONEY, 6);
    b.cone(vx + sx * 6.8, Y + 62, vz + sz * 6.8, 1.0, 4, '#b8a072', 6);
  }
  b.pyramid(vx, Y + 59.2, vz, 10, 10, 5, SLATE);
  ctx.box(vx, Y + 29, vz, 7, 29, 7);
  // Elizabeth Tower (Big Ben)
  const ex = -hw + 8, ez = hd - 8;
  f.facadeBox(ex - 4.2, ez - 4.2, ex + 4.2, ez + 4.2, Y, Y + 50, HONEY, HONEY);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block(ex + sx * 4.1, Y, ez + sz * 4.1, 0.9, 50, 0.9, '#e6d3ad');
  b.block(ex, Y + 50, ez, 10, 9.5, 10, '#d4bb88');
  b.block(ex, Y + 59.5, ez, 10.6, 0.8, 10.6, '#bfa36e');
  b.block(ex, Y + 60.3, ez, 8.4, 4.5, 8.4, '#d4bb88');
  b.frustum(ex, Y + 64.8, ez, 9.2, 9.2, 2.2, 2.2, 13, '#3f4a5a');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cone(ex + sx * 4.4, Y + 64.8, ez + sz * 4.4, 0.6, 5, '#c9a14a', 6);
  b.cyl(ex, Y + 77.8, ez, 0.6, 2, '#c9a14a', 6, 0.2);
  b.cone(ex, Y + 79.8, ez, 0.3, 3, '#c9a14a', 6);
  ctx.box(ex, Y + 30, ez, 5, 30, 5);
  // clock faces with live hands
  const faceMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false });
  const handMat = new THREE.MeshBasicMaterial({ color: 0x1b1e24 });
  const hands: { h: THREE.Object3D; m: THREE.Object3D }[] = [];
  for (let k = 0; k < 4; k++) {
    const ry = (k * Math.PI) / 2;
    const face = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24), faceMat);
    face.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.1, 24), new THREE.MeshLambertMaterial({ color: 0xc9a14a }));
    ring.position.z = 0.01;
    face.add(ring);
    const hh = new THREE.Group(), mh = new THREE.Group();
    hh.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.0, 0.05).translate(0, 0.9, 0.05), handMat));
    mh.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.0, 0.05).translate(0, 1.4, 0.09), handMat));
    face.add(hh, mh);
    hands.push({ h: hh, m: mh });
    const off = new THREE.Vector3(0, 0, 5.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    ctx.object(face, ex + off.x, Y + 55, ez + off.z, ry);
  }
  ctx.animate({
    update(_t, _dt, night) {
      const d = new Date();
      const m = d.getMinutes() + d.getSeconds() / 60;
      const h = (d.getHours() % 12) + m / 60;
      for (const x of hands) {
        x.m.rotation.z = -(m / 60) * Math.PI * 2;
        x.h.rotation.z = -(h / 12) * Math.PI * 2;
      }
      const s = 0.95 + night * 0.6;
      faceMat.color.setRGB(s, s * 0.97, s * 0.85);
    },
  });
  for (let x = x0 + 6; x < x1 - 10; x += 10) ctx.tree(x, -hd + 1, 0.9, 'plane', Y);
}

// ---------------------------------------------------------------------------------------------- London Eye
function londonEye(ctx: LandmarkContext) {
  const R = 29, HC = R + 5;
  const cz = -ctx.hd + 12;
  const wb = new GeometryBuilder();
  const white = '#eef2f6';
  const N = 32;
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    for (const z of [-1.2, 1.2]) {
      wb.beam(Math.cos(a0) * R, Math.sin(a0) * R, z, Math.cos(a1) * R, Math.sin(a1) * R, z, 0.35, white);
      wb.beam(Math.cos(a0) * (R - 2.2), Math.sin(a0) * (R - 2.2), z * 0.6, Math.cos(a1) * (R - 2.2), Math.sin(a1) * (R - 2.2), z * 0.6, 0.18, white);
    }
    wb.beam(Math.cos(a0) * R, Math.sin(a0) * R, -1.2, Math.cos(a0) * R, Math.sin(a0) * R, 1.2, 0.2, white);
    wb.beam(0, 0, (i % 2 ? -1 : 1) * 2.5, Math.cos(a0) * R, Math.sin(a0) * R, 0, 0.07, '#d8dee6');
  }
  wb.geom(new THREE.CylinderGeometry(1.6, 1.6, 5, 12).rotateX(Math.PI / 2).toNonIndexed(), '#c4ccd6', 0, 0, 0, 1, 1, 1);
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.4, emissive: 0x4a7dff, emissiveIntensity: 0 });
  const wheel = new THREE.Mesh(wb.build(), wheelMat);
  wheel.castShadow = true;
  const pivot = new THREE.Group();
  pivot.add(wheel);
  ctx.object(pivot, 0, Y + HC, cz);
  // pods (stay level as the wheel turns)
  const podGeo = new THREE.CapsuleGeometry(1.2, 2.6, 3, 8).rotateZ(Math.PI / 2);
  const podMat = new THREE.MeshStandardMaterial({ color: 0xcfe8ff, metalness: 0.6, roughness: 0.15, transparent: true, opacity: 0.9, emissive: 0x88c4ff, emissiveIntensity: 0 });
  const pods = new THREE.InstancedMesh(podGeo, podMat, N);
  pods.castShadow = true;
  const podGroup = new THREE.Group();
  podGroup.add(pods);
  ctx.object(podGroup, 0, Y + HC, cz);
  const m = new THREE.Matrix4();
  let ang = 0;
  ctx.animate({
    update(_t, dt, night) {
      ang += dt * 0.035;
      wheel.rotation.z = ang;
      for (let i = 0; i < N; i++) {
        const a = ang + (i / N) * Math.PI * 2;
        m.makeTranslation(Math.cos(a) * (R + 1.6), Math.sin(a) * (R + 1.6), 0);
        pods.setMatrixAt(i, m);
      }
      pods.instanceMatrix.needsUpdate = true;
      wheelMat.emissiveIntensity = night * 0.9;
      podMat.emissiveIntensity = night * 0.7;
    },
  });
  // A-frame legs and the boarding pier
  const b = ctx.b('lit');
  for (const s of [-1, 1]) {
    b.beam(s * 10, Y, cz + 14, 0, Y + HC, cz + 1.5, 1.4, white);
    b.beam(s * 4, Y, cz + 18, 0, Y + HC, cz + 1.5, 0.6, '#c4ccd6');
    ctx.box(s * 10, Y + 2, cz + 14, 1.5, 2, 1.5);
  }
  b.slab(-16, cz - 4, 16, cz + 4, Y, Y + 1.2, '#e2ddd2', '#c9c3b6');
  ctx.box(0, Y + 0.6, cz, 16, 0.6, 4);
  for (let x = -ctx.hw + 8; x <= ctx.hw - 8; x += 9) ctx.tree(x, ctx.hd - 8, 1.0, 'plane', Y);
  for (let k = -2; k <= 2; k++) ctx.lamp(k * 9, cz + 8);
}

// ---------------------------------------------------------------------------------------------- Buckingham Palace
function buckingham(ctx: LandmarkContext) {
  const f = ctx.b('facade:stone');
  const b = ctx.b('lit');
  const hd = ctx.hd - 5;
  const W = 46;
  const z0 = -hd + 2, z1 = -hd + 22;
  const stone = '#ebe4d6';
  f.ao = { y0: Y, h: 8, min: 0.75 };
  f.facadeBox(-W, z0, W, z1, Y, Y + 22, stone, '#8d8f96');
  f.ao = null;
  b.block(0, Y + 22, (z0 + z1) / 2, W * 2 + 0.6, 1.2, z1 - z0 + 0.6, '#d9d0bd');
  b.block(0, Y + 23.2, (z0 + z1) / 2, W * 2 - 2, 1.6, z1 - z0 - 2, '#e1d9c8');
  // central portico
  b.block(0, Y, z1 + 1.2, 26, 1.2, 2.6, '#d7cdb8');
  colonnade(b, -11, 11, z1 + 1.6, Y + 1.2, 18, 6, 0.75, stone);
  pediment(b, 0, Y + 19.2, z1 + 1.6, 26, 3.4, 4, '#e3dbc9');
  // balcony
  b.block(0, Y + 9, z1 + 3.2, 10, 0.4, 1.6, '#d7cdb8');
  // royal standard
  b.cyl(0, Y + 24.8, (z0 + z1) / 2, 0.15, 12, '#ddd', 6);
  const flag = ctx.b('plain');
  flag.block(1.6, Y + 33.4, (z0 + z1) / 2, 3, 2.2, 0.06, '#c8102e');
  flag.block(1.6, Y + 33.9, (z0 + z1) / 2, 1.4, 1.0, 0.07, '#ffd200');
  ctx.box(0, Y + 11, (z0 + z1) / 2, W, 11, (z1 - z0) / 2 + 3);
  // forecourt railings with gilded gates
  const p = ctx.b('plain');
  const rz = z1 + 14;
  for (let x = -W; x <= W; x += 0.9) p.block(x, Y, rz, 0.08, 2.4, 0.08, '#16181c');
  p.block(0, Y + 2.3, rz, W * 2, 0.12, 0.12, '#16181c');
  for (const gx of [-20, 0, 20]) {
    p.block(gx, Y, rz, 6, 3, 0.2, '#c9a24a');
    p.block(gx - 3.2, Y, rz, 1, 4, 1, '#e6dfd0');
    p.block(gx + 3.2, Y, rz, 1, 4, 1, '#e6dfd0');
  }
  ctx.box(0, Y + 1.2, rz, W, 1.2, 0.3);
  // guards + sentry boxes
  for (const gx of [-8, 8]) {
    p.block(gx, Y, z1 + 6, 1.6, 2.8, 1.4, '#e8e2d4');
    p.pyramid(gx, Y + 2.8, z1 + 6, 1.8, 1.6, 0.6, '#8a8c92');
    p.cyl(gx, Y, z1 + 7.5, 0.22, 0.9, '#20232a', 6);
    p.cyl(gx, Y + 0.9, z1 + 7.5, 0.28, 0.8, '#c8102e', 6);
    p.sphere(gx, Y + 1.85, z1 + 7.5, 0.16, '#f1c9a5', 0);
    p.cyl(gx, Y + 1.95, z1 + 7.5, 0.22, 0.65, '#111', 8);
    ctx.box(gx, Y + 1.4, z1 + 6.5, 0.9, 1.4, 1.5);
  }
  // Victoria Memorial
  const vm = hd - 8;
  b.cyl(0, Y, vm, 9, 0.8, '#e4ded2', 16);
  ctx.b('water').cyl(0, Y + 0.2, vm, 8.2, 0.75, '#5a9fb4', 16);
  b.frustum(0, Y + 0.8, vm, 6, 6, 4.4, 4.4, 6, '#f1ece2');
  b.cyl(0, Y + 6.8, vm, 1.2, 8, '#f1ece2', 8, 0.9);
  statue(ctx.b('metal'), 0, Y + 14.8, vm, 1.4, '#e3b341');
  ctx.cyl(0, Y + 3, vm, 9, 3);
  for (let k = -4; k <= 4; k++) if (k !== 0) flowerBed(p, k * 9, Y, z1 + 10, 6, 2.4, '#d63a4a');
}

// ---------------------------------------------------------------------------------------------- Tower Bridge
function towerBridge(ctx: LandmarkContext) {
  const L = ctx.layout;
  const hw = L.halfX(6);
  const row = 3;
  const z0 = L.lineZ(row) + L.halfZ(row), z1 = L.lineZ(row + 1) - L.halfZ(row + 1);
  const half = (z1 - z0) / 2;
  const b = ctx.b('lit');
  const stone = '#ddd3c2';
  const blue = '#6aa2d8';
  const tz = half * 0.3;
  const H = 44;
  for (const zc of [-tz, tz]) {
    // pier in the river
    b.block(0, -4.5, zc, hw * 2 + 14, 4.3, 14, '#bcb2a2');
    for (const s of [-1, 1]) {
      const x = s * (hw + 3);
      b.block(x, 0, zc, 6, 30, 11, stone);
      ctx.box(x, 15, zc, 3, 15, 5.5);
    }
    b.block(0, 22, zc, hw * 2 + 12, 10, 11, stone);
    b.block(0, 32, zc, hw * 2 + 10, 6, 9, stone);
    b.arch(0, 15, zc, hw, 0.1, 11.2, '#c9bfae', 10, Math.PI / 2, 0, Math.PI);
    b.block(0, 38, zc, hw * 2 + 11, 1, 10, '#c9bfae');
    b.pyramid(0, 39, zc, hw * 2 + 8, 8, 9, '#5a6f86');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * (hw + 5), z = zc + sz * 4.6;
      b.cyl(x, 30, z, 1.2, 12, stone, 8);
      b.cone(x, 42, z, 1.4, 6, '#5a6f86', 8);
    }
    // windows
    for (const s of [-1, 1]) for (let y = 6; y < 30; y += 7) b.block(s * (hw + 6.05), y, zc, 0.1, 3, 2, '#3c4658');
  }
  // high-level walkways
  for (const dx of [-3, 3]) {
    b.block(dx, H - 4, 0, 3, 3.2, tz * 2 - 9, blue);
    b.block(dx, H - 4.4, 0, 3.4, 0.4, tz * 2 - 9, '#f0f2f6');
  }
  // suspension chains to the banks
  for (const s of [-1, 1]) {
    for (const side of [-1, 1]) {
      const x = s * (hw + 3);
      const start = side * tz, end = side * (half + 3);
      let pz = start, py = 30;
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        const z = start + (end - start) * t;
        const y = 30 - 28 * Math.pow(t, 0.75) + Math.sin(t * Math.PI) * -2;
        b.beam(x, py, pz, x, y, z, 0.9, blue);
        if (k < 8) b.beam(x, y, z, x, 1.2, z, 0.2, blue);
        pz = z;
        py = y;
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------- Trafalgar Square
function trafalgar(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const bronze = '#4f4a3e';
  b.frustum(0, 0, 0, 10, 10, 9, 9, 1.5, '#d4cab6');
  b.block(0, 1.5, 0, 6.5, 5, 6.5, '#e2d9c6');
  for (const [lx, lz, ry] of [[6, 0, Math.PI / 2], [-6, 0, -Math.PI / 2], [0, 6, 0], [0, -6, Math.PI]] as const) {
    b.block(lx, 0, lz, 3, 1.6, 5, '#d4cab6');
    b.push(lx, 1.6, lz, ry);
    b.block(0, 0.6, -0.3, 1.2, 1.2, 3, bronze);
    b.sphere(0, 1.9, 1.1, 0.75, bronze, 0);
    b.block(0, 0, 0.9, 1.0, 0.6, 1.0, bronze);
    b.pop();
  }
  b.cyl(0, 6.5, 0, 1.4, 34, '#e8e0cf', 12, 1.15);
  b.block(0, 40.5, 0, 3.4, 1.6, 3.4, bronze);
  statue(b, 0, 42.1, 0, 1.6, '#cfc8b8');
  ctx.box(0, 3.5, 0, 5, 3.5, 5);
  for (const [lx, lz, ry] of [[6, 0, 0], [-6, 0, 0], [0, 6, 0], [0, -6, 0]] as const) ctx.box(lx, 0.8, lz, lz === 0 ? 1.5 : 2.5, 0.8, lz === 0 ? 2.5 : 1.5, ry);
  // fountains
  const w = ctx.b('water');
  for (const fx of [-17, 17]) {
    b.cyl(fx, 0, 8, 6, 0.9, '#d4cab6', 16);
    w.cyl(fx, 0.1, 8, 5.4, 0.85, '#62a7bf', 16);
    b.cyl(fx, 0.9, 8, 0.6, 2.5, '#d4cab6', 8);
    b.cyl(fx, 3.4, 8, 2.2, 0.4, '#d4cab6', 12);
    ctx.b('glow').cone(fx, 3.8, 8, 0.7, 2.2, '#d6f2ff', 6);
    ctx.cyl(fx, 1, 8, 6, 1);
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.lamp(Math.cos(a) * 26, Math.sin(a) * 26);
  }
}

export const LONDON: CityDefinition = {
  id: 'london',
  name: 'London',
  country: 'United Kingdom',
  flag: '🇬🇧',
  tagline: 'Keep Calm and Cruise On',
  description: 'Red buses, black cabs and Gothic spires along a sweeping Thames, all driven on the left.',
  theme: { sky: ['#ffd9b8', '#7b8cb8'], accent: '#e8414d', ground: '#c9c6bf' },
  grid: { cols: 8, rows: 7, block: 60, road: 13 },
  wideZ: { 1: 20 },
  bridges: [2, 6],
  areas: [
    { type: 'water', c0: 0, r0: 3, c1: 7 },
    { type: 'landmark', c0: 2, r0: 2, c1: 3, ground: 'paved', landmark: 'bigben' },
    { type: 'landmark', c0: 2, r0: 4, ground: 'paved', landmark: 'eye' },
    { type: 'landmark', c0: 0, r0: 0, c1: 1, ground: 'paved', landmark: 'buckingham' },
    { type: 'plaza', c0: 4, r0: 1, landmark: 'trafalgar' },
    { type: 'park', c0: 2, r0: 0, c1: 3, r1: 1, pond: true, trees: 1.3 },
    { type: 'park', c0: 0, r0: 1, trees: 1.5 },
    { type: 'park', c0: 6, r0: 5 },
  ],
  style: {
    facades: [['brick', 4], ['stone', 3], ['georgian', 3]],
    wallColors: ['#b0614a', '#9e5642', '#c7a27a', '#e3d9c6', '#d9cdb5', '#8f4e3e', '#e8e0cf', '#a86f56'],
    roofColors: ['#4f5560', '#5a5f68', '#474c55'],
    trimColor: '#efe9dd',
    floors: [4, 7],
    towerChance: 0.03,
    towerFloors: [16, 32],
    glassTowerChance: 0.85,
    roof: 'mixed',
    lotWidth: [8, 14],
    shopChance: 0.5,
    awningColors: ['#1f3d6b', '#2f5a3a', '#7d1f2a', '#2a2a30'],
    shopColors: ['#1f3d2e', '#7d1f2a', '#1f2f4f', '#2a2a30', '#4f2a5a'],
    neonChance: 0,
    doorColors: ['#1f2a44', '#7d1f2a', '#1f4a32', '#2a2a2a'],
  },
  palette: {
    asphalt: '#55595f', sidewalk: '#cac7c0', curb: '#a8a39a', grass: '#80b45b', plaza: '#d2c8b5',
    marking: '#f4f4ee', centerLine: '#f4f4ee', outerGround: '#c4bfb5', hills: '#93a88f', water: '#4f7f88',
  },
  treeKind: 'plane',
  lampStyle: 'classic',
  streetProps: ['phonebox', 'postbox', 'bike'],
  driveSide: 'left',
  traffic: {
    colors: ['#f4f4f0', '#2b2f36', '#9aa3ad', '#1f3f7a', '#7d1f2a', '#2f5a3a', '#c0c4ca', '#e8d6b0'],
    taxi: { color: '#1d1f24', share: 0.3 },
    buses: '#d4202a',
  },
  spawn: { node: [5, 3], dir: 'W' },
  startHour: 10.5,
  waterName: 'Thames',
  landmarks: [
    {
      id: 'bigben', name: 'Big Ben & Parliament', icon: '🕰️', xp: 300, anchor: { area: true }, radius: 75,
      description: '“Big Ben” is really the 13-tonne bell inside the Elizabeth Tower. Its four clock faces show the real time right now.',
      build: bigBen,
    },
    {
      id: 'eye', name: 'London Eye', icon: '🎡', xp: 200, anchor: { area: true }, radius: 55,
      description: 'Built for the millennium as a five-year attraction, the wheel’s 32 capsules (one for each borough) never stopped turning.',
      build: londonEye,
    },
    {
      id: 'buckingham', name: 'Buckingham Palace', icon: '👑', xp: 250, anchor: { area: true }, radius: 70,
      description: 'The monarch’s London home has 775 rooms, its own post office and a guard that changes in bearskin hats.',
      build: buckingham,
    },
    {
      id: 'towerbridge', name: 'Tower Bridge', icon: '🌉', xp: 250, anchor: { grid: [6, 3.5] }, radius: 50,
      description: 'Its roadway splits and lifts to let ships through. In 1952 a London bus leapt the gap when it opened unexpectedly.',
      build: towerBridge,
    },
    {
      id: 'trafalgar', name: 'Trafalgar Square', icon: '🦁', xp: 150, anchor: { area: true }, radius: 45,
      description: 'Nelson watches over the square from his 52-metre column, guarded by four bronze lions cast from French cannons.',
      build: trafalgar,
    },
  ],
};
