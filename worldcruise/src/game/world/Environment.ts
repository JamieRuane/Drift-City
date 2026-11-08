import * as THREE from 'three';
import { clamp, smoothstep } from '../core/rng';
import { GeometryBuilder } from './GeometryBuilder';

interface Key {
  h: number;
  top: string;
  hor: string;
  sun: string;
  sunI: number;
  sky: string;
  gnd: string;
  hemiI: number;
}

const KEYS: Key[] = [
  { h: 0, top: '#070c22', hor: '#232c58', sun: '#9fb4ff', sunI: 0.5, sky: '#5367a3', gnd: '#2a2f40', hemiI: 0.95 },
  { h: 4.8, top: '#0d1233', hor: '#2f3462', sun: '#9fb4ff', sunI: 0.45, sky: '#55689e', gnd: '#2a2e3c', hemiI: 0.9 },
  { h: 5.9, top: '#2a3b78', hor: '#d8846c', sun: '#ff9566', sunI: 0.6, sky: '#7c84b8', gnd: '#4a3e3c', hemiI: 0.6 },
  { h: 7.0, top: '#4f86d0', hor: '#ffc28c', sun: '#ffbd85', sunI: 1.9, sky: '#a8c2ec', gnd: '#6d604f', hemiI: 0.75 },
  { h: 9.5, top: '#3d86e2', hor: '#c3e2ff', sun: '#fff1da', sunI: 2.7, sky: '#bcd8ff', gnd: '#8b7c66', hemiI: 0.85 },
  { h: 13, top: '#3784e4', hor: '#cbe7ff', sun: '#ffffff', sunI: 2.9, sky: '#c3dcff', gnd: '#8f826c', hemiI: 0.9 },
  { h: 16.5, top: '#4a82d4', hor: '#ffd9ab', sun: '#ffdca6', sunI: 2.5, sky: '#bfd2f2', gnd: '#8c7a62', hemiI: 0.8 },
  { h: 18.4, top: '#3e4d8c', hor: '#ff9663', sun: '#ff8048', sunI: 1.5, sky: '#9a8fc0', gnd: '#5e4a44', hemiI: 0.65 },
  { h: 19.4, top: '#1d2556', hor: '#a85a6a', sun: '#ff6a4a', sunI: 0.45, sky: '#6464a0', gnd: '#34303c', hemiI: 0.8 },
  { h: 20.6, top: '#0a1030', hor: '#2c2a58', sun: '#9fb4ff', sunI: 0.45, sky: '#5367a3', gnd: '#2a2f40', hemiI: 0.9 },
  { h: 24, top: '#070c22', hor: '#232c58', sun: '#9fb4ff', sunI: 0.5, sky: '#5367a3', gnd: '#2a2f40', hemiI: 0.95 },
];

const c1 = new THREE.Color(), c2 = new THREE.Color();
function lerpKey(h: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  const mix = (x: string, y: string) => c1.set(x).lerp(c2.set(y), t).clone();
  return {
    top: mix(a.top, b.top), hor: mix(a.hor, b.hor), sun: mix(a.sun, b.sun), sky: mix(a.sky, b.sky), gnd: mix(a.gnd, b.gnd),
    sunI: a.sunI + (b.sunI - a.sunI) * t, hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
  };
}

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const skyFrag = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight; uniform float uTime;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uHor * 0.85, smoothstep(0.0, -0.25, h));
  float s = max(dot(d, uSunDir), 0.0);
  float above = smoothstep(-0.08, 0.05, uSunDir.y);
  col += uSunCol * (pow(s, 6.0) * 0.28 + pow(s, 64.0) * 0.5) * above;
  col += uSunCol * smoothstep(0.9993, 0.9997, s) * 2.0 * above;
  // moon
  float m = max(dot(d, -uSunDir), 0.0);
  col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9995, 0.9998, m) * uNight * 1.4;
  col += vec3(0.4, 0.5, 0.8) * pow(m, 30.0) * 0.12 * uNight;
  // stars
  if (h > 0.0) {
    vec3 sp = floor(d * 260.0);
    float st = hash(sp);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + st * 40.0);
    col += vec3(step(0.9965, st) * tw * uNight * smoothstep(0.0, 0.3, h));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/**
 * Day/night cycle: sky dome, sun/moon light with shadows that follow the player, hemisphere fill,
 * fog, drifting low-poly clouds and an environment map for reflective materials.
 */
