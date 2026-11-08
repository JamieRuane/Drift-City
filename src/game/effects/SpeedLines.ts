import * as THREE from 'three';

const COUNT = 70;

/** Streaks rushing past the camera at high speed. Positioned in camera-relative space. */
export class SpeedLines {
  readonly mesh: THREE.InstancedMesh;
  private z = new Float32Array(COUNT);
  private ang = new Float32Array(COUNT);
  private rad = new Float32Array(COUNT);
  private len = new Float32Array(COUNT);
  private dummy = new THREE.Object3D();
  private material: THREE.MeshBasicMaterial;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ color: '#bfe9ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.025, 1), this.material, COUNT);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < COUNT; i++) this.respawn(i, -Math.random() * 70);
  }

  private respawn(i: number, z: number) {
    this.z[i] = z;
    this.ang[i] = Math.random() * Math.PI * 2;
    this.rad[i] = 2.5 + Math.random() * 6;
    this.len[i] = 3 + Math.random() * 6;
  }

  update(dt: number, camera: THREE.Camera, speed: number, intensity: number) {
    this.material.opacity = intensity * 0.38;
    this.mesh.visible = intensity > 0.01;
    if (!this.mesh.visible) return;
    const cp = camera.position;
    for (let i = 0; i < COUNT; i++) {
      this.z[i] += speed * 1.4 * dt;
      if (this.z[i] > 6) this.respawn(i, -70 - Math.random() * 10);
      const x = Math.cos(this.ang[i]) * this.rad[i];
      const y = Math.sin(this.ang[i]) * this.rad[i] * 0.6 + 1.2;
      this.dummy.position.set(cp.x + x, Math.max(0.3, cp.y + y - 1.5), cp.z + this.z[i]);
      this.dummy.scale.set(1, 1, this.len[i] * (0.5 + intensity));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
