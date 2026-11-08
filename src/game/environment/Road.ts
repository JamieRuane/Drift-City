import * as THREE from 'three';
import { createRoadTextures, createSidewalkTexture, ROAD_TEX_W, ROAD_TEX_X0, ROAD_TILE_LEN } from './textures';
import { BARRIER_X, MEDIAN_LEFT, ONCOMING_OUTER } from '../constants';
import { RecyclingRow } from './RecyclingRow';

const ROAD_LEN = 760;
const ROAD_Z_NEAR = 60; // road extends this far behind the camera

/**
 * The carriageways are single long planes fixed under the player whose textures scroll with distance.
 * Barriers are long static boxes; reflector studs and neon strips are world-anchored instances so the
 * player gets strong motion cues.
 */
export class Road {
  readonly group = new THREE.Group();
  readonly worldProps = new THREE.Group();
  private roadTex: { map: THREE.Texture; roughnessMap: THREE.Texture };
  private sidewalkTex: THREE.Texture;
  private studs: THREE.InstancedMesh;
  private studRow: RecyclingRow;
  private disposables: { dispose(): void }[] = [];
  private dummy = new THREE.Object3D();

  constructor(anisotropy: number) {
    this.roadTex = createRoadTextures(anisotropy);
    this.roadTex.map.repeat.set(1, ROAD_LEN / ROAD_TILE_LEN);
    this.roadTex.roughnessMap.repeat.set(1, ROAD_LEN / ROAD_TILE_LEN);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTex.map,
      roughnessMap: this.roadTex.roughnessMap,
      roughness: 1,
      metalness: 0.15,
      envMapIntensity: 0.9,
    });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_TEX_W, ROAD_LEN), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(ROAD_TEX_X0 + ROAD_TEX_W / 2, 0, ROAD_Z_NEAR - ROAD_LEN / 2);
    this.group.add(road);

    this.sidewalkTex = createSidewalkTexture(anisotropy);
    this.sidewalkTex.repeat.set(2, ROAD_LEN / 4);
    const swMat = new THREE.MeshStandardMaterial({ map: this.sidewalkTex, roughness: 0.75, metalness: 0.05 });
    const mkSidewalk = (x0: number, x1: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.25, ROAD_LEN), swMat);
      m.position.set((x0 + x1) / 2, 0.12, ROAD_Z_NEAR - ROAD_LEN / 2);
      // top face is the only one that matters; rotate uvs by using box defaults
      this.group.add(m);
    };
    mkSidewalk(8.8, 15.5);
    mkSidewalk(-25.5, -18.4);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, ROAD_LEN), new THREE.MeshStandardMaterial({ color: '#0a0910', roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, ROAD_Z_NEAR - ROAD_LEN / 2);
    this.group.add(ground);

    // barriers
    const concrete = new THREE.MeshStandardMaterial({ color: '#5a5c66', roughness: 0.7, metalness: 0.1 });
    const barrierGeo = new THREE.BoxGeometry(0.45, 0.85, ROAD_LEN);
    for (const x of [BARRIER_X, -BARRIER_X, MEDIAN_LEFT, ONCOMING_OUTER]) {
      const b = new THREE.Mesh(barrierGeo, concrete);
      b.position.set(x, 0.425, ROAD_Z_NEAR - ROAD_LEN / 2);
      this.group.add(b);
    }
    // median infill
    const median = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(MEDIAN_LEFT + BARRIER_X) - 0.4, 0.3, ROAD_LEN), new THREE.MeshStandardMaterial({ color: '#1d2a22', roughness: 0.95 }));
    median.position.set((MEDIAN_LEFT - BARRIER_X) / 2, 0.15, ROAD_Z_NEAR - ROAD_LEN / 2);
    this.group.add(median);

    // neon strips on top of the barriers
    const stripGeo = new THREE.BoxGeometry(0.08, 0.06, ROAD_LEN);
    const mkStrip = (x: number, color: string) => {
      const m = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false }));
      m.position.set(x, 0.88, ROAD_Z_NEAR - ROAD_LEN / 2);
      this.group.add(m);
    };
    mkStrip(BARRIER_X - 0.12, '#00e5ff');
    mkStrip(-BARRIER_X + 0.12, '#ff2bd6');
    mkStrip(ONCOMING_OUTER + 0.12, '#b54dff');

    // reflector studs on barrier faces — strong motion cue
    const STUD_SPACING = 6;
    const studCount = Math.ceil(ROAD_LEN / STUD_SPACING) + 4;
    this.studs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.05, 0.12, 0.5),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb340').multiplyScalar(1.6), toneMapped: false }),
      studCount * 2,
    );
    this.studs.frustumCulled = false;
    this.studRow = new RecyclingRow(studCount, STUD_SPACING, 0, ROAD_Z_NEAR, (slot, s) => {
      this.dummy.position.set(BARRIER_X - 0.24, 0.55, -s);
      this.dummy.updateMatrix();
      this.studs.setMatrixAt(slot * 2, this.dummy.matrix);
      this.dummy.position.set(-BARRIER_X + 0.24, 0.55, -s);
      this.dummy.updateMatrix();
      this.studs.setMatrixAt(slot * 2 + 1, this.dummy.matrix);
    });
    this.worldProps.add(this.studs);

    this.disposables.push(barrierGeo, concrete, stripGeo, this.roadTex.map, this.roadTex.roughnessMap, this.sidewalkTex);
  }

  reset(playerS: number) {
    this.studRow.reset(playerS);
    this.studs.instanceMatrix.needsUpdate = true;
    this.update(playerS);
  }

  update(playerS: number) {
    const off = (playerS / ROAD_TILE_LEN) % 1;
    this.roadTex.map.offset.y = off;
    this.roadTex.roughnessMap.offset.y = off;
    this.sidewalkTex.offset.y = (playerS / 4) % 1;
    if (this.studRow.update(playerS)) this.studs.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const g of [this.group, this.worldProps]) g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material as THREE.Material;
        m.dispose();
      }
    });
    this.disposables.forEach((d) => d.dispose());
  }
}
