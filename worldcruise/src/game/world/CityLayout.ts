import type { AreaDef, CityDefinition, Dir } from '../cities/types';

/**
 * Turns a data-driven CityDefinition into concrete geometry: road graph, block rectangles, areas and water.
 *
 * The road graph (nodes + straight edges) is deliberately generic: rendering, traffic, the minimap and
 * route finding only consume RoadNode/RoadEdge, so a future importer could build the same structure from
 * OpenStreetMap ways instead of the grid generator below.
 */

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface RoadNode {
  id: number;
  i: number;
  j: number;
  x: number;
  z: number;
  /** Half extents of the intersection square. */
  hx: number;
  hz: number;
  edges: number[];
  hasLight: boolean;
}

export interface RoadEdge {
  id: number;
  a: number;
  b: number;
  width: number;
  length: number;
  /** Unit direction from a to b. */
  dx: number;
  dz: number;
  bridge: boolean;
  /** True when a water body is on one side. */
  quay: boolean;
}

export interface Region {
  rect: Rect;
  kind: 'block' | 'park' | 'plaza' | 'landmark';
  area?: AreaDef;
  /** Grid cells covered. */
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

export interface WaterRun {
  rect: Rect;
  row: number;
}

export const SIDEWALK = 4.5;
export const CURB_H = 0.16;

export class CityLayout {
  readonly cols: number;
  readonly rows: number;
  readonly pitch: number;
  readonly nodes: RoadNode[] = [];
  readonly edges: RoadEdge[] = [];
  readonly regions: Region[] = [];
  readonly water: WaterRun[] = [];
  readonly bounds: Rect;
  /** Playable boundary (walls). */
  readonly wall: Rect;
  private nodeIndex = new Map<string, number>();
  private cellArea: (AreaDef | null)[][];

  constructor(public def: CityDefinition) {
    const { cols, rows, block, road } = def.grid;
    this.cols = cols;
    this.rows = rows;
    this.pitch = block + road;

    this.cellArea = [];
    for (let c = 0; c < cols; c++) {
      this.cellArea.push(new Array(rows).fill(null));
    }
    for (const a of def.areas) {
      for (let c = a.c0; c <= (a.c1 ?? a.c0); c++)
        for (let r = a.r0; r <= (a.r1 ?? a.r0); r++) if (this.inGrid(c, r)) this.cellArea[c][r] = a;
    }

    const x0 = this.lineX(0), x1 = this.lineX(cols), z0 = this.lineZ(0), z1 = this.lineZ(rows);
    this.bounds = { x0, z0, x1, z1 };
    const m = this.halfX(0) + SIDEWALK + 1;
    this.wall = { x0: x0 - m, z0: z0 - this.halfZ(0) - SIDEWALK - 1, x1: x1 + this.halfX(cols) + SIDEWALK + 1, z1: z1 + this.halfZ(rows) + SIDEWALK + 1 };

    this.buildGraph();
    this.buildRegions();
    this.buildWater();
  }

