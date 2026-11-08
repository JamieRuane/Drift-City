import * as THREE from 'three';
import {
  asphaltTexture, cobbleTexture, facadeTextures, glowTexture, grassTexture, pavingTexture, waterNormalTexture,
  type FacadeStyle,
} from './textures';

/**
 * Shared materials. Material keys are used by the chunked geometry builders; night-dependent values
 * (window lights, lamp glow, floodlit landmarks) are driven from `setNight`.
 */
export class Materials {
  readonly plain = new THREE.MeshLambertMaterial({ vertexColors: true });
  /** Landmarks: floodlit at night. */
  readonly lit = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(1, 0.72, 0.4), emissiveIntensity: 0 });
  /** Neon, lamps and screens: unlit, brighter at night. */
  readonly glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  /** Shop windows: warm emissive at night. */
  readonly shop = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(1, 0.78, 0.5), emissiveIntensity: 0 });
  readonly metal = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.35 });
  readonly asphalt = new THREE.MeshLambertMaterial({ vertexColors: true, map: asphaltTexture() });
  readonly paving = new THREE.MeshLambertMaterial({ vertexColors: true, map: pavingTexture() });
  readonly cobble = new THREE.MeshLambertMaterial({ vertexColors: true, map: cobbleTexture() });
  readonly grass = new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTexture() });
  readonly marking = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  readonly water: THREE.MeshStandardMaterial;
  readonly lightPool: THREE.MeshBasicMaterial;
  readonly facades = new Map<string, THREE.MeshLambertMaterial | THREE.MeshStandardMaterial>();
  private night = 0;

  constructor(waterColor: string) {
    const n = waterNormalTexture();
    this.water = new THREE.MeshStandardMaterial({
      color: waterColor,
      roughness: 0.22,
      metalness: 0.0,
      envMapIntensity: 0.55,
      normalMap: n,
      normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true,
      opacity: 0.92,
    });
    this.lightPool = new THREE.MeshBasicMaterial({
      map: glowTexture(),
      color: new THREE.Color(1, 0.75, 0.42),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
  }

  facade(style: FacadeStyle) {
    let m = this.facades.get(style);
    if (!m) {
      const t = facadeTextures(style);
      if (style === 'glass') {
        m = new THREE.MeshStandardMaterial({
          vertexColors: true, map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 0,
          metalness: 0.55, roughness: 0.22,
        });
      } else {
        m = new THREE.MeshLambertMaterial({ vertexColors: true, map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 0 });
      }
      this.facades.set(style, m);
    }
    return m;
  }

  /** Resolve a builder material key. Facade keys look like "facade:haussmann". */
  get(key: string): THREE.Material {
    if (key.startsWith('facade:')) return this.facade(key.slice(7) as FacadeStyle);
    const m = (this as unknown as Record<string, THREE.Material>)[key];
    if (!m) throw new Error(`Unknown material ${key}`);
    return m;
  }

  setNight(n: number, time: number) {
    this.night = n;
    for (const m of this.facades.values()) m.emissiveIntensity = n * 0.95;
    this.lit.emissiveIntensity = n * 0.22;
    this.shop.emissiveIntensity = 0.08 + n * 0.75;
    const g = 0.85 + n * 0.75;
    this.glow.color.setRGB(g, g, g);
    this.lightPool.opacity = n * 0.85;
    const tex = this.water.normalMap!;
    tex.offset.set(time * 0.012, time * 0.007);
  }

  get nightFactor() {
    return this.night;
  }

  dispose() {
    for (const m of [this.plain, this.lit, this.glow, this.shop, this.metal, this.asphalt, this.paving, this.cobble, this.grass, this.marking, this.water, this.lightPool])
      m.dispose();
    for (const m of this.facades.values()) m.dispose();
  }
}
