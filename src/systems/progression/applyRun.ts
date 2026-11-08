import type { Profile, RunRecord } from '../storage/profileSchema';
import type { RunStats } from '../../game/scoring/runStats';
import type { AchievementDef } from '../../data/achievements';
import type { MissionDef } from '../../data/missions';
import { dailyChallengeFor } from '../../data/daily';
import { addXp, levelUpReward, runBonusCoins, runXp } from './progression';
import { applyRunToMissions } from '../missions/missions';
import { evaluateAchievements } from '../achievements/achievements';
import { todayKey } from '../../utils/format';

export interface RunResult {
  run: RunStats;
  coinsCollected: number;
  bonusCoins: number;
  levelUpCoins: number;
  dailyCoins: number;
  xpGained: number;
  levelsReached: number[];
  isPersonalBest: boolean;
  previousBest: number;
  missionsCompleted: MissionDef[];
  achievements: AchievementDef[];
  dailyCompleted: boolean;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Pure: returns an updated copy of the profile plus a summary for the Game Over screen. */
export function applyRun(profile: Profile, run: RunStats): { profile: Profile; result: RunResult } {
  const p = clone(profile);
  const s = p.stats;
  const previousBest = run.mode === 'timetrial' ? s.bestTimeTrial : s.bestScore;

  // lifetime stats
  s.gamesPlayed += 1;
  s.totalDistance += run.distance;
  s.totalCoins += run.coins;
  s.totalNearMisses += run.nearMisses;
  s.totalOvertakes += run.overtakes;
  s.totalDrifts += run.drifts;
  s.totalScore += run.score;
  s.totalTime += run.time;
  s.totalCrashes += run.hits;
  s.rareNearMisses += run.rareNearMisses;
  s.highestSpeed = Math.max(s.highestSpeed, run.maxSpeed);
  s.bestDistance = Math.max(s.bestDistance, run.distance);
  s.bestCombo = Math.max(s.bestCombo, run.maxCombo);
  s.longestDrift = Math.max(s.longestDrift, run.longestDrift);
  s.bestCleanDistance = Math.max(s.bestCleanDistance, run.maxCleanDistance);
  if (run.mode === 'timetrial') s.bestTimeTrial = Math.max(s.bestTimeTrial, run.score);
  else s.bestScore = Math.max(s.bestScore, run.score);
  const isPersonalBest = run.score > previousBest && run.score > 0;

  // economy
  const bonusCoins = runBonusCoins(run);
  p.coins += run.coins + bonusCoins;

  // daily challenge
  let dailyCompleted = false;
  let dailyCoins = 0;
  let dailyXp = 0;
  if (run.mode === 'daily') {
    const today = todayKey();
    const ch = dailyChallengeFor(today);
    if (p.daily.date !== today) p.daily = { date: today, completed: false, claimed: false, best: 0 };
    p.daily.best = Math.max(p.daily.best, run[ch.metric]);
    if (!p.daily.completed && run[ch.metric] >= ch.target) {
      p.daily.completed = true;
      p.daily.claimed = true;
      dailyCompleted = true;
      dailyCoins = ch.rewardCoins;
      dailyXp = ch.rewardXp;
      p.coins += dailyCoins;
      s.dailiesCompleted += 1;
    }
  }

  // missions (rewards are claimed from the mission board)
  const missionsCompleted = applyRunToMissions(p, run);

  // xp & levels
  const xpGained = runXp(run) + dailyXp;
  const lv = addXp(p.level, p.xp, xpGained);
  p.level = lv.level;
  p.xp = lv.xp;
  const levelUpCoins = lv.reached.reduce((sum, l) => sum + levelUpReward(l), 0);
  p.coins += levelUpCoins;

  // local leaderboard
  const record: RunRecord = {
    id: Math.random().toString(36).slice(2, 10), score: Math.floor(run.score), distance: Math.floor(run.distance),
    mode: run.mode, vehicleId: run.vehicleId, date: Date.now(), playerName: p.playerName,
  };
  p.leaderboard = [...p.leaderboard, record].sort((a, b) => b.score - a.score).slice(0, 20);

  const achievements = evaluateAchievements(p, run);

  return {
    profile: p,
    result: {
      run, coinsCollected: run.coins, bonusCoins, levelUpCoins, dailyCoins, xpGained, levelsReached: lv.reached,
      isPersonalBest, previousBest, missionsCompleted, achievements, dailyCompleted,
    },
  };
}
