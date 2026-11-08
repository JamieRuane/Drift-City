import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { nextTunnelStart, TUNNEL_LENGTH } from '../constants';
import { clamp } from '../../utils/math';

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};

const RIGHT = 9.2;
const LEFT = -18.8;
const TOP = 7.4;
const LIGHT_SPACING = 8;

/** A single tunnel that leapfrogs to the next tunnel location once the player has driven through it. */
export class Tunnel {
  readonly group = new THREE.Group();
  private start = 0;

  constructor() {
    const L = TUNNEL_LENGTH;
    const wallMat = new THREE.MeshStandardMaterial({ color: '#2a2b33', roughness: 0.7, metalness: 0.2 });
    const shell = mergeGeometries([
      box(0.6, TOP, L, RIGHT + 0.3, TOP / 2, -L / 2),
      box(0.6, TOP, L, LEFT - 0.3, TOP / 2, -L / 2),
      box(RIGHT - LEFT + 1.2, 0.6, L, (RIGHT + LEFT) / 2, TOP + 0.3, -L / 2),
      // portals
      box(RIGHT - LEFT + 10, 6, 2, (RIGHT + LEFT) / 2, TOP + 3, 0.5),
      box(5, TOP + 6, 2, RIGHT + 2.5, (TOP + 6) / 2, 0.5),
      box(5, TOP + 6, 2, LEFT - 2.5, (TOP + 6) / 2, 0.5),
      box(RIGHT - LEFT + 10, 6, 2, (RIGHT + LEFT) / 2, TOP + 3, -L - 0.5),
      box(5, TOP + 6, 2, RIGHT + 2.5, (TOP + 6) / 2, -L - 0.5),
      box(5, TOP + 6, 2, LEFT - 2.5, (TOP + 6) / 2, -L - 0.5),
    ])!;
    this.group.add(new THREE.Mesh(shell, wallMat));

    // neon guide lines on the walls and a glowing portal outline
    const neon = (color: THREE.Color, geo: THREE.BufferGeometry) => this.group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false })));
    neon(new THREE.Color(0.2, 1.8, 2.6), mergeGeometries([box(0.05, 0.12, L, RIGHT - 0.02, 1.2, -L / 2), box(0.05, 0.12, L, LEFT + 0.02, 1.2, -L / 2)])!);
    neon(new THREE.Color(2.6, 0.3, 2.0), mergeGeometries([
      box(RIGHT - LEFT, 0.25, 0.3, (RIGHT + LEFT) / 2, TOP - 0.1, 1.6),
      box(0.25, TOP, 0.3, RIGHT, TOP / 2, 1.6), box(0.25, TOP, 0.3, LEFT, TOP / 2, 1.6),
    ])!);

    // sodium ceiling lights — instanced
    const n = Math.floor(L / LIGHT_SPACING);
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.78, 0.26), toneMapped: false }), n * 3);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      [[-3.6, 0], [3.6, 0], [-14, 0]].forEach(([x], k) => {
        d.position.set(x, TOP - 0.05, -i * LIGHT_SPACING - 2);
        d.updateMatrix();
        lights.setMatrixAt(i * 3 + k, d.matrix);
      });
    }
    lights.frustumCulled = false;
    this.group.add(lights);
  }

  reset(playerS: number) {
    this.start = nextTunnelStart(playerS - TUNNEL_LENGTH - 60);
    this.group.position.z = -this.start;
  }

  update(playerS: number) {
    if (playerS > this.start + TUNNEL_LENGTH + 60) {
      this.start = nextTunnelStart(playerS);
      this.group.position.z = -this.start;
    }
  }

  /** 0 outside, 1 deep inside — used to blend lighting & audio. */
  insideFactor(playerS: number) {
    const a = clamp((playerS - this.start + 10) / 30, 0, 1);
    const b = clamp((this.start + TUNNEL_LENGTH + 10 - playerS) / 30, 0, 1);
    return Math.min(a, b);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
