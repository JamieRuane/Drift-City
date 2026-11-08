import * as THREE from 'three';
import { glowTexture } from './textures';

/** Tyre skid marks (ring buffer of ground quads) and tyre smoke / boost puffs (instanced billboards). */
export class Effects {
  readonly group = new THREE.Group();
  private skidGeo: THREE.BufferGeometry;
  private skidPos: Float32Array;
  private skidAlpha: Float32Array;
  private skidIdx = 0;
  private readonly MAX = 900;
  private last: (THREE.Vector3 | null)[] = [null, null];
  private smoke: THREE.InstancedMesh;
  private parts: { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; s: number; boost: boolean }[] = [];
  private smokeIdx = 0;
  private readonly SMOKE = 90;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();

  constructor() {
    this.skidGeo = new THREE.BufferGeometry();
    this.skidPos = new Float32Array(this.MAX * 6 * 3);
    this.skidAlpha = new Float32Array(this.MAX * 6);
    this.skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.skidGeo.setAttribute('alpha', new THREE.BufferAttribute(this.skidAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.05,0.05,0.06, vA * 0.55); }',
    });
    const skid = new THREE.Mesh(this.skidGeo, mat);
    skid.frustumCulled = false;
    skid.renderOrder = 1;
    this.group.add(skid);

    this.smoke = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.55 }),
      this.SMOKE,
    );
    this.smoke.frustumCulled = false;
    this.smoke.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.SMOKE * 3), 3);
    for (let i = 0; i < this.SMOKE; i++) {
      this.parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, s: 1, boost: false });
      this.m.makeScale(0, 0, 0);
      this.smoke.setMatrixAt(i, this.m);
    }
    this.group.add(this.smoke);
  }

  /** wheelPos: world positions of the two rear contact points. */
  skid(wheelPos: THREE.Vector3[], intensity: number) {
    for (let w = 0; w < 2; w++) {
      const p = wheelPos[w];
      if (intensity < 0.25) {
        this.last[w] = null;
        continue;
      }
      const prev = this.last[w];
      if (prev && prev.distanceToSquared(p) > 0.09) {
        const dx = p.x - prev.x, dz = p.z - prev.z;
        const l = Math.hypot(dx, dz);
        if (l < 4) {
          const nx = (-dz / l) * 0.14, nz = (dx / l) * 0.14;
          const i = this.skidIdx;
          const y = 0.03;
          const v = [
            prev.x - nx, y, prev.z - nz, p.x - nx, y, p.z - nz, p.x + nx, y, p.z + nz,
            prev.x - nx, y, prev.z - nz, p.x + nx, y, p.z + nz, prev.x + nx, y, prev.z + nz,
          ];
          this.skidPos.set(v, i * 18);
          this.skidAlpha.fill(Math.min(1, intensity * 1.2), i * 6, i * 6 + 6);
          this.skidIdx = (i + 1) % this.MAX;
          (this.skidGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          (this.skidGeo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
        }
        this.last[w] = p.clone();
      } else if (!prev) this.last[w] = p.clone();
    }
  }

  puff(p: THREE.Vector3, v: THREE.Vector3, boost: boolean) {
    const s = this.parts[this.smokeIdx];
    this.smokeIdx = (this.smokeIdx + 1) % this.SMOKE;
    s.p.copy(p);
    s.v.copy(v);
    s.life = 0;
    s.max = boost ? 0.35 : 1.4;
    s.s = boost ? 0.7 : 1.2;
    s.boost = boost;
  }

  update(dt: number, cam: THREE.Camera, night: number) {
    for (let i = 0; i < this.SMOKE; i++) {
      const s = this.parts[i];
      if (s.life >= s.max) {
        this.m.makeScale(0, 0, 0);
        this.smoke.setMatrixAt(i, this.m);
        continue;
      }
      s.life += dt;
      s.p.addScaledVector(s.v, dt);
      s.v.multiplyScalar(1 - dt * 1.5);
      s.v.y += dt * 0.8;
      const k = s.life / s.max;
      const size = s.s * (1 + k * (s.boost ? 0.5 : 3));
      this.m.compose(s.p, cam.quaternion, new THREE.Vector3(size, size, size));
      this.smoke.setMatrixAt(i, this.m);
      const fade = (1 - k) * (s.boost ? 1.4 : 0.8);
      if (s.boost) this.c.setRGB(0.4 * fade + 0.9, 0.6 * fade, 1.0 * fade);
      else {
        const g = (0.75 - night * 0.45) * fade;
        this.c.setRGB(g, g, g);
      }
      this.smoke.setColorAt(i, this.c);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
    this.smoke.instanceColor!.needsUpdate = true;
  }

  clear() {
    this.skidAlpha.fill(0);
    (this.skidGeo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    this.last = [null, null];
  }

  dispose() {
    this.group.removeFromParent();
    this.skidGeo.dispose();
  }
}
