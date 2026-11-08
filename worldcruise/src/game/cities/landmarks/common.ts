import * as THREE from 'three';
import type { GeometryBuilder } from '../../world/GeometryBuilder';
import type { LandmarkContext } from '../../world/LandmarkContext';
import { signTexture } from '../../world/textures';

type V3 = [number, number, number];

/**
 * Square lattice column between a bottom and a top square (given as centre + half size), with corner
 * beams, ring beams and X-bracing on each face. Used for the Eiffel Tower and Tokyo Tower.
 */
export function lattice(
  b: GeometryBuilder,
  bottom: { x: number; y: number; z: number; h: number },
  top: { x: number; y: number; z: number; h: number },
  levels: number,
  beam: number,
  color: THREE.ColorRepresentation,
  braceColor: THREE.ColorRepresentation = color,
  profile: (t: number) => number = (t) => t,
) {
  const at = (t: number): V3[] => {
    const k = profile(t);
    const cx = bottom.x + (top.x - bottom.x) * t;
    const cy = bottom.y + (top.y - bottom.y) * t;
    const cz = bottom.z + (top.z - bottom.z) * t;
    const h = bottom.h + (top.h - bottom.h) * k;
    return [[cx - h, cy, cz - h], [cx + h, cy, cz - h], [cx + h, cy, cz + h], [cx - h, cy, cz + h]];
  };
  for (let l = 0; l < levels; l++) {
    const A = at(l / levels), B = at((l + 1) / levels);
    for (let c = 0; c < 4; c++) {
      const n = (c + 1) % 4;
      b.beam(...A[c], ...B[c], beam, color);
      b.beam(...B[c], ...B[n], beam * 0.7, color);
      b.beam(...A[c], ...B[n], beam * 0.45, braceColor);
      b.beam(...A[n], ...B[c], beam * 0.45, braceColor);
    }
  }
}

/** A flat textured sign (text) facing local +Z. */
export function sign(ctx: LandmarkContext, text: string, lx: number, ly: number, lz: number, w: number, h: number, bg: string, fg: string, ry = 0) {
  const tex = signTexture(text, bg, fg, 512, Math.round((512 * h) / w));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: bg === 'transparent' }));
  ctx.object(m, lx, ly, lz, ry);
  return m;
}

/** Row of classical columns along local X. */
export function colonnade(b: GeometryBuilder, x0: number, x1: number, z: number, y0: number, h: number, n: number, r: number, color: THREE.ColorRepresentation) {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / Math.max(1, n - 1);
    b.cyl(x, y0, z, r * 1.25, 0.5, color, 8);
    b.cyl(x, y0 + 0.5, z, r, h - 1.0, color, 10, r * 0.88);
    b.block(x, y0 + h - 0.5, z, r * 2.6, 0.5, r * 2.6, color);
  }
}

/** Triangular pediment along local X, facing +Z. */
export function pediment(b: GeometryBuilder, cx: number, y: number, z: number, w: number, d: number, h: number, color: THREE.ColorRepresentation) {
  b.gable(cx, y, z, w, d, h, color, 0, color);
}

/** Simple low-poly human statue (for squares and bridges). */
export function statue(b: GeometryBuilder, x: number, y: number, z: number, s: number, color: THREE.ColorRepresentation) {
  b.cyl(x, y, z, 0.35 * s, 1.1 * s, color, 6, 0.25 * s);
  b.cyl(x, y + 1.1 * s, z, 0.25 * s, 0.7 * s, color, 6, 0.3 * s);
  b.sphere(x, y + 2.0 * s, z, 0.22 * s, color, 0);
  b.beam(x + 0.3 * s, y + 1.7 * s, z, x + 0.6 * s, y + 2.4 * s, z + 0.1 * s, 0.12 * s, color);
}

/** Formal garden bed (hedge rectangle with flowers). */
export function flowerBed(b: GeometryBuilder, x: number, y: number, z: number, w: number, d: number, flower: THREE.ColorRepresentation) {
  b.block(x, y, z, w, 0.5, d, '#4c8a46');
  b.block(x, y + 0.5, z, w - 0.8, 0.12, d - 0.8, flower);
}

export function rotY(obj: THREE.Object3D, speed: number) {
  return { update: (_t: number, dt: number) => { obj.rotation.y += speed * dt; } };
}