  inGrid(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  area(c: number, r: number): AreaDef | null {
    return this.inGrid(c, r) ? this.cellArea[c][r] : null;
  }

  isWater(c: number, r: number) {
    return this.area(c, r)?.type === 'water';
  }

  lineX(i: number) {
    return (i - this.cols / 2) * this.pitch;
  }

  lineZ(j: number) {
    return (j - this.rows / 2) * this.pitch;
  }

  halfX(i: number) {
    return (this.def.wideX?.[i] ?? this.def.grid.road) / 2;
  }

  halfZ(j: number) {
    return (this.def.wideZ?.[j] ?? this.def.grid.road) / 2;
  }

  /** Rectangle of cells (inclusive), bounded by the inner road edges. */
  cellRect(c0: number, r0: number, c1 = c0, r1 = r0): Rect {
    return {
      x0: this.lineX(c0) + this.halfX(c0),
      x1: this.lineX(c1 + 1) - this.halfX(c1 + 1),
      z0: this.lineZ(r0) + this.halfZ(r0),
      z1: this.lineZ(r1 + 1) - this.halfZ(r1 + 1),
    };
  }

  /** Fractional grid coordinates (line units) to world. */
  gridToWorld(gx: number, gz: number) {
    return { x: (gx - this.cols / 2) * this.pitch, z: (gz - this.rows / 2) * this.pitch };
  }

  node(i: number, j: number): RoadNode | undefined {
    const id = this.nodeIndex.get(`${i},${j}`);
    return id === undefined ? undefined : this.nodes[id];
  }

  private sameSolidArea(a: AreaDef | null, b: AreaDef | null) {
    return a !== null && a === b && a.type !== 'water';
  }

  private buildGraph() {
    const { cols, rows } = this;
    const bridges = new Set([0, cols, ...(this.def.bridges ?? [])]);
    const want: [number, number, number, number, boolean, boolean][] = [];
    // horizontal edges along z lines
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i < cols; i++) {
        const up = this.area(i, j - 1), down = this.area(i, j);
        if (this.sameSolidArea(up, down)) continue;
        const wu = up?.type === 'water', wd = down?.type === 'water';
        if (wu && wd) continue;
        if ((wu || wd) && (j === 0 || j === rows)) continue;
        want.push([i, j, i + 1, j, false, wu !== wd]);
      }
    }
    // vertical edges along x lines
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j < rows; j++) {
        const l = this.area(i - 1, j), r = this.area(i, j);
        if (this.sameSolidArea(l, r)) continue;
        const wl = l?.type === 'water' || (i === 0 && r?.type === 'water');
        const wr = r?.type === 'water' || (i === cols && l?.type === 'water');
        if (wl && wr) {
          if (!bridges.has(i)) continue;
          want.push([i, j, i, j + 1, true, false]);
        } else want.push([i, j, i, j + 1, false, wl !== wr]);
      }
    }
    const getNode = (i: number, j: number) => {
      const k = `${i},${j}`;
      let id = this.nodeIndex.get(k);
      if (id === undefined) {
        id = this.nodes.length;
        this.nodeIndex.set(k, id);
        this.nodes.push({ id, i, j, x: this.lineX(i), z: this.lineZ(j), hx: this.halfX(i), hz: this.halfZ(j), edges: [], hasLight: false });
      }
      return id;
    };
    for (const [i0, j0, i1, j1, bridge, quay] of want) {
      const a = getNode(i0, j0), b = getNode(i1, j1);
      const na = this.nodes[a], nb = this.nodes[b];
      const len = Math.hypot(nb.x - na.x, nb.z - na.z);
      const horizontal = j0 === j1;
      const e: RoadEdge = {
        id: this.edges.length, a, b,
        width: horizontal ? this.halfZ(j0) * 2 : this.halfX(i0) * 2,
        length: len, dx: (nb.x - na.x) / len, dz: (nb.z - na.z) / len, bridge, quay,
      };
      this.edges.push(e);
      na.edges.push(e.id);
      nb.edges.push(e.id);
    }
    for (const n of this.nodes) {
      n.hasLight = n.edges.length >= 3 && !this.isBoundaryNode(n) && !n.edges.some((id) => this.edges[id].bridge);
    }
  }

  isBoundaryNode(n: RoadNode) {
    return n.i === 0 || n.j === 0 || n.i === this.cols || n.j === this.rows;
  }

  private buildRegions() {
    const seen = new Set<AreaDef>();
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const a = this.cellArea[c][r];
        if (a?.type === 'water') continue;
        if (a) {
          if (seen.has(a)) continue;
          seen.add(a);
          const c1 = a.c1 ?? a.c0, r1 = a.r1 ?? a.r0;
          this.regions.push({ rect: this.cellRect(a.c0, a.r0, c1, r1), kind: a.type as Region['kind'], area: a, c0: a.c0, r0: a.r0, c1, r1 });
        } else {
          this.regions.push({ rect: this.cellRect(c, r), kind: 'block', c0: c, r0: r, c1: c, r1: r });
        }
      }
    }
  }

  private buildWater() {
    for (let r = 0; r < this.rows; r++) {
      let start = -1;
      for (let c = 0; c <= this.cols; c++) {
        const w = c < this.cols && this.isWater(c, r);
        const split = w && start >= 0 && this.node(c, r) && this.node(c, r + 1) && this.hasEdge(c, r, c, r + 1);
        if (start >= 0 && (!w || split)) {
          this.water.push({ rect: this.cellRect(start, r, c - 1, r), row: r });
          start = -1;
        }
        if (w && start < 0) start = c;
      }
    }
  }

  hasEdge(i0: number, j0: number, i1: number, j1: number) {
    const a = this.node(i0, j0), b = this.node(i1, j1);
    if (!a || !b) return false;
    return a.edges.some((id) => {
      const e = this.edges[id];
      return (e.a === a.id && e.b === b.id) || (e.a === b.id && e.b === a.id);
    });
  }

  edgeBetween(a: number, b: number): RoadEdge | undefined {
    for (const id of this.nodes[a].edges) {
      const e = this.edges[id];
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return e;
    }
    return undefined;
  }

  /** Water row ranges in z (used to extend rivers past the city edge). */
  waterRows(): { z0: number; z1: number }[] {
    const rows = new Set(this.water.map((w) => w.row));
    return [...rows].map((r) => ({ z0: this.lineZ(r) + this.halfZ(r), z1: this.lineZ(r + 1) - this.halfZ(r + 1) }));
  }

  /** Heading (radians, rotation about Y, 0 = facing +Z) for a compass direction. */
  static heading(d: Dir) {
    switch (d) {
      case 'S': return 0;
      case 'E': return Math.PI / 2;
      case 'N': return Math.PI;
      case 'W': return -Math.PI / 2;
    }
  }

  /** Nearest point on the road network, with the edge it belongs to. */
  nearestRoadPoint(x: number, z: number) {
    let best = { d: Infinity, x: 0, z: 0, edge: this.edges[0] };
    for (const e of this.edges) {
      const a = this.nodes[e.a];
      const t = Math.max(0, Math.min(e.length, (x - a.x) * e.dx + (z - a.z) * e.dz));
      const px = a.x + e.dx * t, pz = a.z + e.dz * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < best.d) best = { d, x: px, z: pz, edge: e };
    }
    return best;
  }

  /** Shortest path between nodes (Dijkstra; graphs are small). Returns node ids. */
  path(from: number, to: number): number[] {
    const dist = new Array(this.nodes.length).fill(Infinity);
    const prev = new Array(this.nodes.length).fill(-1);
    const done = new Array(this.nodes.length).fill(false);
    dist[from] = 0;
    for (;;) {
      let u = -1;
      for (let k = 0; k < dist.length; k++) if (!done[k] && dist[k] < Infinity && (u < 0 || dist[k] < dist[u])) u = k;
      if (u < 0 || u === to) break;
      done[u] = true;
      for (const id of this.nodes[u].edges) {
        const e = this.edges[id];
        const v = e.a === u ? e.b : e.a;
        const nd = dist[u] + e.length;
        if (nd < dist[v]) {
          dist[v] = nd;
          prev[v] = u;
        }
      }
    }
    const out: number[] = [];
    for (let v = to; v >= 0; v = prev[v]) out.unshift(v);
    return out[0] === from ? out : [];
  }
}
