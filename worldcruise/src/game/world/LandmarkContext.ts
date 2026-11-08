import * as THREE from 'three';
import type { GeometryBuilder } from './GeometryBuilder';
import type { CityLayout, Rect } from './CityLayout';
import type { Materials } from './Materials';
import type { CityDefinition } from '../cities/types';
import type { Rng } from '../core/rng';

export type ColliderDesc =
  | { kind: 'box'; x: number; y: number; z: number; hx: number; hy: number; hz: number; ry: number }
  | { kind: 'cyl'; x: number; y: number; z: number; r: number; hh: number };

export type TreeKind = 'round' | 'plane' | 'cherry' | 'conifer' | 'palm';
export interface TreeInstance {
  x: number;
  z: number;
  y: number;
  s: number;
  kind: TreeKind;
}

export interface Animated {
  update(time: number, dt: number, night: number): void;
}

/**
 * Everything a landmark builder needs. Builders work in a local frame centred on the landmark
 * (y = 0 is street level). `b(material)` returns a geometry builder already transformed into that frame.
 */
export class LandmarkContext {
  readonly cos: number;
  readonly sin: number;
  constructor(
    public readonly x: number,
    public readonly z: number,
    public readonly rotation: number,
    /** Local half extents of the area (after rotation). */
    public readonly hw: number,
    public readonly hd: number,
    public readonly rect: Rect,
    public readonly layout: CityLayout,
    public readonly def: CityDefinition,
    public readonly mats: Materials,
    public readonly rng: Rng,
    private readonly getBuilder: (mat: string) => GeometryBuilder,
    private readonly colliders: ColliderDesc[],
    private readonly trees: TreeInstance[],
    public readonly group: THREE.Group,
    private readonly animated: Animated[],
    private readonly lampsOut: { x: number; z: number }[],
  ) {
    this.cos = Math.cos(rotation);
    this.sin = Math.sin(rotation);
  }

  private opened = new Map<string, GeometryBuilder>();

  /** Builder for a material key ("plain", "lit", "glow", "metal", "shop", "facade:stone", ...). */
  b(mat = 'lit'): GeometryBuilder {
    let g = this.opened.get(mat);
    if (!g) {
      g = this.getBuilder(mat);
      g.push(this.x, 0, this.z, this.rotation);
      this.opened.set(mat, g);
    }
    return g;
  }

  /** Must be called once the landmark is complete (restores builder transforms). */
  finish() {
    for (const g of this.opened.values()) g.pop();
    this.opened.clear();
  }

  /** Local → world. */
  world(lx: number, lz: number) {
    // Rotation about Y by θ: x' = x cosθ + z sinθ, z' = -x sinθ + z cosθ
    return { x: this.x + lx * this.cos + lz * this.sin, z: this.z - lx * this.sin + lz * this.cos };
  }

  box(lx: number, ly: number, lz: number, hx: number, hy: number, hz: number, ry = 0) {
    const w = this.world(lx, lz);
    this.colliders.push({ kind: 'box', x: w.x, y: ly, z: w.z, hx, hy, hz, ry: ry + this.rotation });
  }

  cyl(lx: number, ly: number, lz: number, r: number, hh: number) {
    const w = this.world(lx, lz);
    this.colliders.push({ kind: 'cyl', x: w.x, y: ly, z: w.z, r, hh });
  }

  tree(lx: number, lz: number, s = 1, kind: TreeKind = this.def.treeKind, y = 0) {
    const w = this.world(lx, lz);
    this.trees.push({ x: w.x, z: w.z, y, s, kind });
    this.colliders.push({ kind: 'cyl', x: w.x, y: y + 2, z: w.z, r: 0.35 * s, hh: 2 });
  }

  lamp(lx: number, lz: number) {
    this.lampsOut.push(this.world(lx, lz));
  }

  /** Adds a dynamic object positioned in the landmark's local frame. */
  object(obj: THREE.Object3D, lx: number, ly: number, lz: number, ry = 0) {
    const w = this.world(lx, lz);
    obj.position.set(w.x, ly, w.z);
    obj.rotation.y = this.rotation + ry;
    this.group.add(obj);
    return obj;
  }

  animate(a: Animated) {
    this.animated.push(a);
  }
}
