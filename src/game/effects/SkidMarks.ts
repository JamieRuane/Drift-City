import * as THREE from 'three';

const CAP = 700;

/** Ring buffer of road-decal quads laid behind the rear tyres while drifting or braking hard. */
export class SkidMarks {
  readonly mesh: THREE.InstancedMesh;
  private cursor = 0;
  private last: ({ x: number; s: number } | null)[] = [null, null];
  private dummy = new THREE.Object3D();

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#050507', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.mesh = new THREE.InstancedMesh(geo, mat, CAP);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.clear();
  }

  clear() {
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < CAP; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.last = [null, null];
  }

  /** Call every frame with the world positions of the rear tyres; `active` false lifts the "pen". */
  track(wheel: 0 | 1, x: number, s: number, active: boolean) {
    if (!active) {
      this.last[wheel] = null;
      return;
    }
    const prev = this.last[wheel];
    if (!prev) {
      this.last[wheel] = { x, s };
      return;
    }
    const dx = x - prev.x, ds = s - prev.s;
    const len = Math.hypot(dx, ds);
    if (len < 0.7) return;
    this.dummy.position.set((x + prev.x) / 2, 0.015, -(s + prev.s) / 2);
    this.dummy.rotation.set(0, Math.atan2(-dx, ds), 0);
    this.dummy.scale.set(0.24, 1, len + 0.05);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(this.cursor, this.dummy.matrix);
    this.cursor = (this.cursor + 1) % CAP;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.last[wheel] = { x, s };
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
