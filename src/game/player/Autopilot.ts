import type { TrafficCar } from '../traffic/TrafficSystem';
import type { DriveInput, PlayerController } from './PlayerController';
import { LANES_X } from '../constants';
import { clamp } from '../../utils/math';

/** Drives the car for the attract-mode background on the menus. */
export class Autopilot {
  private targetLane = 1;
  private decide = 0;
  private driftTimer = 0;

  update(dt: number, p: PlayerController, cars: TrafficCar[], out: DriveInput) {
    this.decide -= dt;
    this.driftTimer -= dt;
    if (this.decide <= 0) {
      this.decide = 0.35;
      let bestLane = this.targetLane;
      let bestScore = -Infinity;
      for (let l = 0; l < LANES_X.length; l++) {
        let free = 260;
        for (const c of cars) {
          if (!c.active || c.oncoming || c.knocked) continue;
          if (Math.abs(c.x - LANES_X[l]) > 2.4) continue;
          const d = c.s - p.s;
          if (d > -6 && d < free) free = d;
        }
        const score = free - Math.abs(l - p.nearestLane()) * 12 + (l === this.targetLane ? 15 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestLane = l;
        }
      }
      this.targetLane = bestLane;
    }
    const dx = LANES_X[this.targetLane] - p.x;
    out.steer = clamp(dx * 0.7, -1, 1);
    out.throttle = true;
    out.brake = false;
    out.laneShift = 0;
    if (this.driftTimer <= 0 && Math.abs(dx) > 2.5) {
      this.driftTimer = 6;
    }
    out.drift = this.driftTimer > 5.0 && Math.abs(dx) > 0.6;
  }
}
