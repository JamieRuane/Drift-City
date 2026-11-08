import * as THREE from 'three';
import { createSkylineTexture } from './textures';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;

const skyFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHorizon;
varying vec3 vDir;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  float h = vDir.y;
  vec3 col = mix(uHorizon, uMid, smoothstep(-0.02, 0.18, h));
  col = mix(col, uTop, smoothstep(0.18, 0.75, h));
  // city light pollution glow near the horizon
  col += vec3(0.55, 0.12, 0.45) * pow(1.0 - abs(h), 14.0) * 0.55;
  // stars
  vec3 sp = floor(vDir * 420.0);
  float star = step(0.9965, hash(sp)) * smoothstep(0.12, 0.5, h);
  float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(sp + 1.0) * 30.0);
  col += vec3(star * tw * 0.9);
  // moon
  vec3 moonDir = normalize(vec3(-0.35, 0.32, -0.88));
  float md = dot(vDir, moonDir);
  col += vec3(0.85, 0.82, 1.0) * smoothstep(0.9993, 0.9996, md) * 1.6;
  col += vec3(0.35, 0.3, 0.6) * pow(max(md, 0.0), 600.0) * 0.8;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Night sky dome + distant skyline ring. Follows the camera so it always appears infinitely far away. */
export class Sky {
  readonly group = new THREE.Group();
  private material: THREE.ShaderMaterial;
  private skylineTex: THREE.Texture;
  private tunnelFactor = 0;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        uTime: { value: 0 },
        uTop: { value: new THREE.Color('#05030f') },
        uMid: { value: new THREE.Color('#1a0b3a') },
        uHorizon: { value: new THREE.Color('#4a1450') },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), this.material);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.group.add(dome);

    this.skylineTex = createSkylineTexture();
    this.skylineTex.repeat.set(3, 1);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(1200, 1200, 360, 48, 1, true),
      new THREE.MeshBasicMaterial({ map: this.skylineTex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    ring.position.y = 120;
    ring.renderOrder = -9;
    ring.frustumCulled = false;
    this.group.add(ring);
  }

  update(dt: number, camera: THREE.Camera, tunnel: number) {
    this.material.uniforms.uTime.value += dt;
    this.group.position.copy(camera.position);
    this.tunnelFactor = tunnel;
    this.group.visible = this.tunnelFactor < 0.98;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.skylineTex.dispose();
  }
}

/** Builds a neon-city environment map used for car paint and wet-road reflections. */
export function createCityEnvMap(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const bg = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `varying vec3 vP; void main(){ float h = vP.y; vec3 c = mix(vec3(0.16,0.05,0.2), vec3(0.02,0.015,0.06), smoothstep(-0.1,0.6,h)); c = mix(vec3(0.03,0.03,0.04), c, smoothstep(-0.25,0.0,h)); gl_FragColor = vec4(c,1.); }`,
    }),
  );
  scene.add(bg);
  const panel = (color: string, intensity: number, pos: [number, number, number], size: [number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel('#ff2bd6', 3, [-20, 6, -10], [6, 18]);
  panel('#00e5ff', 3, [20, 8, -14], [5, 22]);
  panel('#b54dff', 2.5, [-14, 10, 22], [10, 6]);
  panel('#ff8a1a', 2.2, [16, 4, 18], [8, 4]);
  panel('#ffffff', 4, [0, 30, 0], [30, 4]);
  panel('#3aa0ff', 2, [0, 6, -30], [24, 3]);
  panel('#ff3355', 2, [0, 5, 30], [20, 3]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return rt;
}
