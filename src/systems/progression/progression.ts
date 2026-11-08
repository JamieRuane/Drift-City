import { VEHICLES } from '../../data/vehicles';
import { PAINTS, UNDERGLOWS, SMOKES } from '../../data/cosmetics';
import type { RunStats } from '../../game/scoring/runStats';

export const MAX_LEVEL = 50;

/** XP required to advance from `level` to `level + 1`. */
export const xpToNext = (level: number) => Math.round(120 * Math.pow(level, 1.45));

export const levelUpReward = (newLevel: number) => 100 + newLevel * 50;

export function runXp(run: RunStats) {
  return Math.max(10, Math.round(run.distance / 40 + run.score / 900 + run.nearMisses * 2 + run.longestDrift * 3));
}

/** Coins awarded on top of the coins physically collected. */
export const runBonusCoins = (run: RunStats) => Math.floor(run.score / 500);

/** Applies XP, returning the new level/xp and the list of levels reached. */
export function addXp(level: number, xp: number, gained: number) {
  let lv = level;
  let cur = xp + gained;
  const reached: number[] = [];
  while (lv < MAX_LEVEL && cur >= xpToNext(lv)) {
    cur -= xpToNext(lv);
    lv++;
    reached.push(lv);
  }
  return { level: lv, xp: cur, reached };
}

/** Names of items that become available at exactly this level. */
export function unlocksAtLevel(level: number): string[] {
  return [
    ...VEHICLES.filter((v) => v.levelRequired === level && v.levelRequired > 1).map((v) => `Vehicle: ${v.name}`),
    ...PAINTS.filter((p) => p.levelRequired === level && p.levelRequired > 1).map((p) => `Paint: ${p.name}`),
    ...UNDERGLOWS.filter((p) => p.levelRequired === level && p.levelRequired > 1).map((p) => `Underglow: ${p.name}`),
    ...SMOKES.filter((p) => p.levelRequired === level && p.levelRequired > 1).map((p) => `Tyre smoke: ${p.name}`),
  ];
}
