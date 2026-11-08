import { ACHIEVEMENTS, type AchievementDef } from '../../data/achievements';
import type { Profile } from '../storage/profileSchema';
import type { RunStats } from '../../game/scoring/runStats';

/** Unlocks any newly satisfied achievements on the (mutable) profile and pays their rewards. */
export function evaluateAchievements(p: Profile, run?: RunStats): AchievementDef[] {
  const unlocked: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (a.check(p, run)) {
      p.achievements[a.id] = Date.now();
      p.coins += a.rewardCoins;
      unlocked.push(a);
    }
  }
  return unlocked;
}
