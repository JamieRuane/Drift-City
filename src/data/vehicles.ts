export type StatKey = 'speed' | 'acceleration' | 'handling' | 'drift' | 'braking';
export const STAT_KEYS: StatKey[] = ['speed', 'acceleration', 'handling', 'drift', 'braking'];

export type BodyStyle = 'hatch' | 'gt' | 'coupe' | 'hyper' | 'drift' | 'superx';

export interface VehicleModelParams {
  style: BodyStyle;
  length: number;
  width: number;
  height: number;
  cabinLength: number;
  /** + moves the cabin towards the rear */
  cabinOffset: number;
  cabinHeight: number;
  wheelRadius: number;
  wheelWidth: number;
  spoiler: 'none' | 'lip' | 'wing' | 'big';
  accentColor: string;
}

export interface VehicleDef {
  id: string;
  name: string;
  tagline: string;
  price: number;
  levelRequired: number;
  /** km/h */
  topSpeed: number;
  /** m/s^2 of forward acceleration at low speed */
  acceleration: number;
  /** max lateral speed m/s */
  handling: number;
  /** drift score multiplier & control */
  drift: number;
  /** m/s^2 braking */
  braking: number;
  defaultPaint: string;
  upgradeCostMult: number;
  model: VehicleModelParams;
}

export const VEHICLES: VehicleDef[] = [
  {
    id: 'street_racer', name: 'Street Racer', tagline: 'Light, nimble, honest. Every legend starts here.',
    price: 0, levelRequired: 1, topSpeed: 228, acceleration: 8.5, handling: 9.5, drift: 1.0, braking: 20,
    defaultPaint: 'cyan', upgradeCostMult: 1,
    model: { style: 'hatch', length: 4.1, width: 1.85, height: 0.72, cabinLength: 2.0, cabinOffset: 0.35, cabinHeight: 0.55, wheelRadius: 0.34, wheelWidth: 0.26, spoiler: 'lip', accentColor: '#00e5ff' },
  },
  {
    id: 'neon_gt', name: 'Neon GT', tagline: 'Long-wheelbase grand tourer wrapped in light.',
    price: 1800, levelRequired: 2, topSpeed: 252, acceleration: 9.5, handling: 9.8, drift: 1.1, braking: 22,
    defaultPaint: 'violet', upgradeCostMult: 1.25,
    model: { style: 'gt', length: 4.7, width: 1.95, height: 0.62, cabinLength: 1.9, cabinOffset: 0.55, cabinHeight: 0.48, wheelRadius: 0.36, wheelWidth: 0.3, spoiler: 'lip', accentColor: '#b54dff' },
  },
  {
    id: 'turbo_coupe', name: 'Turbo Coupe', tagline: 'Boxy retro wedge with a boost gauge that never sleeps.',
    price: 4200, levelRequired: 4, topSpeed: 262, acceleration: 12.0, handling: 9.6, drift: 1.15, braking: 23,
    defaultPaint: 'sunset', upgradeCostMult: 1.55,
    model: { style: 'coupe', length: 4.4, width: 1.9, height: 0.7, cabinLength: 1.7, cabinOffset: 0.4, cabinHeight: 0.46, wheelRadius: 0.35, wheelWidth: 0.3, spoiler: 'wing', accentColor: '#ff7a1a' },
  },
  {
    id: 'hypercar', name: 'Hypercar', tagline: 'Carbon tub, active aero, terrifying top end.',
    price: 9500, levelRequired: 7, topSpeed: 305, acceleration: 13.0, handling: 10.8, drift: 1.15, braking: 27,
    defaultPaint: 'crimson', upgradeCostMult: 2.0,
    model: { style: 'hyper', length: 4.6, width: 2.05, height: 0.55, cabinLength: 1.6, cabinOffset: 0.1, cabinHeight: 0.42, wheelRadius: 0.37, wheelWidth: 0.34, spoiler: 'big', accentColor: '#ff2d55' },
  },
  {
    id: 'drift_machine', name: 'Drift Machine', tagline: 'Wide-body, angle kit, built to slide sideways forever.',
    price: 16000, levelRequired: 10, topSpeed: 268, acceleration: 11.5, handling: 12.4, drift: 1.65, braking: 25,
    defaultPaint: 'lime', upgradeCostMult: 2.4,
    model: { style: 'drift', length: 4.45, width: 2.1, height: 0.68, cabinLength: 1.8, cabinOffset: 0.3, cabinHeight: 0.5, wheelRadius: 0.36, wheelWidth: 0.38, spoiler: 'big', accentColor: '#9dff00' },
  },
  {
    id: 'supercar_x', name: 'Supercar X', tagline: "Prototype from the city's skunkworks. Untouchable.",
    price: 30000, levelRequired: 14, topSpeed: 335, acceleration: 15.0, handling: 12.0, drift: 1.4, braking: 30,
    defaultPaint: 'pearl', upgradeCostMult: 3.0,
    model: { style: 'superx', length: 4.8, width: 2.08, height: 0.52, cabinLength: 1.5, cabinOffset: 0.0, cabinHeight: 0.4, wheelRadius: 0.38, wheelWidth: 0.35, spoiler: 'wing', accentColor: '#00ffd0' },
  },
];

export const getVehicle = (id: string) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0];
