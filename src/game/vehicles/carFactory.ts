import * as THREE from 'three';
import type { VehicleModelParams } from '../../data/vehicles';
import type { PaintDef } from '../../data/cosmetics';

/** Procedural player-car builder: extruded side profiles + physical paint. No external models. */

export interface CarVisual {
  root: THREE.Group;
  /** rotated for yaw / roll / pitch */
  body: THREE.Group;
  wheels: THREE.Group[];
  frontWheels: THREE.Group[];
  paint: THREE.MeshPhysicalMaterial;
  tailLights: THREE.MeshBasicMaterial;
  glow: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  shadow: THREE.Mesh;
  /** local positions of the rear tyre contact patches (x, z) */
  rearWheels: [number, number][];
  length: number;
  width: number;
  dispose(): void;
}

export function makePaintMaterial(paint: PaintDef) {
  const m = new THREE.MeshPhysicalMaterial({ color: paint.color, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.4 });
  applyPaint(m, paint);
  return m;
}

export function applyPaint(m: THREE.MeshPhysicalMaterial, paint: PaintDef) {
  m.color.set(paint.color);
  m.iridescence = 0;
  switch (paint.finish) {
    case 'gloss': m.metalness = 0.25; m.roughness = 0.28; m.clearcoat = 1; break;
    case 'metallic': m.metalness = 0.75; m.roughness = 0.3; m.clearcoat = 1; break;
    case 'matte': m.metalness = 0.15; m.roughness = 0.85; m.clearcoat = 0; break;
    case 'chrome': m.metalness = 1; m.roughness = 0.06; m.clearcoat = 0.5; break;
    case 'pearl': m.metalness = 0.45; m.roughness = 0.22; m.clearcoat = 1; m.iridescence = 0.9; m.iridescenceIOR = 1.6; break;
  }
  m.needsUpdate = true;
}

interface StyleShape {
  noseH: number; // fraction of body height at nose
  hoodRise: number; // how much the hood rises toward the windscreen (fraction of H)
  tailH: number; // fraction of H at the tail
  windRake: number; // horizontal length of windscreen
  rearRake: number; // horizontal length of rear window
  bevel: number;
  roofInset: number;
}

const STYLE: Record<VehicleModelParams['style'], StyleShape> = {
  hatch: { noseH: 0.55, hoodRise: 0.15, tailH: 0.95, windRake: 0.75, rearRake: 0.35, bevel: 0.07, roofInset: 0.14 },
  gt: { noseH: 0.45, hoodRise: 0.2, tailH: 0.85, windRake: 0.85, rearRake: 1.1, bevel: 0.08, roofInset: 0.16 },
  coupe: { noseH: 0.6, hoodRise: 0.1, tailH: 0.95, windRake: 0.7, rearRake: 0.65, bevel: 0.03, roofInset: 0.12 },
  hyper: { noseH: 0.35, hoodRise: 0.35, tailH: 0.9, windRake: 0.9, rearRake: 1.2, bevel: 0.09, roofInset: 0.22 },
  drift: { noseH: 0.55, hoodRise: 0.12, tailH: 0.92, windRake: 0.72, rearRake: 0.75, bevel: 0.06, roofInset: 0.14 },
  superx: { noseH: 0.3, hoodRise: 0.3, tailH: 0.8, windRake: 1.0, rearRake: 1.3, bevel: 0.1, roofInset: 0.22 },
};

const CLEAR = 0.16;

/** Narrows the upper part of a geometry (tumblehome) so cabins don't look like boxes. */
function taper(g: THREE.BufferGeometry, y0: number, y1: number, amount: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - y0) / (y1 - y0)));
    pos.setX(i, pos.getX(i) * (1 - amount * t));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

