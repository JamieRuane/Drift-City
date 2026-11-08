import * as THREE from 'three';
import { createRng, type Rng } from '../../utils/math';
import { BUILDING_LEFT_X, BUILDING_RIGHT_X, VIEW_AHEAD } from '../constants';
import { atlasPlane, BILLBOARD_CELLS, BLADE_COUNT, createBillboardAtlas, createBladeAtlas } from './textures';

const ACCENTS = ['#ff2bd6', '#00e5ff', '#b54dff', '#ff8a1a', '#3aa0ff', '#7dff3a', '#ff3355', '#ffe23a'].map((c) => new THREE.Color(c));

interface BuildingRow {
  side: 1 | -1;
  back: boolean;
  slots: { start: number; end: number }[];
  firstIdx: number;
  nextS: number;
}

interface SignPool {
  mesh: THREE.InstancedMesh;
  cursor: number;
}

/** Procedural night city: instanced buildings with shader-generated windows plus neon signage. */
export class City {
  readonly group = new THREE.Group();
  private buildings: THREE.InstancedMesh;
  private rows: BuildingRow[] = [];
  private rng: Rng = createRng(1);
  private dummy = new THREE.Object3D();
  private billboards: SignPool[] = [];
  private blades: SignPool[] = [];
  private textures: THREE.Texture[] = [];
  private dirty = false;

