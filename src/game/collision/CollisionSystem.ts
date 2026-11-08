import type { TrafficCar } from '../traffic/TrafficSystem';
import type { PlayerController } from '../player/PlayerController';

export interface CollisionResult {
  hit: TrafficCar | null;
  nearMisses: { car: TrafficCar; gap: number }[];
  overtakes: TrafficCar[];
}

/** Slightly forgiving hitboxes keep collisions feeling fair at high speed. */
const PLAYER_SHRINK = 0.9;
const TRAFFIC_SHRINK = 0.95;
const SIDE_WINDOW = 1.2;

/** Axis-aligned overlap tests in (x, s) space between the player and the traffic. */
export function checkCollisions(p: PlayerController, cars: TrafficCar[], nearGap: number): CollisionResult {
  const res: CollisionResult = { hit: null, nearMisses: [], overtakes: [] };
  const e = p.extents();
  const phx = e.hx * PLAYER_SHRINK, phs = e.hs * PLAYER_SHRINK;
  for (const c of cars) {
    if (!c.active || c.oncoming || c.knocked) continue;
    const chx = (c.def.width / 2) * TRAFFIC_SHRINK;
    const chs = (c.def.length / 2) * TRAFFIC_SHRINK;
    const dx = c.x - p.x;
    const ds = c.s - p.s;
    const overlapS = Math.abs(ds) < phs + chs;
    const overlapX = Math.abs(dx) < phx + chx;

    if (overlapS && overlapX && !p.wrecked) {
      if (p.invulnerable <= 0 && !res.hit) {
        res.hit = c;
        c.passed = true;
      }
      continue;
    }
    // record the closest lateral gap while side-by-side
    if (Math.abs(ds) < phs + chs + SIDE_WINDOW) {
      const gap = Math.abs(dx) - (e.hx + c.def.width / 2);
      if (gap < c.minGap) c.minGap = gap;
    }
    if (!c.passed && ds + chs < -phs) {
      c.passed = true;
      res.overtakes.push(c);
      if (c.minGap < nearGap && p.invulnerable <= 0) res.nearMisses.push({ car: c, gap: Math.max(0, c.minGap) });
    }
  }
  return res;
}
