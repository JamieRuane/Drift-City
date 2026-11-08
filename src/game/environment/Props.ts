import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RecyclingRow } from './RecyclingRow';
import {
  BRIDGE_OFFSET, BRIDGE_PERIOD, GANTRY_OFFSET, GANTRY_PERIOD, inTunnel, STREETLIGHT_SPACING, VIEW_AHEAD, VIEW_BEHIND,
} from '../constants';
import { atlasPlane, createGantryAtlas } from './textures';

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
};

/** Streetlights, overhead gantries and bridges. All pooled and recycled with RecyclingRow. */
export class Props {
  readonly group = new THREE.Group();
  private dummy = new THREE.Object3D();
  private poleRight: THREE.InstancedMesh;
  private poleMedian: THREE.InstancedMesh;
  private lamps: THREE.InstancedMesh;
  private pools: THREE.InstancedMesh;
  private lightRow: RecyclingRow;
  private gantries: { group: THREE.Group; signs: THREE.Mesh[] }[] = [];
  private gantryRow: RecyclingRow;
  private gantrySignGeos: THREE.BufferGeometry[] = [];
  private bridges: THREE.Group[] = [];
  private bridgeRow: RecyclingRow;
  private lightDirty = false;
  private textures: THREE.Texture[] = [];

  constructor(glowTex: THREE.Texture) {
    const count = Math.ceil((VIEW_AHEAD + VIEW_BEHIND) / STREETLIGHT_SPACING) + 2;
    const metal = new THREE.MeshStandardMaterial({ color: '#3a3d4a', roughness: 0.4, metalness: 0.8 });

    const rightGeo = mergeGeometries([box(0.22, 9, 0.22, 0, 4.5, 0), box(3.2, 0.16, 0.2, -1.6, 9, 0)])!;
    const medianGeo = mergeGeometries([box(0.24, 9, 0.24, 0, 4.5, 0), box(6.2, 0.16, 0.2, 0, 9, 0)])!;
    this.poleRight = new THREE.InstancedMesh(rightGeo, metal, count);
    this.poleMedian = new THREE.InstancedMesh(medianGeo, metal, count);
    const lampGeo = box(0.9, 0.12, 0.38, 0, 0, 0);
    this.lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 1.6), toneMapped: false }), count * 3);
    const poolGeo = new THREE.PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);
    this.pools = new THREE.InstancedMesh(
      poolGeo,
      new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color('#ffb070').multiplyScalar(0.32), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
      count * 3,
    );
    for (const m of [this.poleRight, this.poleMedian, this.lamps, this.pools]) {
      m.frustumCulled = false;
      this.group.add(m);
    }

    this.lightRow = new RecyclingRow(count, STREETLIGHT_SPACING, 0, VIEW_BEHIND, (slot, s) => {
      const hidden = inTunnel(s, 8);
      const sc = hidden ? 0 : 1;
      const z = -s;
      this.set(this.poleRight, slot, 8.95, 0, z, sc);
      this.set(this.poleMedian, slot, -9.0, 0, -s - STREETLIGHT_SPACING / 2, sc);
      const lampPositions: [number, number][] = [[8.95 - 3.0, z], [-9.0 + 2.9, -s - STREETLIGHT_SPACING / 2], [-9.0 - 2.9, -s - STREETLIGHT_SPACING / 2]];
      lampPositions.forEach(([x, lz], k) => {
        this.set(this.lamps, slot * 3 + k, x, 8.94, lz, sc);
        this.dummy.position.set(x, 0.03, lz);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(11 * sc, 1, 13 * sc);
        this.dummy.updateMatrix();
        this.pools.setMatrixAt(slot * 3 + k, this.dummy.matrix);
      });
      this.lightDirty = true;
    });

    // gantries
    const gantryTex = createGantryAtlas();
    this.textures.push(gantryTex);
    for (let i = 0; i < 4; i++) this.gantrySignGeos.push(atlasPlane(6.4, 2.4, i % 2, Math.floor(i / 2), 2, 2));
    const signMat = new THREE.MeshStandardMaterial({ map: gantryTex, emissiveMap: gantryTex, emissive: new THREE.Color(0.55, 0.55, 0.55), roughness: 0.5 });
    const truss = mergeGeometries([
      box(0.4, 7.6, 0.4, 9.3, 3.8, 0), box(0.4, 7.6, 0.4, -9.0, 3.8, 0),
      box(18.7, 0.5, 0.5, 0.15, 7.4, 0), box(18.7, 0.3, 0.3, 0.15, 6.6, 0),
    ])!;
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(truss, metal));
      const signs: THREE.Mesh[] = [];
      for (const x of [-3.6, 3.6]) {
        const sm = new THREE.Mesh(this.gantrySignGeos[0], signMat);
        sm.position.set(x, 7.0, 0.3);
        g.add(sm);
        signs.push(sm);
      }
      const strip = new THREE.Mesh(box(18.7, 0.06, 0.06, 0.15, 7.68, 0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 2.2), toneMapped: false }));
      g.add(strip);
      this.group.add(g);
      this.gantries.push({ group: g, signs });
    }
    this.gantryRow = new RecyclingRow(2, GANTRY_PERIOD, GANTRY_OFFSET, VIEW_BEHIND, (slot, s, n) => {
      const gt = this.gantries[slot];
      gt.group.position.set(0, 0, -s);
      gt.group.visible = !inTunnel(s, 40) && Math.abs(((s - BRIDGE_OFFSET) % BRIDGE_PERIOD + BRIDGE_PERIOD) % BRIDGE_PERIOD) > 30;
      gt.signs[0].geometry = this.gantrySignGeos[((n % 4) + 4) % 4];
      gt.signs[1].geometry = this.gantrySignGeos[((n + 1) % 4 + 4) % 4];
    });

    // bridges / overpasses
    const concrete = new THREE.MeshStandardMaterial({ color: '#4a4c58', roughness: 0.8, metalness: 0.1 });
    const deckGeo = mergeGeometries([
      box(90, 1.6, 13, -5, 9.2, 0),
      box(90, 1.1, 0.35, -5, 10.5, 6.3), box(90, 1.1, 0.35, -5, 10.5, -6.3),
      box(1.6, 8.6, 6, 12.4, 4.3, 0), box(1.2, 8.6, 6, -9.0, 4.3, 0), box(1.6, 8.6, 6, -20.0, 4.3, 0),
    ])!;
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(deckGeo, concrete));
      const neonA = new THREE.Mesh(box(90, 0.12, 0.12, -5, 10.0, 6.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.3, 1.9), toneMapped: false }));
      const neonB = new THREE.Mesh(box(90, 0.12, 0.12, -5, 8.45, 6.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 2.4), toneMapped: false }));
      g.add(neonA, neonB);
      // underside lights
      const under = new THREE.InstancedMesh(box(1.4, 0.08, 0.5, 0, 0, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 2.0), toneMapped: false }), 6);
      [-15.8, -12.2, -5.4, -1.8, 1.8, 5.4].forEach((x, k) => {
        this.dummy.position.set(x, 8.36, 0);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        under.setMatrixAt(k, this.dummy.matrix);
      });
      g.add(under);
      this.group.add(g);
      this.bridges.push(g);
    }
    this.bridgeRow = new RecyclingRow(2, BRIDGE_PERIOD, BRIDGE_OFFSET, VIEW_BEHIND + 20, (slot, s) => {
      const b = this.bridges[slot];
      b.position.set(0, 0, -s);
      b.visible = !inTunnel(s, 40);
    });
  }

  private set(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sc: number) {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.set(sc, sc, sc);
    this.dummy.updateMatrix();
    m.setMatrixAt(i, this.dummy.matrix);
  }

  reset(playerS: number) {
    this.lightRow.reset(playerS);
    this.gantryRow.reset(playerS);
    this.bridgeRow.reset(playerS);
    this.flush();
  }

  update(playerS: number) {
    this.lightRow.update(playerS);
    this.gantryRow.update(playerS);
    this.bridgeRow.update(playerS);
    this.flush();
  }

  private flush() {
    if (!this.lightDirty) return;
    for (const m of [this.poleRight, this.poleMedian, this.lamps, this.pools]) m.instanceMatrix.needsUpdate = true;
    this.lightDirty = false;
  }

  dispose() {
    const geos = new Set<THREE.BufferGeometry>(this.gantrySignGeos);
    const mats = new Set<THREE.Material>();
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        mats.add(o.material as THREE.Material);
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
