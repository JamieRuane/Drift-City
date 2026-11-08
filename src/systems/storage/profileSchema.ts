import { VEHICLES, STAT_KEYS } from '../../data/vehicles';
import { emptyUpgrades, MAX_UPGRADE_LEVEL, type UpgradeLevels } from '../../data/upgrades';
import { PAINTS, UNDERGLOWS, SMOKES } from '../../data/cosmetics';
import { MISSIONS } from '../../data/missions';
import type { GameMode } from '../../game/scoring/runStats';

export const PROFILE_VERSION = 1;

export type Quality = 'low' | 'medium' | 'high';
export type ControlMode = 'zones' | 'swipe';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: Quality;
  cameraShake: boolean;
  showFps: boolean;
  controlMode: ControlMode;
  units: 'kmh' | 'mph';
}

export interface LifetimeStats {
  gamesPlayed: number;
  totalDistance: number;
  totalCoins: number;
  totalNearMisses: number;
  totalOvertakes: number;
  totalDrifts: number;
  totalScore: number;
  totalTime: number;
  totalCrashes: number;
  highestSpeed: number;
  bestScore: number;
  bestDistance: number;
  bestCombo: number;
  longestDrift: number;
  bestTimeTrial: number;
  bestCleanDistance: number;
  rareNearMisses: number;
  missionsCompleted: number;
  dailiesCompleted: number;
}

export interface MissionProgress {
  progress: number;
  done: boolean;
  claimed: boolean;
}

/** Local leaderboard entry. Shaped so it can be POSTed to a backend later. */
export interface RunRecord {
  id: string;
  score: number;
  distance: number;
  mode: GameMode;
  vehicleId: string;
  date: number;
  playerName: string;
}

export interface Profile {
  version: number;
  playerId: string;
  playerName: string;
  coins: number;
  xp: number;
  level: number;
  ownedCars: string[];
  selectedCar: string;
  carPaint: Record<string, string>;
  upgrades: Record<string, UpgradeLevels>;
  ownedPaints: string[];
  ownedGlows: string[];
  selectedGlow: string;
  ownedSmokes: string[];
  selectedSmoke: string;
  stats: LifetimeStats;
  achievements: Record<string, number>;
  missions: Record<string, MissionProgress>;
  daily: { date: string; completed: boolean; claimed: boolean; best: number };
  leaderboard: RunRecord[];
  settings: Settings;
}

export const defaultSettings = (): Settings => ({
  masterVolume: 0.8, musicVolume: 0.55, sfxVolume: 0.8, muted: false,
  quality: 'high', cameraShake: true, showFps: false, controlMode: 'zones', units: 'kmh',
});

export const defaultStats = (): LifetimeStats => ({
  gamesPlayed: 0, totalDistance: 0, totalCoins: 0, totalNearMisses: 0, totalOvertakes: 0, totalDrifts: 0,
  totalScore: 0, totalTime: 0, totalCrashes: 0, highestSpeed: 0, bestScore: 0, bestDistance: 0, bestCombo: 0,
  longestDrift: 0, bestTimeTrial: 0, bestCleanDistance: 0, rareNearMisses: 0, missionsCompleted: 0, dailiesCompleted: 0,
});

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const defaultProfile = (): Profile => ({
  version: PROFILE_VERSION,
  playerId: randomId(),
  playerName: 'Racer',
  coins: 250,
  xp: 0,
  level: 1,
  ownedCars: [VEHICLES[0].id],
  selectedCar: VEHICLES[0].id,
  carPaint: Object.fromEntries(VEHICLES.map((v) => [v.id, v.defaultPaint])),
  upgrades: Object.fromEntries(VEHICLES.map((v) => [v.id, emptyUpgrades()])),
  ownedPaints: PAINTS.filter((p) => p.price === 0).map((p) => p.id),
  ownedGlows: ['none'],
  selectedGlow: 'none',
  ownedSmokes: ['white'],
  selectedSmoke: 'white',
  stats: defaultStats(),
  achievements: {},
  missions: {},
  daily: { date: '', completed: false, claimed: false, best: 0 },
  leaderboard: [],
  settings: defaultSettings(),
});

// ---------- validation ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const str = (v: unknown, def: string) => (typeof v === 'string' ? v : def);
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], def: T): T =>
  typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : def;
const idList = (v: unknown, valid: Set<string>, required: string[]) => {
  const out = new Set(required);
  if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && valid.has(x)) out.add(x);
  return [...out];
};