export class Environment {
  readonly sun = new THREE.DirectionalLight(0xffffff, 2.5);
  readonly hemi = new THREE.HemisphereLight(0xbcd8ff, 0x8b7c66, 0.8);
  readonly sky: THREE.Mesh;
  readonly skyMat: THREE.ShaderMaterial;
  readonly clouds: THREE.InstancedMesh;
  readonly fog = new THREE.Fog(0xcbe7ff, 160, 1100);
  hour = 12;
  night = 0;
  private cloudData: { x: number; y: number; z: number; s: number; r: number }[] = [];
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envScene = new THREE.Scene();
  private lastEnvHour = -10;
  private sunDir = new THREE.Vector3();
  private cloudMat: THREE.MeshLambertMaterial;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer) {
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, depthTest: true,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.skyMat);
    this.sky.scale.setScalar(2500);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), this.skyMat));

    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 600;
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.fog = this.fog;

    // clouds
    const b = new GeometryBuilder();
    const puffs = [[0, 0, 0, 14], [12, -2, 3, 10], [-12, -3, -2, 11], [5, 4, 4, 9], [-5, 3, -4, 9], [20, -4, -3, 7], [-20, -5, 2, 7]];
    for (const [x, y, z, r] of puffs) b.sphere(x, y, z, r, '#ffffff', 1, r * 0.75);
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, flatShading: true, fog: false, transparent: true, opacity: 0.95 });
    const N = 34;
    this.clouds = new THREE.InstancedMesh(b.build(), this.cloudMat, N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 200 + Math.random() * 900;
      this.cloudData.push({ x: Math.cos(a) * r, y: 190 + Math.random() * 120, z: Math.sin(a) * r, s: 1 + Math.random() * 1.8, r: Math.random() * 6 });
    }
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  setShadowQuality(size: number) {
    this.sun.castShadow = size > 0;
    if (size > 0 && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  setFogRange(near: number, far: number) {
    this.fog.near = near;
    this.fog.far = far;
  }

  update(hour: number, time: number, dt: number, focus: THREE.Vector3, camPos: THREE.Vector3) {
    this.hour = ((hour % 24) + 24) % 24;
    const k = lerpKey(this.hour);
    const a = ((this.hour - 6) / 12) * Math.PI;
    const elev = Math.sin(a);
    this.sunDir.set(Math.cos(a) * 0.85, elev, 0.42).normalize();
    this.night = 1 - smoothstep(-0.1, 0.16, elev);

    const u = this.skyMat.uniforms;
    u.uTop.value.copy(k.top);
    u.uHor.value.copy(k.hor);
    u.uSunDir.value.copy(this.sunDir);
    u.uSunCol.value.copy(k.sun);
    u.uNight.value = this.night;
    u.uTime.value = time;
    this.sky.position.copy(camPos);

    // light: sun by day, moon by night
    const lightDir = elev > -0.05 ? this.sunDir : this.sunDir.clone().negate();
    if (lightDir.y < 0.12) lightDir.y = 0.12;
    this.sun.color.copy(k.sun);
    this.sun.intensity = k.sunI;
    // texel-snapped shadow frustum around the player
    const snap = 150 / (this.sun.shadow.mapSize.x || 1024);
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + lightDir.x * 250, lightDir.y * 250, fz + lightDir.z * 250);
    this.sun.target.updateMatrixWorld();
    this.hemi.color.copy(k.sky);
    this.hemi.groundColor.copy(k.gnd);
    this.hemi.intensity = k.hemiI;
    this.fog.color.copy(k.hor).lerp(k.top, 0.15);

    // clouds
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.cloudData.forEach((c, i) => {
      c.x += dt * 4;
      if (c.x > 1100) c.x -= 2200;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.r);
      m.compose(p.set(c.x, c.y, c.z), q, s.set(c.s, c.s * 0.8, c.s));
      this.clouds.setMatrixAt(i, m);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
    this.cloudMat.color.copy(k.sun).lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.55 + (1 - this.night) * 0.45);
    this.cloudMat.emissive.copy(k.hor).multiplyScalar(0.6);
    this.cloudMat.opacity = 0.95 - this.night * 0.45;

    // environment map refresh
    if (Math.abs(this.hour - this.lastEnvHour) > 0.35) {
      this.lastEnvHour = this.hour;
      const old = this.envRT;
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 100);
      this.scene.environment = this.envRT.texture;
      this.scene.environmentIntensity = 0.5 + (1 - this.night) * 0.5;
      old?.dispose();
    }
  }

  dispose() {
    this.envRT?.dispose();
    this.pmrem.dispose();
  }
}
