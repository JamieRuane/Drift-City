import * as THREE from 'three';
import type { CityDefinition } from './types';
import type { LandmarkContext } from '../world/LandmarkContext';
import { CURB_H } from '../world/CityLayout';
import { flowerBed, lattice, sign, statue } from './landmarks/common';

const STONE = '#ebe0ca';
const STONE_D = '#d6c8ad';
const SLATE = '#6c7b8d';
const GOLD = '#e0b54a';
const Y = CURB_H;

// ---------------------------------------------------------------------------------------------- Eiffel Tower
function eiffel(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const col = '#8b6b4c', brace = '#7a5c40';
  const oz = -22;
  b.push(0, Y, oz);
  const B = 24;
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    lattice(b, { x: sx * (B - 4.5), y: 0, z: sz * (B - 4.5), h: 4.5 }, { x: sx * 12.5, y: 27, z: sz * 12.5, h: 2.6 }, 4, 0.7, col, brace);
    b.frustum(sx * (B - 4.5), 0, sz * (B - 4.5), 10.5, 10.5, 9.5, 9.5, 1.5, STONE_D);
  }
  // first-level arches
  for (let f = 0; f < 4; f++) {
    b.push(0, 0, 0, (f * Math.PI) / 2);
    b.arch(0, 9.5, 17.8, 12.4, 1.2, 1.0, col, 14, 0, 0.25, Math.PI - 0.25);
    b.pop();
  }
  // first platform
  b.frustum(0, 27, 0, 31, 31, 32, 32, 3.4, col);
  b.block(0, 30.4, 0, 32.5, 1.0, 32.5, '#9a7a58');
  lattice(b, { x: 0, y: 31.4, z: 0, h: 12.5 }, { x: 0, y: 57, z: 0, h: 7.4 }, 4, 0.6, col, brace);
  b.frustum(0, 57, 0, 16, 16, 17, 17, 2.4, col);
  b.block(0, 59.2, 0, 17.5, 0.8, 17.5, '#9a7a58');
  lattice(b, { x: 0, y: 60, z: 0, h: 6.6 }, { x: 0, y: 124, z: 0, h: 1.6 }, 9, 0.5, col, brace, (t) => 1 - Math.pow(1 - t, 1.6));
  b.block(0, 124, 0, 4.6, 4.2, 4.6, '#9a7a58');
  b.block(0, 128.2, 0, 3.0, 2.4, 3.0, col);
  b.cyl(0, 130.6, 0, 0.5, 12, '#c4c9cf', 6, 0.2);
  b.pop();
  // golden lights on platforms
  const g = ctx.b('glow');
  for (const [y, h] of [[30.9, 16.3], [59.6, 8.8]] as const) {
    for (let k = -h; k <= h; k += 2.2) {
      g.box(k, Y + y, oz - h, 0.3, 0.3, 0.3, '#ffd27a');
      g.box(k, Y + y, oz + h, 0.3, 0.3, 0.3, '#ffd27a');
      g.box(-h, Y + y, oz + k, 0.3, 0.3, 0.3, '#ffd27a');
      g.box(h, Y + y, oz + k, 0.3, 0.3, 0.3, '#ffd27a');
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) ctx.cyl(sx * (B - 4.5), 4, oz + sz * (B - 4.5), 5.6, 4);

  // sparkling lights (night) + rotating beacon
  const pts: number[] = [];
  const r = ctx.rng;
  for (let i = 0; i < 520; i++) {
    const y = r() * 124;
    let h: number;
    if (y < 27) h = B - 2 - (y / 27) * 9.5;
    else if (y < 57) h = 12.5 - ((y - 27) / 30) * 5;
    else h = 6.6 - (1 - Math.pow(1 - (y - 57) / 67, 1.6)) * 5;
    const side = r.int(0, 3), t = r() * 2 - 1;
    const x = side === 0 ? h : side === 1 ? -h : t * h, z = side === 2 ? h : side === 3 ? -h : t * h;
    pts.push(x, y + Y, z + oz);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const seeds = new Float32Array(pts.length / 3).map(() => Math.random() * 100);
  geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uTime; varying float vA;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
      float s = step(0.82, fract(sin(seed*12.9 + floor(uTime*9.0 + seed)*78.2)*43758.5));
      vA = s; gl_PointSize = (2.0 + 5.0*s) * (300.0 / -mv.z); }`,
    fragmentShader: `uniform float uNight; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = 1.0 - smoothstep(0.0, 0.5, length(c));
      gl_FragColor = vec4(vec3(1.0,0.95,0.85) * d, d * vA * uNight); }`,
  });
  const sparkle = new THREE.Points(geo, mat);
  sparkle.frustumCulled = false;
  ctx.object(sparkle, 0, 0, 0);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(4, 220, 12, 1, true).translate(0, -110, 0).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  const beacon = new THREE.Group();
  beacon.add(beam);
  ctx.object(beacon, 0, Y + 127, oz);
  ctx.animate({
    update(t, dt, night) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uNight.value = night;
      beacon.rotation.y += dt * 0.7;
      (beam.material as THREE.MeshBasicMaterial).opacity = night * 0.16;
      beam.visible = night > 0.05;
    },
  });

  // Champ de Mars gardens
  const p = ctx.b('plain');
  for (let z = 22; z < ctx.hd - 12; z += 14) {
    flowerBed(p, -12, Y, z, 10, 9, '#e85b7a');
    flowerBed(p, 12, Y, z, 10, 9, '#f2c94c');
  }
  for (let z = -ctx.hd + 10; z < ctx.hd - 6; z += 11) {
    ctx.tree(-ctx.hw + 9, z, 1.0, 'round', Y);
    ctx.tree(ctx.hw - 9, z, 1.0, 'round', Y);
  }
}

// ---------------------------------------------------------------------------------------------- Arc de Triomphe
function arc(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const s = STONE;
  // piers (passages through both axes)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.block(sx * 9.75, 0, sz * 5, 10.5, 21, 5, s);
    ctx.box(sx * 9.75, 10.5, sz * 5, 5.25, 10.5, 2.5);
    // relief panels
    b.block(sx * 9.75, 3.5, sz * 7.55, 6.5, 8, 0.2, '#ddd0b5');
    b.block(sx * 15.05, 3.5, sz * 5, 0.2, 8, 3.5, '#ddd0b5');
  }
  for (const sx of [-1, 1]) b.block(sx * 9.75, 12, 0, 10.5, 9, 5, s);
  b.arch(0, 16, 0, 4.5, 5.2, 15, s, 14);
  for (const sx of [-1, 1]) b.arch(sx * 9.75, 9.5, 0, 2.5, 3.2, 10.5, s, 10, Math.PI / 2);
  b.block(0, 21, 0, 30, 6, 15, s);
  b.block(0, 26.6, 0, 31.2, 0.9, 16.2, STONE_D);
  b.block(0, 27.5, 0, 30, 5, 15, s);
  b.block(0, 32.5, 0, 30.6, 0.7, 15.6, STONE_D);
  for (let k = -13; k <= 13; k += 2.2) {
    b.block(k, 28.2, 7.55, 0.9, 1.6, 0.15, '#d5c7aa');
    b.block(k, 28.2, -7.55, 0.9, 1.6, 0.15, '#d5c7aa');
  }
  // eternal flame + flag
  ctx.b('glow').cone(0, 0.3, 0, 0.3, 0.8, '#ffb347', 6);
  const flag = ctx.b('plain');
  flag.block(-1.6, 9, 0, 1.6, 7, 0.05, '#1f4fa8');
  flag.block(0, 9, 0, 1.6, 7, 0.05, '#f4f4f4');
  flag.block(1.6, 9, 0, 1.6, 7, 0.05, '#d1323c');
  flag.block(0, 16, 0, 5.2, 0.1, 0.1, '#333');
  // Place de l'Étoile: ring of lamps and bollards
  const p = ctx.b('plain');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const R = Math.min(ctx.hw, ctx.hd) - 4;
    if (k % 2 === 0) ctx.lamp(Math.cos(a) * R, Math.sin(a) * R);
    else p.cyl(Math.cos(a) * R, 0, Math.sin(a) * R, 0.25, 0.9, '#2d2f33', 6);
  }
  p.cyl(0, 0, 0, 22, 0.05, '#cfc3ac', 32);
  p.cyl(0, 0.02, 0, 21.4, 0.05, '#bfb39b', 32);
}

// ---------------------------------------------------------------------------------------------- Louvre
function louvre(ctx: LandmarkContext) {
  const f = ctx.b('facade:stone');
  const r = ctx.b('lit');
  const hw = ctx.hw - 5, hd = ctx.hd - 5;
  const H = 17, D = 15;
  const wings: [number, number, number, number][] = [
    [-hw, -hd, hw, -hd + D],
    [-hw, -hd + D, -hw + D, hd],
    [hw - D, -hd + D, hw, hd],
  ];
  for (const [x0, z0, x1, z1] of wings) {
    f.ao = { y0: Y, h: 8, min: 0.7 };
    f.facadeBox(x0, z0, x1, z1, Y, Y + H, '#f1e6d1', STONE_D, 0, 0);
    f.ao = null;
    r.block((x0 + x1) / 2, Y + H, (z0 + z1) / 2, x1 - x0 + 0.6, 0.6, z1 - z0 + 0.6, STONE_D);
    r.frustum((x0 + x1) / 2, Y + H + 0.6, (z0 + z1) / 2, x1 - x0, z1 - z0, x1 - x0 - 5, z1 - z0 - 5, 4.5, SLATE);
    ctx.box((x0 + x1) / 2, Y + H / 2, (z0 + z1) / 2, (x1 - x0) / 2, H / 2, (z1 - z0) / 2);
  }
  // pavilions with tall roofs
  const pav = (x: number, z: number) => {
    r.block(x, Y, z, 20, H + 3, 18, '#efe3cc');
    r.frustum(x, Y + H + 3, z, 20, 18, 7, 6, 9, SLATE);
    r.block(x, Y + H + 12, z, 7.2, 0.6, 6.2, GOLD);
  };
  pav(-hw + 10, -hd + 9);
  pav(hw - 10, -hd + 9);
  pav(0, -hd + 9);
  pav(-hw + 9, hd - 9);
  pav(hw - 9, hd - 9);
  // glass pyramid
  const g = ctx.b('metal');
  const pz = hd * 0.25;
  g.pyramid(0, Y, pz, 24, 24, 15, '#a8d4ec');
  const fr = ctx.b('plain');
  for (let k = -10; k <= 10; k += 4) {
    fr.beam(k, Y + 0.05, pz + 12.05, 0, Y + 15, pz, 0.12, '#3d4752');
    fr.beam(k, Y + 0.05, pz - 12.05, 0, Y + 15, pz, 0.12, '#3d4752');
    fr.beam(12.05, Y + 0.05, pz + k, 0, Y + 15, pz, 0.12, '#3d4752');
    fr.beam(-12.05, Y + 0.05, pz + k, 0, Y + 15, pz, 0.12, '#3d4752');
  }
  for (const [x, z] of [[-20, pz + 4], [20, pz + 4], [0, pz + 24]]) g.pyramid(x, Y, z, 6, 6, 4, '#a8d4ec');
  ctx.box(0, Y + 5, pz, 9, 5, 9);
  // reflecting pools
  const w = ctx.b('water');
  for (const [x0, z0, x1, z1] of [[-28, pz - 14, -14, pz + 14], [14, pz - 14, 28, pz + 14]]) {
    fr.slab(x0 - 0.6, z0 - 0.6, x1 + 0.6, z1 + 0.6, Y, Y + 0.5, '#d7ccb6', '#c9bda5');
    w.rectXZ(x0, z0, x1, z1, Y + 0.52, '#5aa0b8');
    ctx.box((x0 + x1) / 2, Y + 0.4, (z0 + z1) / 2, (x1 - x0) / 2 + 0.6, 0.6, (z1 - z0) / 2 + 0.6);
  }
  for (let k = -3; k <= 3; k++) if (k !== 0) ctx.lamp(k * 8, hd - 2);
}

// ---------------------------------------------------------------------------------------------- Notre-Dame
function notreDame(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const s = '#e6d8bb', sd = '#cdbd9c';
  const L = 38, Wn = 13, H = 21;
  // nave (along x), west façade at -x
  b.block(0, Y, 0, L, H, Wn, s);
  b.gable(0, Y + H, 0, L, Wn + 0.6, 9, '#59606d', 0, s);
  // aisles
  for (const sz of [-1, 1]) {
    b.block(-2, Y, sz * (Wn / 2 + 3.5), L - 8, 11, 7, sd);
    b.block(-2, Y + 11, sz * (Wn / 2 + 3.5), L - 8, 0.6, 7.4, '#59606d');
    // flying buttresses
    for (let x = -L / 2 + 8; x < L / 2 - 6; x += 6) {
      b.block(x, Y, sz * (Wn / 2 + 8.5), 1.4, 13, 1.6, sd);
      b.beam(x, Y + 13, sz * (Wn / 2 + 8.5), x, Y + 19, sz * (Wn / 2 + 0.3), 0.8, sd);
    }
  }
  // transept
  b.block(4, Y, 0, 10, H, Wn + 20, s);
  b.gable(4, Y + H, 0, 10, Wn + 20, 8, '#59606d', Math.PI / 2, s);
  // apse
  b.cyl(L / 2, Y, 0, Wn / 2, H, s, 10);
  b.cone(L / 2, Y + H, 0, Wn / 2 + 0.3, 7, '#59606d', 10);
  // spire
  b.cyl(4, Y + H + 7, 0, 2.2, 6, '#7a8088', 8, 1.6);
  b.cone(4, Y + H + 13, 0, 1.6, 26, '#6b727c', 8);
  // west façade + towers
  const fx = -L / 2 - 4;
  b.block(fx, Y, 0, 8, 30, Wn + 16, s);
  for (const sz of [-1, 1]) {
    b.block(fx, Y + 30, sz * 7.5, 9, 16, 9, s);
    b.block(fx, Y + 46, sz * 7.5, 9.6, 0.8, 9.6, sd);
    for (let k = -1; k <= 1; k += 2) b.block(fx - 4.55, Y + 34, sz * 7.5 + k * 2.2, 0.2, 9, 1.6, '#3d4250');
  }
  b.block(fx - 4.1, Y + 27, 0, 0.3, 1.8, Wn + 16, sd);
  b.block(fx - 4.1, Y + 18.5, 0, 0.3, 1.2, Wn + 16, sd);
  // portals
  for (const z of [-7.5, 0, 7.5]) {
    b.block(fx - 4.05, Y, z, 0.2, 7, 4, '#5a4a3a');
    b.arch(fx - 4.1, Y + 7, z, 2.0, 0.6, 0.3, sd, 8, Math.PI / 2);
  }
  // rose window
  const g = ctx.b('glow');
  g.push(fx - 4.15, Y + 22.5, 0, -Math.PI / 2);
  g.cyl(0, 0, 0, 3.6, 0.1, '#5b6fd6', 16);
  g.pop();
  g.geom(new THREE.CylinderGeometry(3.6, 3.6, 0.12, 16).rotateZ(Math.PI / 2).toNonIndexed(), '#6a4fd0', fx - 4.15, Y + 22.5, 0, 1, 1, 1);
  g.geom(new THREE.CylinderGeometry(2.0, 2.0, 0.14, 12).rotateZ(Math.PI / 2).toNonIndexed(), '#e0a33c', fx - 4.2, Y + 22.5, 0, 1, 1, 1);
  ctx.box(0, Y + 10, 0, L / 2 + 8, 10, Wn / 2 + 9);
  ctx.box(fx, Y + 15, 0, 4, 15, Wn / 2 + 8);
  // parvis + garden
  for (let x = -ctx.hw + 6; x < ctx.hw - 10; x += 10) {
    ctx.tree(x, -ctx.hd + 5, 0.85, 'round', Y);
    ctx.tree(x, ctx.hd - 5, 0.85, 'round', Y);
  }
}

// ---------------------------------------------------------------------------------------------- Pont Alexandre III
function pontAlexandre(ctx: LandmarkContext) {
  const L = ctx.layout;
  const hw = L.halfX(2);
  const row = L.water[0]?.row ?? 3;
  const z0 = L.lineZ(row) + L.halfZ(row), z1 = L.lineZ(row + 1) - L.halfZ(row + 1);
  const half = (z1 - z0) / 2;
  const b = ctx.b('lit');
  const m = ctx.b('metal');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (hw + 3.6), z = sz * (half + 3);
    b.block(x, 0, z, 3.2, 3, 3.2, STONE_D);
    b.block(x, 3, z, 2.4, 13, 2.4, STONE);
    b.block(x, 16, z, 3.0, 1, 3.0, STONE_D);
    // gilded winged horse
    m.block(x, 17, z, 1.2, 1.4, 2.4, GOLD);
    m.beam(x, 18.2, z + 1, x, 19.6, z + 1.8, 0.6, GOLD);
    m.beam(x - 0.4, 18.4, z, x - 2.0, 20.2, z - 0.4, 0.25, GOLD);
    m.beam(x + 0.4, 18.4, z, x + 2.0, 20.2, z - 0.4, 0.25, GOLD);
    statue(m, x, 18.3, z - 0.3, 0.8, GOLD);
    ctx.box(x, 8, z, 1.6, 8, 1.6);
  }
  // candelabra lamps along the deck
  const g = ctx.b('glow');
  const p = ctx.b('plain');
  for (let z = -half + 8; z <= half - 8; z += 12) {
    for (const sx of [-1, 1]) {
      const x = sx * (hw + 0.6);
      p.cyl(x, 1.1, z, 0.12, 3.6, '#2c3a34', 6);
      for (const k of [-0.5, 0.5]) {
        p.beam(x, 4.3, z, x + k, 4.6, z, 0.06, '#2c3a34');
        g.sphere(x + k, 4.8, z, 0.24, '#ffe2a0', 0);
      }
      g.sphere(x, 5.0, z, 0.28, '#ffe2a0', 0);
    }
  }
}

// ---------------------------------------------------------------------------------------------- Moulin Rouge
function moulinRouge(ctx: LandmarkContext) {
  const b = ctx.b('lit');
  const red = '#c8202c';
  const fz = ctx.hd - 12;
  b.block(0, Y, fz, 34, 9, 14, red);
  b.block(0, Y + 9, fz, 35, 0.8, 15, '#9a1620');
  b.block(0, Y + 9.8, fz, 20, 4, 10, red);
  const g = ctx.b('glow');
  for (let x = -16; x <= 16; x += 1.6) {
    g.sphere(x, Y + 8.6, fz + 7.1, 0.16, '#ffe9a8', 0);
    g.sphere(x, Y + 3.8, fz + 7.1, 0.16, '#ffe9a8', 0);
  }
  ctx.b('shop').block(0, Y, fz + 7.02, 26, 3.2, 0.1, '#ffb070');
  sign(ctx, 'MOULIN ROUGE', 0, Y + 6.2, fz + 7.2, 20, 2.2, '#1b0a0d', '#ff4b5c');
  ctx.box(0, Y + 5, fz, 17, 5, 7);
  // windmill
  const mx = 8, mz = fz - 1;
  b.frustum(mx, Y + 13.8, mz, 5, 5, 3, 3, 9, red);
  b.pyramid(mx, Y + 22.8, mz, 4.4, 4.4, 3, '#7a1218');
  const sails = new THREE.Group();
  const sm = new THREE.MeshLambertMaterial({ color: 0x8a1a22, emissive: 0xff3040, emissiveIntensity: 0.3 });
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 0.15).translate(0, 4.4, 0), sm);
    arm.rotation.z = (k * Math.PI) / 2;
    sails.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 8).rotateX(Math.PI / 2), sm);
  sails.add(hub);
  ctx.object(sails, mx, Y + 20, mz + 2.8);
  ctx.animate({ update: (_t, dt, night) => { sails.rotation.z -= dt * 0.6; sm.emissiveIntensity = 0.15 + night * 1.2; } });
  // boulevard terrace
  const p = ctx.b('plain');
  for (let k = -3; k <= 3; k++) {
    p.cyl(k * 4, Y, fz + 11, 0.05, 0.75, '#333', 5);
    p.cyl(k * 4, Y + 0.72, fz + 11, 0.4, 0.05, '#f2efe8', 10);
  }
  for (let x = -ctx.hw + 7; x <= ctx.hw - 7; x += 9) {
    ctx.tree(x, -ctx.hd + 7, 0.95, 'plane', Y);
  }
  // neighbouring Montmartre houses
  const f = ctx.b('facade:haussmann');
  const cols = ['#f2e5cf', '#efe0c8', '#f5ead8', '#ead9bf'];
  let x = -ctx.hw + 5;
  while (x < ctx.hw - 9) {
    const w = 9 + ctx.rng() * 6;
    const h = 14 + ctx.rng() * 6;
    const z0 = -ctx.hd + 12, z1 = fz - 9;
    f.facadeBox(x, z0, x + w, z1, Y, Y + h, cols[Math.floor(ctx.rng() * 4)], SLATE, ctx.rng(), 0);
    ctx.b('plain').frustum(x + w / 2, Y + h, (z0 + z1) / 2, w, z1 - z0, w - 3, z1 - z0 - 3, 2.8, SLATE);
    ctx.box(x + w / 2, Y + h / 2, (z0 + z1) / 2, w / 2, h / 2, (z1 - z0) / 2);
    x += w;
  }
}

export const PARIS: CityDefinition = {
  id: 'paris',
  name: 'Paris',
  country: 'France',
  flag: '🇫🇷',
  tagline: 'La Ville Lumière',
  description: 'Cream Haussmann boulevards, zinc rooftops and the Seine glittering under seven bridges.',
  theme: { sky: ['#ffb38a', '#7aa7e8'], accent: '#ff6b5a', ground: '#e9dcc3' },
  grid: { cols: 8, rows: 7, block: 64, road: 14 },
  wideZ: { 1: 22 },
  wideX: { 3: 18 },
  bridges: [2, 7],
  areas: [
    { type: 'water', c0: 0, r0: 3, c1: 3 },
    { type: 'water', c0: 5, r0: 3, c1: 7 },
    { type: 'landmark', c0: 4, r0: 3, ground: 'cobble', landmark: 'notredame' },
    { type: 'plaza', c0: 1, r0: 1, landmark: 'arc' },
    { type: 'landmark', c0: 1, r0: 4, r1: 5, ground: 'grass', landmark: 'eiffel' },
    { type: 'landmark', c0: 4, r0: 2, c1: 5, ground: 'cobble', landmark: 'louvre' },
    { type: 'park', c0: 2, r0: 2, c1: 3, pond: true, trees: 1.2 },
    { type: 'park', c0: 5, r0: 5, pond: true },
    { type: 'landmark', c0: 6, r0: 0, ground: 'paved', landmark: 'moulin' },
  ],
  style: {
    facades: [['haussmann', 8], ['stone', 2]],
    wallColors: ['#f3e7d3', '#efe2cb', '#f5ecdc', '#e9dcc5', '#f1e4cf', '#eadfcd', '#f6eedf'],
    roofColors: ['#6f7f91', '#7a8898', '#65758a', '#73828f'],
    trimColor: '#efe6d6',
    floors: [5, 7],
    towerChance: 0,
    towerFloors: [0, 0],
    glassTowerChance: 0,
    roof: 'mansard',
    lotWidth: [12, 20],
    shopChance: 0.62,
    awningColors: ['#b3262d', '#2f5f8a', '#1f6b4a', '#8a2d5c', '#c98b2b'],
    shopColors: ['#2a3b4d', '#5a2a2a', '#1f3d2e', '#3c3c44', '#6b4b2a', '#7d5a2e'],
    neonChance: 0,
    cornerTurrets: true,
  },
  palette: {
    asphalt: '#5f636b', sidewalk: '#e4dccb', curb: '#c7bdab', grass: '#97c46f', plaza: '#e0d5bf',
    marking: '#f4f4ee', centerLine: '#f4f4ee', outerGround: '#d9d0bf', hills: '#a5bda2', water: '#4f93a6',
  },
  treeKind: 'plane',
  lampStyle: 'paris',
  streetProps: ['morris', 'kiosk', 'bike'],
  driveSide: 'right',
  traffic: {
    colors: ['#f4f4f0', '#2b2f36', '#9aa3ad', '#3f6fb5', '#c0392b', '#e8d6b0', '#5d7c5a', '#7d2f3f', '#d9a441'],
  },
  spawn: { node: [3, 1], dir: 'W' },
  startHour: 16.8,
  waterName: 'Seine',
  landmarks: [
    {
      id: 'eiffel', name: 'Eiffel Tower', icon: '🗼', xp: 300, anchor: { area: true }, radius: 70,
      description: 'Built for the 1889 World’s Fair and meant to last just 20 years, Gustave Eiffel’s iron lattice was saved because it made a perfect radio antenna.',
      build: eiffel,
    },
    {
      id: 'arc', name: 'Arc de Triomphe', icon: '🏛️', xp: 200, anchor: { area: true }, radius: 48,
      description: 'Commissioned by Napoleon in 1806, the arch crowns Place de l’Étoile, where twelve avenues meet. The Unknown Soldier rests beneath it.',
      build: arc,
    },
    {
      id: 'louvre', name: 'The Louvre', icon: '🖼️', xp: 250, anchor: { area: true }, radius: 70,
      description: 'Once a royal palace, now the world’s most visited museum. I. M. Pei’s glass pyramid entrance divided Paris when it opened in 1989.',
      build: louvre,
    },
    {
      id: 'notredame', name: 'Notre-Dame de Paris', icon: '⛪', xp: 250, anchor: { area: true }, radius: 55,
      description: 'This Gothic masterpiece on the Île de la Cité took nearly 200 years to build. Its flying buttresses were a daring piece of medieval engineering.',
      build: notreDame,
    },
    {
      id: 'seine', name: 'Pont Alexandre III & the Seine', icon: '🌉', xp: 150, anchor: { grid: [2, 3.5] }, radius: 45,
      description: 'Paris’s most ornate bridge crosses the Seine in a single steel arch, guarded by four gilded winged horses.',
      build: pontAlexandre,
    },
    {
      id: 'moulin', name: 'Moulin Rouge', icon: '💃', xp: 150, anchor: { area: true }, radius: 45,
      description: 'The red windmill of Montmartre has been the home of the can-can since 1889.',
      build: moulinRouge,
    },
  ],
};