function extrudeProfile(points: [number, number][], width: number, bevel: number, segments = 3) {
  const shape = new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u, v)));
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: segments, curveSegments: 6 });
  g.rotateY(-Math.PI / 2);
  g.translate(depth / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function buildCar(p: VehicleModelParams, paint: PaintDef): CarVisual {
  const st = STYLE[p.style];
  const L = p.length, W = p.width, H = p.height + CLEAR, r = p.wheelRadius;
  const front = -L / 2, rear = L / 2;
  const wf = front + L * 0.19, wr = rear - L * 0.2; // wheel centre z
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const disposables: { dispose(): void }[] = [];

  // --- body side profile (u = z, v = y) ---
  const arch = (cz: number, rad: number, pts: [number, number][]) => {
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI;
      pts.push([cz + Math.cos(a) * rad, Math.max(CLEAR, r + Math.sin(a) * rad)]);
    }
  };
  const cabFront = -p.cabinLength / 2 + p.cabinOffset;
  const cabRear = p.cabinLength / 2 + p.cabinOffset;
  const pts: [number, number][] = [];
  pts.push([front + 0.12, CLEAR + 0.02]);
  arch(wf, r + 0.07, pts);
  arch(wr, r + 0.07, pts);
  pts.push([rear - 0.08, CLEAR + 0.04]);
  pts.push([rear, CLEAR + 0.22]);
  pts.push([rear + 0.02, H * st.tailH]);
  pts.push([rear - 0.15, H * (st.tailH + 0.04)]);
  pts.push([cabRear + st.rearRake * 0.3, H]);
  pts.push([cabFront - st.windRake * 0.25, H]);
  pts.push([front + 0.45, H * (st.noseH + st.hoodRise * 0.5)]);
  pts.push([front + 0.05, H * st.noseH]);
  pts.push([front - 0.02, CLEAR + 0.2]);
  // shape must be wound consistently; reverse for counter-clockwise
  const bodyGeo = extrudeProfile(pts.reverse(), W, st.bevel);
  taper(bodyGeo, H * 0.55, H, 0.07);
  const paintMat = makePaintMaterial(paint);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  body.add(bodyMesh);
  disposables.push(bodyGeo, paintMat);

  // --- greenhouse (glass) ---
  const ch = p.cabinHeight;
  const glassPts: [number, number][] = [
    [cabFront - st.windRake * 0.2, H - 0.02],
    [cabRear + st.rearRake * 0.25, H - 0.02],
    [cabRear - st.rearRake * 0.35, H + ch],
    [cabFront + st.windRake * 0.55, H + ch],
  ];
  const glassW = W - st.roofInset * 2;
  const glassGeo = extrudeProfile(glassPts, glassW, 0.05, 2);
  taper(glassGeo, H, H + ch, 0.2);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#05070c', metalness: 0.9, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6 });
  body.add(new THREE.Mesh(glassGeo, glassMat));
  // roof panel in paint colour
  const roofPts: [number, number][] = [
    [cabFront + st.windRake * 0.5, H + ch - 0.04],
    [cabRear - st.rearRake * 0.3, H + ch - 0.04],
    [cabRear - st.rearRake * 0.36, H + ch + 0.03],
    [cabFront + st.windRake * 0.58, H + ch + 0.03],
  ];
  const roofGeo = extrudeProfile(roofPts, glassW + 0.04, 0.02, 1);
  taper(roofGeo, H, H + ch, 0.2);
  body.add(new THREE.Mesh(roofGeo, paintMat));
  disposables.push(glassGeo, glassMat, roofGeo);

  // --- details ---
  const dark = new THREE.MeshStandardMaterial({ color: '#0b0c10', roughness: 0.5, metalness: 0.4 });
  const accent = new THREE.Color(p.accentColor);
  const accentMat = new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(2.2), toneMapped: false });
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.55, 1.7), toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.05, 0.12), toneMapped: false });
  disposables.push(dark, accentMat, headMat, tailMat);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    disposables.push(geo);
    return m;
  };
  // headlights + DRL (pushed out past the bevel so they sit on the surface)
  const out = st.bevel * 0.8 + 0.03;
  const hlY = H * st.noseH - 0.04;
  add(new THREE.BoxGeometry(0.42, 0.07, 0.06), headMat, -W / 2 + 0.36, hlY, front - out);
  add(new THREE.BoxGeometry(0.42, 0.07, 0.06), headMat, W / 2 - 0.36, hlY, front - out);
  add(new THREE.BoxGeometry(W * 0.5, 0.025, 0.05), accentMat, 0, hlY - 0.1, front - out + 0.02);
  // tail light bar
  add(new THREE.BoxGeometry(W * 0.92, 0.07, 0.05), tailMat, 0, H * st.tailH - 0.1, rear + out);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.34, 0.14, 0.05), tailMat, sx * (W / 2 - 0.3), H * st.tailH - 0.1, rear + out);
  // diffuser / grille
  add(new THREE.BoxGeometry(W * 0.8, 0.16, 0.12), dark, 0, CLEAR + 0.12, rear + out - 0.06);
  add(new THREE.BoxGeometry(W * 0.62, 0.12, 0.08), dark, 0, CLEAR + 0.14, front + 0.04);
  // side sills with neon accent
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.04, 0.03, L * 0.5), accentMat, sx * (W / 2 + 0.005), CLEAR + 0.09, (wf + wr) / 2);
    add(new THREE.BoxGeometry(0.1, 0.07, 0.18), dark, sx * (W / 2 - 0.02), H - 0.02, cabFront - 0.05); // mirrors
  }
  // spoilers
  if (p.spoiler === 'wing' || p.spoiler === 'big') {
    const big = p.spoiler === 'big';
    const wy = H + (big ? 0.32 : 0.18);
    add(new THREE.BoxGeometry(W * (big ? 0.98 : 0.85), 0.05, big ? 0.42 : 0.3), dark, 0, wy, rear - 0.25);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, wy - H * st.tailH + 0.05, 0.16), dark, sx * W * 0.32, (wy + H * st.tailH) / 2, rear - 0.25);
    add(new THREE.BoxGeometry(W * (big ? 0.98 : 0.85), 0.02, 0.03), accentMat, 0, wy + 0.035, rear - 0.05);
  } else if (p.spoiler === 'lip') {
    add(new THREE.BoxGeometry(W * 0.8, 0.04, 0.16), dark, 0, H * st.tailH + 0.05, rear - 0.1);
  }
  if (p.style === 'drift') {
    // over-fenders
    for (const sx of [-1, 1]) for (const z of [wf, wr]) add(new THREE.BoxGeometry(0.12, 0.16, r * 2.4), paintMat, sx * (W / 2 + 0.02), r + r * 0.7, z);
  }
  if (p.style === 'superx') {
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.36, 0.9), paintMat, sx * (W / 2 - 0.25), H + 0.12, rear - 0.55);
  }
  if (p.style === 'hyper') {
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.06, 0.2, 0.7), dark, sx * (W / 2 + 0.005), H * 0.6, wr - 0.85); // side intakes
  }

  // --- wheels ---
  const tyreMat = new THREE.MeshStandardMaterial({ color: '#0d0d10', roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#c9ced8', metalness: 1, roughness: 0.18 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4 });
  disposables.push(tyreMat, rimMat, caliperMat);
  const tyreGeo = new THREE.CylinderGeometry(r, r, p.wheelWidth, 20);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(r * 0.66, r * 0.66, p.wheelWidth + 0.015, 10);
  rimGeo.rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(p.wheelWidth + 0.03, r * 1.2, 0.05);
  const calGeo = new THREE.BoxGeometry(0.08, r * 0.5, r * 0.5);
  disposables.push(tyreGeo, rimGeo, spokeGeo, calGeo);
  const wheels: THREE.Group[] = [];
  const frontWheels: THREE.Group[] = [];
  const track = W / 2 - p.wheelWidth / 2 + 0.04;
  for (const z of [wf, wr]) for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * track, r, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tyreGeo, tyreMat));
    spin.add(new THREE.Mesh(rimGeo, rimMat));
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(spokeGeo, rimMat);
      sp.rotation.x = (k / 3) * Math.PI;
      spin.add(sp);
    }
    pivot.add(spin);
    const cal = new THREE.Mesh(calGeo, caliperMat);
    cal.position.set(-sx * 0.06, r * 0.25, -r * 0.3);
    pivot.add(cal);
    root.add(pivot);
    wheels.push(spin);
    if (z === wf) frontWheels.push(pivot);
  }

  // --- glow + shadow planes (on the road, outside body so they don't roll) ---
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  planeGeo.rotateX(-Math.PI / 2);
  disposables.push(planeGeo);
  const glowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const glow = new THREE.Mesh(planeGeo, glowMat);
  glow.scale.set(W * 2.1, 1, L * 1.5);
  glow.position.y = 0.025;
  glow.renderOrder = 2;
  glow.visible = false;
  root.add(glow);
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.75, depthWrite: false });
  const shadow = new THREE.Mesh(planeGeo, shadowMat);
  shadow.scale.set(W * 1.5, 1, L * 1.25);
  shadow.position.y = 0.02;
  shadow.renderOrder = 1;
  root.add(shadow);
  disposables.push(glowMat, shadowMat);

  return {
    root, body, wheels, frontWheels, paint: paintMat, tailLights: tailMat, glow, glowMat, shadow,
    rearWheels: [[-track, wr], [track, wr]], length: L, width: W,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

/** Applies glow/shadow textures (created once by the engine). */
export function setCarTextures(car: CarVisual, glowTex: THREE.Texture) {
  car.glowMat.map = glowTex;
  (car.shadow.material as THREE.MeshBasicMaterial).map = glowTex;
  car.glowMat.needsUpdate = true;
  (car.shadow.material as THREE.MeshBasicMaterial).needsUpdate = true;
}

export function setUnderglow(car: CarVisual, color: string | null) {
  if (!color) {
    car.glow.visible = false;
    return;
  }
  car.glow.visible = true;
  car.glowMat.color.set(color).multiplyScalar(2.0);
}
