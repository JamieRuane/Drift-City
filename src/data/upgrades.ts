import type { StatKey, VehicleDef } from './vehicles';

export const MAX_UPGRADE_LEVEL = 5;

export interface UpgradeInfo {
  key: StatKey;
  label: string;
  description: string;
  unit: string;
}

export const UPGRADE_INFO: Record<StatKey, UpgradeInfo> = {
  speed: { key: 'speed', label: 'Top Speed', description: 'Engine & ECU tune. Raises maximum speed.', unit: 'km/h' },
  acceleration: { key: 'acceleration', label: 'Acceleration', description: 'Turbo & gearing. Reach top speed faster.', unit: 'm/s²' },
  handling: { key: 'handling', label: 'Handling', description: 'Suspension & tyres. Faster, sharper lane changes.', unit: 'm/s' },
  drift: { key: 'drift', label: 'Drift', description: 'Angle kit & diff. Better drift control and drift score.', unit: 'x' },
  braking: { key: 'braking', label: 'Braking', description: 'Big brake kit. Stronger deceleration.', unit: 'm/s²' },
};

const BASE_COSTS = [180, 400, 800, 1450, 2400];

export const upgradeCost = (vehicle: VehicleDef, currentLevel: number) =>
  currentLevel >= MAX_UPGRADE_LEVEL ? Infinity : Math.round((BASE_COSTS[currentLevel] * vehicle.upgradeCostMult) / 10) * 10;

export type UpgradeLevels = Record<StatKey, number>;
export const emptyUpgrades = (): UpgradeLevels => ({ speed: 0, acceleration: 0, handling: 0, drift: 0, braking: 0 });

export interface EffectiveStats {
  /** km/h */
  topSpeed: number;
  acceleration: number;
  handling: number;
  drift: number;
  braking: number;
}

export function effectiveStats(v: VehicleDef, up: UpgradeLevels): EffectiveStats {
  return {
    topSpeed: v.topSpeed + up.speed * 11,
    acceleration: v.acceleration * (1 + up.acceleration * 0.08),
    handling: v.handling * (1 + up.handling * 0.065),
    drift: v.drift * (1 + up.drift * 0.1),
    braking: v.braking * (1 + up.braking * 0.1),
  };
}

export function statValue(stats: EffectiveStats, key: StatKey) {
  switch (key) {
    case 'speed': return stats.topSpeed;
    case 'acceleration': return stats.acceleration;
    case 'handling': return stats.handling;
    case 'drift': return stats.drift;
    case 'braking': return stats.braking;
  }
}

const RATING_RANGES: Record<StatKey, [number, number]> = {
  speed: [190, 400], acceleration: [6, 22], handling: [8, 17], drift: [0.7, 2.6], braking: [15, 45],
};

/** Normalised 0..1 rating for bar displays. */
export function statRating(stats: EffectiveStats, key: StatKey) {
  const [a, b] = RATING_RANGES[key];
  return Math.max(0.04, Math.min(1, (statValue(stats, key) - a) / (b - a)));
}

export function formatStat(key: StatKey, value: number) {
  if (key === 'speed') return `${Math.round(value)}`;
  if (key === 'drift') return value.toFixed(2);
  return value.toFixed(1);
}
