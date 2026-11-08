export type VehicleId = 'sports' | 'hatch' | 'classic' | 'offroad' | 'super';
export type BodyKind = VehicleId | 'sedan' | 'taxi' | 'van' | 'bus';

export interface VehiclePhysics {
  mass: number;
  /** Peak drive force (N) shared by the driven wheels. */
  engineForce: number;
  maxSpeedKmh: number;
  boostSpeedKmh: number;
  reverseKmh: number;
  brakeForce: number;
  /** Max steering angle (rad) at standstill. */
  steerMax: number;
  /** Tyre friction slip (grip). */
  grip: number;
  /** Rear grip while handbraking. */
  driftGrip: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  suspensionTravel: number;
  drive: 'rwd' | 'fwd' | 'awd';
  gears: number;
}

export interface VehicleSpec {
  id: VehicleId;
  name: string;
  tagline: string;
  unlockLevel: number;
  body: BodyKind;
  length: number;
  width: number;
  wheelRadius: number;
  wheelWidth: number;
  wheelBase: number;
  rideHeight: number;
  defaultPaint: string;
  physics: VehiclePhysics;
  stats: { speed: number; accel: number; handling: number; drift: number };
}

export const PAINTS = [
  '#e8402f', '#ff7a1a', '#ffc21a', '#3fbf62', '#14a3a3', '#2f7be8', '#5a3fd6', '#d63fa8',
  '#f4f4f0', '#9aa3ad', '#2b2f36', '#0d0f14', '#7a1f2b', '#2d5a3d', '#c9a26a', '#8fd4ff',
];

export const VEHICLES: VehicleSpec[] = [
  {
    id: 'sports', name: 'Vento GT', tagline: 'Balanced rear-drive coupé. Loves a sideways corner.',
    unlockLevel: 1, body: 'sports', length: 4.4, width: 1.95, wheelRadius: 0.36, wheelWidth: 0.3, wheelBase: 2.65, rideHeight: 0.3,
    defaultPaint: '#e8402f',
    physics: {
      mass: 1250, engineForce: 9200, maxSpeedKmh: 205, boostSpeedKmh: 255, reverseKmh: 34, brakeForce: 126,
      steerMax: 0.58, grip: 2.6, driftGrip: 0.75, suspensionStiffness: 34, suspensionDamping: 4.2, suspensionTravel: 0.22,
      drive: 'rwd', gears: 6,
    },
    stats: { speed: 7, accel: 7, handling: 8, drift: 8 },
  },
  {
    id: 'hatch', name: 'Pico Hatch', tagline: 'Nimble front-drive city car. Fits through anything.',
    unlockLevel: 1, body: 'hatch', length: 3.9, width: 1.8, wheelRadius: 0.33, wheelWidth: 0.26, wheelBase: 2.45, rideHeight: 0.3,
    defaultPaint: '#ffc21a',
    physics: {
      mass: 1050, engineForce: 6400, maxSpeedKmh: 172, boostSpeedKmh: 215, reverseKmh: 32, brakeForce: 104,
      steerMax: 0.62, grip: 2.8, driftGrip: 0.9, suspensionStiffness: 30, suspensionDamping: 4.0, suspensionTravel: 0.22,
      drive: 'fwd', gears: 5,
    },
    stats: { speed: 5, accel: 6, handling: 9, drift: 5 },
  },
  {
    id: 'classic', name: 'Rivière 66', tagline: 'Chrome, curves and a soft ride. Cruise in style.',
    unlockLevel: 2, body: 'classic', length: 4.6, width: 1.95, wheelRadius: 0.36, wheelWidth: 0.26, wheelBase: 2.8, rideHeight: 0.34,
    defaultPaint: '#8fd4ff',
    physics: {
      mass: 1400, engineForce: 7800, maxSpeedKmh: 180, boostSpeedKmh: 225, reverseKmh: 30, brakeForce: 99,
      steerMax: 0.55, grip: 2.3, driftGrip: 0.65, suspensionStiffness: 24, suspensionDamping: 3.4, suspensionTravel: 0.28,
      drive: 'rwd', gears: 4,
    },
    stats: { speed: 5, accel: 5, handling: 6, drift: 8 },
  },
  {
    id: 'offroad', name: 'Atlas 4x4', tagline: 'Tall, tough all-wheel-drive. Kerbs are a suggestion.',
    unlockLevel: 3, body: 'offroad', length: 4.3, width: 2.05, wheelRadius: 0.46, wheelWidth: 0.36, wheelBase: 2.6, rideHeight: 0.5,
    defaultPaint: '#2d5a3d',
    physics: {
      mass: 1750, engineForce: 11500, maxSpeedKmh: 170, boostSpeedKmh: 210, reverseKmh: 36, brakeForce: 153,
      steerMax: 0.56, grip: 2.7, driftGrip: 0.95, suspensionStiffness: 26, suspensionDamping: 3.8, suspensionTravel: 0.34,
      drive: 'awd', gears: 5,
    },
    stats: { speed: 5, accel: 6, handling: 6, drift: 4 },
  },
  {
    id: 'super', name: 'Fulmine X', tagline: 'Mid-engine missile. Handle with care.',
    unlockLevel: 5, body: 'super', length: 4.5, width: 2.05, wheelRadius: 0.36, wheelWidth: 0.34, wheelBase: 2.7, rideHeight: 0.24,
    defaultPaint: '#ff7a1a',
    physics: {
      mass: 1350, engineForce: 14500, maxSpeedKmh: 270, boostSpeedKmh: 330, reverseKmh: 36, brakeForce: 171,
      steerMax: 0.52, grip: 3.1, driftGrip: 0.85, suspensionStiffness: 42, suspensionDamping: 4.6, suspensionTravel: 0.18,
      drive: 'awd', gears: 7,
    },
    stats: { speed: 10, accel: 10, handling: 8, drift: 6 },
  },
];

export const vehicleById = (id: string) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];

/** XP needed to reach each level (index = level - 1). */
export const LEVEL_XP = [0, 300, 800, 1500, 2500, 3800, 5400, 7400, 10000, 13500];

export function levelForXp(xp: number) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1;
  const cur = LEVEL_XP[lvl - 1];
  const next = LEVEL_XP[lvl] ?? cur + 4000;
  return { level: lvl, cur, next, progress: Math.min(1, (xp - cur) / (next - cur)) };
}
