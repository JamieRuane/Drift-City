import type { FacadeStyle } from '../world/textures';
import type { LandmarkContext } from '../world/LandmarkContext';

export type CityId = 'paris' | 'newyork' | 'london' | 'tokyo' | 'dublin';
export type Dir = 'N' | 'S' | 'E' | 'W';

/**
 * A rectangular group of grid cells with a special purpose. Cells are addressed (column, row);
 * ranges are inclusive. Roads between cells of the same area are removed, so areas can be larger than one block.
 */
export interface AreaDef {
  type: 'park' | 'plaza' | 'landmark' | 'water';
  c0: number;
  r0: number;
  c1?: number;
  r1?: number;
  /** Ground finish for landmark areas. */
  ground?: 'grass' | 'paved' | 'cobble';
  /** Landmark id built inside this area. */
  landmark?: string;
  /** Parks: add a pond. */
  pond?: boolean;
  /** Parks: tree density multiplier. */
  trees?: number;
}

export interface LandmarkAnchor {
  /** Centre of the area that references this landmark (default). */
  area?: boolean;
  /** Road grid node (i, j). */
  node?: [number, number];
  /** Fractional grid coordinates (line units): x = i, z = j. */
  grid?: [number, number];
}

export type LandmarkBuilder = (ctx: LandmarkContext) => void;

export interface LandmarkDef {
  id: string;
  name: string;
  /** One or two sentences shown on discovery. */
  description: string;
  icon: string;
  xp: number;
  anchor: LandmarkAnchor;
  /** Rotation of the landmark's local frame (radians). */
  rotation?: number;
  /** Discovery trigger radius in metres. */
  radius: number;
  build: LandmarkBuilder;
}

export type RoofKind = 'mansard' | 'flat' | 'pitched' | 'parapet' | 'mixed';

export interface BuildingStyle {
  facades: [FacadeStyle, number][];
  wallColors: string[];
  roofColors: string[];
  trimColor: string;
  floors: [number, number];
  /** Probability that a lot becomes a tower, and the tower's floor range. */
  towerChance: number;
  towerFloors: [number, number];
  glassTowerChance: number;
  roof: RoofKind;
  lotWidth: [number, number];
  shopChance: number;
  awningColors: string[];
  shopColors: string[];
  neonChance: number;
  doorColors?: string[];
  cornerTurrets?: boolean;
  waterTanks?: boolean;
}

export interface CityPalette {
  asphalt: string;
  sidewalk: string;
  curb: string;
  grass: string;
  plaza: string;
  marking: string;
  centerLine: string;
  outerGround: string;
  hills: string;
  water: string;
}

export type StreetProp = 'morris' | 'kiosk' | 'cafe' | 'phonebox' | 'postbox' | 'hydrant' | 'vending' | 'bike' | 'planter';

export interface CityDefinition {
  id: CityId;
  name: string;
  country: string;
  flag: string;
  tagline: string;
  description: string;
  /** Card / thumbnail gradient and accent. */
  theme: { sky: [string, string]; accent: string; ground: string };
  grid: { cols: number; rows: number; block: number; road: number };
  /** Width overrides for vertical (x) and horizontal (z) road lines, by line index. */
  wideX?: Record<number, number>;
  wideZ?: Record<number, number>;
  /** Vertical road lines that continue across water rows as bridges (the outer ring always does). */
  bridges?: number[];
  areas: AreaDef[];
  style: BuildingStyle;
  palette: CityPalette;
  treeKind: 'round' | 'plane' | 'cherry' | 'conifer';
  lampStyle: 'paris' | 'classic' | 'modern';
  streetProps: StreetProp[];
  driveSide: 'left' | 'right';
  traffic: { colors: string[]; taxi?: { color: string; share: number }; buses?: string };
  spawn: { node: [number, number]; dir: Dir };
  startHour: number;
  waterName?: string;
  landmarks: LandmarkDef[];
}
