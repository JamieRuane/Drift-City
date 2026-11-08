import type { RunMetric } from '../game/scoring/runStats';

/** 'run' = must be achieved within a single run. 'total' = accumulates across runs. */
export type MissionScope = 'run' | 'total';

export interface MissionDef {
  id: string;
  title: string;
  metric: RunMetric;
  target: number;
  scope: MissionScope;
  rewardCoins: number;
  rewardXp: number;
}

export const MISSIONS: MissionDef[] = [
  { id: 'm_speed200', title: 'Reach 200 km/h', metric: 'maxSpeed', target: 200, scope: 'run', rewardCoins: 150, rewardXp: 60 },
  { id: 'm_coins50', title: 'Collect 50 coins in one run', metric: 'coins', target: 50, scope: 'run', rewardCoins: 200, rewardXp: 70 },
  { id: 'm_near10', title: 'Perform 10 near misses in one run', metric: 'nearMisses', target: 10, scope: 'run', rewardCoins: 250, rewardXp: 80 },
  { id: 'm_drift5', title: 'Drift continuously for 5 seconds', metric: 'longestDrift', target: 5, scope: 'run', rewardCoins: 250, rewardXp: 80 },
  { id: 'm_dist3', title: 'Travel 3 km in one run', metric: 'distance', target: 3000, scope: 'run', rewardCoins: 300, rewardXp: 100 },
  { id: 'm_over25', title: 'Avoid 25 vehicles in one run', metric: 'overtakes', target: 25, scope: 'run', rewardCoins: 300, rewardXp: 100 },
  { id: 'm_combo8', title: 'Build an 8x combo chain', metric: 'maxCombo', target: 8, scope: 'run', rewardCoins: 350, rewardXp: 120 },
  { id: 'm_time180', title: 'Survive for three minutes', metric: 'time', target: 180, scope: 'run', rewardCoins: 400, rewardXp: 140 },
  { id: 'm_drift10', title: 'Drift continuously for 10 seconds', metric: 'longestDrift', target: 10, scope: 'run', rewardCoins: 500, rewardXp: 160 },
  { id: 'm_score50k', title: 'Score 50,000 in one run', metric: 'score', target: 50000, scope: 'run', rewardCoins: 500, rewardXp: 160 },
  { id: 'm_tot25km', title: 'Drive 25 km in total', metric: 'distance', target: 25000, scope: 'total', rewardCoins: 600, rewardXp: 200 },
  { id: 'm_speed270', title: 'Reach 270 km/h', metric: 'maxSpeed', target: 270, scope: 'run', rewardCoins: 600, rewardXp: 200 },
  { id: 'm_clean2', title: 'Drive 2 km without a hit', metric: 'maxCleanDistance', target: 2000, scope: 'run', rewardCoins: 700, rewardXp: 220 },
  { id: 'm_near30', title: 'Perform 30 near misses in one run', metric: 'nearMisses', target: 30, scope: 'run', rewardCoins: 800, rewardXp: 250 },
  { id: 'm_tot100near', title: 'Perform 150 near misses in total', metric: 'nearMisses', target: 150, scope: 'total', rewardCoins: 800, rewardXp: 250 },
  { id: 'm_dist8', title: 'Travel 8 km in one run', metric: 'distance', target: 8000, scope: 'run', rewardCoins: 1000, rewardXp: 300 },
  { id: 'm_combo15', title: 'Build a 15x combo chain', metric: 'maxCombo', target: 15, scope: 'run', rewardCoins: 1000, rewardXp: 300 },
  { id: 'm_tot1000c', title: 'Collect 1,000 coins in total', metric: 'coins', target: 1000, scope: 'total', rewardCoins: 1200, rewardXp: 320 },
  { id: 'm_score200k', title: 'Score 200,000 in one run', metric: 'score', target: 200000, scope: 'run', rewardCoins: 1500, rewardXp: 400 },
  { id: 'm_speed320', title: 'Reach 320 km/h', metric: 'maxSpeed', target: 320, scope: 'run', rewardCoins: 2000, rewardXp: 500 },
];

export const ACTIVE_MISSION_SLOTS = 3;

export function formatMetric(metric: RunMetric, value: number) {
  switch (metric) {
    case 'distance':
    case 'maxCleanDistance':
      return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.floor(value)} m`;
    case 'maxSpeed': return `${Math.floor(value)} km/h`;
    case 'longestDrift': return `${value.toFixed(1)} s`;
    case 'time': return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
    case 'maxCombo': return `${Math.floor(value)}x`;
    default: return Math.floor(value).toLocaleString('en-US');
  }
}
