import type { Profile } from '../systems/storage/profileSchema';
import type { RunStats } from '../game/scoring/runStats';
import { VEHICLES } from './vehicles';
import { MAX_UPGRADE_LEVEL } from './upgrades';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rewardCoins: number;
  /** Evaluated after a run has been applied to the profile (run is undefined for menu purchases). */
  check: (p: Profile, run?: RunStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_drive', name: 'First Drive', description: 'Finish your first run.', icon: '🏁', rewardCoins: 100, check: (p) => p.stats.gamesPlayed >= 1 },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Hit 300 km/h.', icon: '⚡', rewardCoins: 500, check: (p) => p.stats.highestSpeed >= 300 },
  { id: 'close_call', name: 'Close Call', description: 'Get your first near miss.', icon: '😮', rewardCoins: 50, check: (p) => p.stats.totalNearMisses >= 1 },
  { id: 'near_miss_master', name: 'Near Miss Master', description: '500 near misses in total.', icon: '🎯', rewardCoins: 800, check: (p) => p.stats.totalNearMisses >= 500 },
  { id: 'drift_novice', name: 'Sideways', description: 'Hold a drift for 3 seconds.', icon: '🌀', rewardCoins: 100, check: (p) => p.stats.longestDrift >= 3 },
  { id: 'drift_king', name: 'Drift King', description: 'Hold a single drift for 15 seconds.', icon: '👑', rewardCoins: 1000, check: (p) => p.stats.longestDrift >= 15 },
  { id: 'combo_artist', name: 'Combo Artist', description: 'Reach a 20x combo chain.', icon: '🔥', rewardCoins: 800, check: (p) => p.stats.bestCombo >= 20 },
  { id: 'high_roller', name: 'High Roller', description: 'Score 100,000 in a single run.', icon: '💎', rewardCoins: 600, check: (p) => p.stats.bestScore >= 100000 },
  { id: 'millionaire', name: 'Millionaire', description: 'Earn 1,000,000 points in total.', icon: '💰', rewardCoins: 1500, check: (p) => p.stats.totalScore >= 1_000_000 },
  { id: 'road_warrior', name: 'Road Warrior', description: 'Drive 100 km in total.', icon: '🛣️', rewardCoins: 1500, check: (p) => p.stats.totalDistance >= 100_000 },
  { id: 'untouchable', name: 'Untouchable', description: 'Drive 5 km in one run without a single hit.', icon: '🛡️', rewardCoins: 1200, check: (p) => p.stats.bestCleanDistance >= 5000 },
  { id: 'marathon', name: 'Marathon', description: 'Survive 8 minutes in one run.', icon: '⏱️', rewardCoins: 1000, check: (_p, r) => !!r && r.time >= 480 },
  { id: 'collector', name: 'Coin Collector', description: 'Collect 5,000 coins in total.', icon: '🪙', rewardCoins: 1000, check: (p) => p.stats.totalCoins >= 5000 },
  { id: 'rare_hunter', name: 'Rare Hunter', description: 'Near miss a golden vault truck.', icon: '✨', rewardCoins: 300, check: (p) => p.stats.rareNearMisses >= 1 },
  { id: 'time_lord', name: 'Time Lord', description: 'Score 40,000 in Time Trial.', icon: '⌛', rewardCoins: 600, check: (p) => p.stats.bestTimeTrial >= 40000 },
  { id: 'car_enthusiast', name: 'Car Enthusiast', description: 'Own 3 vehicles.', icon: '🚗', rewardCoins: 500, check: (p) => p.ownedCars.length >= 3 },
  { id: 'full_garage', name: 'Full Garage', description: 'Own every vehicle.', icon: '🏆', rewardCoins: 5000, check: (p) => p.ownedCars.length >= VEHICLES.length },
  { id: 'tuner', name: 'Tuner', description: 'Max out any upgrade.', icon: '🔧', rewardCoins: 400, check: (p) => Object.values(p.upgrades).some((u) => Object.values(u).some((l) => l >= MAX_UPGRADE_LEVEL)) },
  { id: 'painter', name: 'Fresh Paint', description: 'Own 10 paint colours.', icon: '🎨', rewardCoins: 400, check: (p) => p.ownedPaints.length >= 10 },
  { id: 'daily_driver', name: 'Daily Driver', description: 'Complete 5 daily challenges.', icon: '📅', rewardCoins: 1000, check: (p) => p.stats.dailiesCompleted >= 5 },
  { id: 'mission_ace', name: 'Mission Ace', description: 'Complete 10 missions.', icon: '📋', rewardCoins: 800, check: (p) => p.stats.missionsCompleted >= 10 },
  { id: 'veteran', name: 'Veteran', description: 'Reach player level 10.', icon: '⭐', rewardCoins: 1000, check: (p) => p.level >= 10 },
  { id: 'centurion', name: 'Centurion', description: 'Play 100 runs.', icon: '💯', rewardCoins: 1500, check: (p) => p.stats.gamesPlayed >= 100 },
];
