export type GameMode = 'endless' | 'timetrial' | 'daily';

export const TIME_TRIAL_SECONDS = 90;

/** Everything measured during a single run. Shared by scoring, missions, achievements and the UI. */
export interface RunStats {
  mode: GameMode;
  vehicleId: string;
  score: number;
  /** metres */
  distance: number;
  coins: number;
  nearMisses: number;
  rareNearMisses: number;
  overtakes: number;
  /** km/h */
  maxSpeed: number;
  /** seconds of the longest single drift */
  longestDrift: number;
  totalDriftTime: number;
  drifts: number;
  maxCombo: number;
  /** seconds */
  time: number;
  hits: number;
  /** longest distance travelled without a collision (m) */
  maxCleanDistance: number;
}

export const emptyRunStats = (mode: GameMode, vehicleId: string): RunStats => ({
  mode, vehicleId, score: 0, distance: 0, coins: 0, nearMisses: 0, rareNearMisses: 0, overtakes: 0,
  maxSpeed: 0, longestDrift: 0, totalDriftTime: 0, drifts: 0, maxCombo: 0, time: 0, hits: 0, maxCleanDistance: 0,
});

export type RunMetric =
  | 'distance' | 'coins' | 'nearMisses' | 'overtakes' | 'maxSpeed' | 'longestDrift'
  | 'maxCombo' | 'time' | 'score' | 'maxCleanDistance' | 'drifts';

export const metricValue = (s: RunStats, m: RunMetric) => s[m];