  constructor(quality: 'low' | 'medium' | 'high') {
    const frontCount = 40;
    const backCount = quality === 'low' ? 18 : 30;
    const total = (frontCount + backCount) * 2;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: '#191a26', roughness: 0.55, metalness: 0.35, envMapIntensity: 0.5 });
    mat.onBeforeCompile = (shader) => {
      const decl = 'varying vec3 vFacade;\nvarying vec3 vBNormal;\nvarying float vSeed;\nvarying float vHeight;\n';
      shader.vertexShader = decl + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 bScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vFacade = position * bScale;
        vBNormal = normal;
        vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        vHeight = bScale.y;`,
      );
      shader.fragmentShader = decl + 'float bHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        shader.fragmentShader
          .replace('#include <color_fragment>', '')
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            {
              vec3 an = abs(vBNormal);
              float wall = 1.0 - step(0.5, an.y);
              float u = an.x > 0.5 ? vFacade.z : vFacade.x;
              float v = vFacade.y;
              vec2 cellSize = vec2(1.6 + vSeed * 0.8, 3.2);
              vec2 id = floor(vec2(u, v) / cellSize);
              vec2 f = fract(vec2(u, v) / cellSize);
              float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.8);
              float r = bHash(id + vec2(vSeed * 91.7, an.x * 13.0));
              float lit = step(0.6 + vSeed * 0.25, r);
              vec3 warm = vec3(1.0, 0.68, 0.38);
              vec3 cool = vec3(0.45, 0.82, 1.0);
              vec3 wc = mix(warm, cool, step(0.68, bHash(id.yx + vSeed * 7.3)));
              wc = mix(wc, vColor.rgb, 0.25) * (0.55 + 0.6 * bHash(id * 1.7 + 3.1));
              float aboveGround = step(4.2, v);
              vec3 e = wc * lit * win * wall * aboveGround * 0.75;
              float band = wall * smoothstep(vHeight - 1.3, vHeight - 1.1, v) * (1.0 - smoothstep(vHeight - 0.7, vHeight - 0.5, v));
              float shop = wall * step(0.6, v) * step(v, 3.6) * step(0.08, f.x) * step(f.x, 0.92);
              float stripe = wall * step(0.985, fract(u / 9.0 + vSeed)) * step(4.0, v);
              e += vColor.rgb * (band * 2.4 + shop * 0.28 + stripe * 1.1);
              totalEmissiveRadiance += e;
            }`,
          );
    };
    this.buildings = new THREE.InstancedMesh(geo, mat, total);
    this.buildings.frustumCulled = false;
    this.buildings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3);
    this.group.add(this.buildings);

    let idx = 0;
    for (const side of [1, -1] as const) {
      for (const back of [false, true]) {
        const count = back ? backCount : frontCount;
        this.rows.push({ side, back, slots: new Array(count).fill(0).map(() => ({ start: 0, end: 0 })), firstIdx: idx, nextS: 0 });
        idx += count;
      }
    }

    // signs
    const bbTex = createBillboardAtlas();
    const bladeTex = createBladeAtlas();
    this.textures.push(bbTex, bladeTex);
    const bbMat = new THREE.MeshBasicMaterial({ map: bbTex, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false, side: THREE.DoubleSide });
    const bladeMat = new THREE.MeshBasicMaterial({ map: bladeTex, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false, side: THREE.DoubleSide });
    const cells = BILLBOARD_CELLS.cols * BILLBOARD_CELLS.rows;
    for (let i = 0; i < cells; i++) {
      const g = atlasPlane(13, 6.5, i % BILLBOARD_CELLS.cols, Math.floor(i / BILLBOARD_CELLS.cols), BILLBOARD_CELLS.cols, BILLBOARD_CELLS.rows);
      const m = new THREE.InstancedMesh(g, bbMat, 6);
      m.frustumCulled = false;
      this.hideAll(m);
      this.group.add(m);
      this.billboards.push({ mesh: m, cursor: 0 });
    }
    for (let i = 0; i < BLADE_COUNT; i++) {
      const g = atlasPlane(2.2, 8.8, i, 0, BLADE_COUNT, 1);
      const m = new THREE.InstancedMesh(g, bladeMat, 6);
      m.frustumCulled = false;
      this.hideAll(m);
      this.group.add(m);
      this.blades.push({ mesh: m, cursor: 0 });
    }
  }

  private hideAll(m: THREE.InstancedMesh) {
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < m.count; i++) m.setMatrixAt(i, this.dummy.matrix);
    this.dummy.scale.set(1, 1, 1);
    m.instanceMatrix.needsUpdate = true;
  }

  reset(playerS: number, seed: number) {
    this.rng = createRng(seed);
    for (const p of [...this.billboards, ...this.blades]) this.hideAll(p.mesh);
    for (const row of this.rows) {
      row.nextS = playerS - 60;
      for (let i = 0; i < row.slots.length; i++) this.placeBuilding(row, i);
    }
    this.flush();
  }

  private placeBuilding(row: BuildingRow, slot: number) {
    const r = this.rng;
    const len = row.back ? r.range(16, 40) : r.range(10, 26);
    const gap = row.back ? r.range(2, 10) : r.range(0.6, 4);
    const depth = row.back ? r.range(18, 40) : r.range(12, 26);
    let height = row.back ? r.range(45, 170) : r.range(10, 62);
    if (!row.back && r.chance(0.12)) height *= 1.8;
    const start = row.nextS;
    const s = start + len / 2;
    row.nextS += len + gap;
    row.slots[slot] = { start, end: start + len };

    const baseX = row.side > 0 ? BUILDING_RIGHT_X : BUILDING_LEFT_X;
    const setback = row.back ? 34 + r.range(0, 30) : r.range(0, 3);
    const x = baseX + row.side * (setback + depth / 2);
    this.dummy.position.set(x, 0, -s);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.set(depth, height, len);
    this.dummy.updateMatrix();
    const idx = row.firstIdx + slot;
    this.buildings.setMatrixAt(idx, this.dummy.matrix);
    this.buildings.setColorAt(idx, r.pick(ACCENTS));
    this.dirty = true;

    if (!row.back) {
      const faceX = baseX + row.side * setback;
      if (r.chance(0.32) && height < 70) {
        const pool = r.pick(this.billboards);
        this.dummy.position.set(faceX + row.side * 3.5, height + 3.6, -s);
        this.dummy.rotation.set(0, row.side > 0 ? -0.55 : 0.55, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        pool.mesh.setMatrixAt(pool.cursor, this.dummy.matrix);
        pool.cursor = (pool.cursor + 1) % pool.mesh.count;
        pool.mesh.instanceMatrix.needsUpdate = true;
      }
      if (r.chance(0.42) && height > 14) {
        const pool = r.pick(this.blades);
        this.dummy.position.set(faceX - row.side * 1.3, r.range(7, Math.min(height - 5, 22)), -(start + len - 1));
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        pool.mesh.setMatrixAt(pool.cursor, this.dummy.matrix);
        pool.cursor = (pool.cursor + 1) % pool.mesh.count;
        pool.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  update(playerS: number) {
    const behind = playerS - 50;
    for (const row of this.rows) {
      if (row.nextS > playerS + VIEW_AHEAD + 200) continue;
      for (let i = 0; i < row.slots.length; i++) {
        if (row.slots[i].end < behind) this.placeBuilding(row, i);
      }
    }
    this.flush();
  }

  private flush() {
    if (!this.dirty) return;
    this.buildings.instanceMatrix.needsUpdate = true;
    if (this.buildings.instanceColor) this.buildings.instanceColor.needsUpdate = true;
    this.dirty = false;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.textures.forEach((t) => t.dispose());
  }
}