/** Turns any parsed JSON into a valid Profile, keeping every valid field and repairing the rest. */
export function sanitizeProfile(raw: unknown): Profile {
  const d = defaultProfile();
  if (!isObj(raw)) return d;

  const carIds = new Set(VEHICLES.map((v) => v.id));
  const paintIds = new Set(PAINTS.map((p) => p.id));
  const glowIds = new Set(UNDERGLOWS.map((p) => p.id));
  const smokeIds = new Set(SMOKES.map((p) => p.id));

  const ownedCars = idList(raw.ownedCars, carIds, d.ownedCars);
  const selectedCar = typeof raw.selectedCar === 'string' && ownedCars.includes(raw.selectedCar) ? raw.selectedCar : ownedCars[0];
  const ownedPaints = idList(raw.ownedPaints, paintIds, d.ownedPaints);
  const ownedGlows = idList(raw.ownedGlows, glowIds, d.ownedGlows);
  const ownedSmokes = idList(raw.ownedSmokes, smokeIds, d.ownedSmokes);

  const carPaint: Record<string, string> = { ...d.carPaint };
  if (isObj(raw.carPaint)) for (const id of carIds) {
    const p = raw.carPaint[id];
    if (typeof p === 'string' && ownedPaints.includes(p)) carPaint[id] = p;
  }

  const upgrades: Record<string, UpgradeLevels> = { ...d.upgrades };
  if (isObj(raw.upgrades)) for (const id of carIds) {
    const u = raw.upgrades[id];
    if (!isObj(u)) continue;
    const lv = emptyUpgrades();
    for (const k of STAT_KEYS) lv[k] = Math.round(num(u[k], 0, 0, MAX_UPGRADE_LEVEL));
    upgrades[id] = lv;
  }

  const stats = defaultStats();
  if (isObj(raw.stats)) for (const k of Object.keys(stats) as (keyof LifetimeStats)[]) stats[k] = num(raw.stats[k], 0);

  const achievements: Record<string, number> = {};
  if (isObj(raw.achievements)) for (const [k, v] of Object.entries(raw.achievements)) if (typeof v === 'number') achievements[k] = v;

  const missionIds = new Set(MISSIONS.map((m) => m.id));
  const missions: Record<string, MissionProgress> = {};
  if (isObj(raw.missions)) for (const [k, v] of Object.entries(raw.missions)) {
    if (!missionIds.has(k) || !isObj(v)) continue;
    missions[k] = { progress: num(v.progress, 0), done: bool(v.done, false), claimed: bool(v.claimed, false) };
  }

  const daily = { ...d.daily };
  if (isObj(raw.daily)) {
    daily.date = str(raw.daily.date, '');
    daily.completed = bool(raw.daily.completed, false);
    daily.claimed = bool(raw.daily.claimed, false);
    daily.best = num(raw.daily.best, 0);
  }

  const leaderboard: RunRecord[] = [];
  if (Array.isArray(raw.leaderboard)) for (const r of raw.leaderboard.slice(0, 20)) {
    if (!isObj(r)) continue;
    leaderboard.push({
      id: str(r.id, randomId()), score: num(r.score, 0), distance: num(r.distance, 0),
      mode: oneOf(r.mode, ['endless', 'timetrial', 'daily'] as const, 'endless'),
      vehicleId: carIds.has(str(r.vehicleId, '')) ? str(r.vehicleId, '') : VEHICLES[0].id,
      date: num(r.date, Date.now()), playerName: str(r.playerName, 'Racer').slice(0, 16),
    });
  }

  const s = isObj(raw.settings) ? raw.settings : {};
  const ds = defaultSettings();
  const settings: Settings = {
    masterVolume: num(s.masterVolume, ds.masterVolume, 0, 1),
    musicVolume: num(s.musicVolume, ds.musicVolume, 0, 1),
    sfxVolume: num(s.sfxVolume, ds.sfxVolume, 0, 1),
    muted: bool(s.muted, ds.muted),
    quality: oneOf(s.quality, ['low', 'medium', 'high'] as const, ds.quality),
    cameraShake: bool(s.cameraShake, ds.cameraShake),
    showFps: bool(s.showFps, ds.showFps),
    controlMode: oneOf(s.controlMode, ['zones', 'swipe'] as const, ds.controlMode),
    units: oneOf(s.units, ['kmh', 'mph'] as const, ds.units),
  };

  return {
    version: PROFILE_VERSION,
    playerId: str(raw.playerId, d.playerId),
    playerName: str(raw.playerName, d.playerName).slice(0, 16) || 'Racer',
    coins: Math.floor(num(raw.coins, d.coins)),
    xp: Math.floor(num(raw.xp, 0)),
    level: Math.floor(num(raw.level, 1, 1, 99)),
    ownedCars, selectedCar, carPaint, upgrades, ownedPaints,
    ownedGlows, selectedGlow: ownedGlows.includes(str(raw.selectedGlow, '')) ? str(raw.selectedGlow, 'none') : 'none',
    ownedSmokes, selectedSmoke: ownedSmokes.includes(str(raw.selectedSmoke, '')) ? str(raw.selectedSmoke, 'white') : 'white',
    stats, achievements, missions, daily, leaderboard, settings,
  };
}
