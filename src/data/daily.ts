import type { RunMetric } from '../game/scoring/runStats';
import { createRng, hashString } from '../utils/math';
import { formatMetric } from './missions';

export interface DailyChallenge {
  date: string;
  seed: number;
  metric: RunMetric;
  target: number;
  title: string;
  rewardCoins: number;
  rewardXp: number;
}

const TEMPLATES: { metric: RunMetric; targets: number[]; title: (t: number) => string }[] = [
  { metric: 'distance', targets: [4000, 5000, 6000], title: (t) => `Travel ${formatMetric('distance', t)}` },
  { metric: 'nearMisses', targets: [15, 20, 25], title: (t) => `Perform ${t} near misses` },
  { metric: 'coins', targets: [80, 100, 120], title: (t) => `Collect ${t} coins` },
  { metric: 'maxCombo', targets: [8, 10, 12], title: (t) => `Achieve a ${t}x combo` },
  { metric: 'longestDrift', targets: [6, 8, 10], title: (t) => `Hold one drift for ${t} seconds` },
  { metric: 'overtakes', targets: [40, 60, 80], title: (t) => `Overtake ${t} vehicles` },
  { metric: 'score', targets: [60000, 80000, 100000], title: (t) => `Score ${t.toLocaleString('en-US')} points` },
  { metric: 'maxCleanDistance', targets: [1500, 2000, 2500], title: (t) => `Drive ${formatMetric('distance', t)} without a hit` },
];

/** Deterministic challenge for a given local date key (YYYY-MM-DD). */
export function dailyChallengeFor(date: string): DailyChallenge {
  const seed = hashString(`drift-city-${date}`);
  const rng = createRng(seed);
  const tpl = rng.pick(TEMPLATES);
  const tier = rng.int(0, tpl.targets.length - 1);
  const target = tpl.targets[tier];
  return {
    date, seed, metric: tpl.metric, target, title: tpl.title(target),
    rewardCoins: 600 + tier * 200, rewardXp: 200 + tier * 75,
  };
}
