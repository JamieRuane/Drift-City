import type { EffectiveStats } from '../../data/upgrades';
import { KMH, LANES_X, ROAD_EDGE } from '../constants';
import { approach, clamp, damp, lerp, sign } from '../../utils/math';

export interface DriveInput {
  steer: number; // -1..1
  throttle: boolean;
  brake: boolean;
  drift: boolean;
  /** discrete lane-change request from swipe controls (-1 / +1 / 0) */
  laneShift: number;
}

export const emptyInput = (): DriveInput => ({ steer: 0, throttle: false, brake: false, drift: false, laneShift: 0 });

export interface DriftEnd {
  time: number;
  valid: boolean;
}

/**
 * Arcade vehicle model. Longitudinal speed with throttle/brake/cruise, lateral velocity with
 * handling-based response, and a drift state that rotates the car, slides it sideways and builds score.
 */
export class PlayerController {
  s = 0;
  x = 0;
  vx = 0;
  speed = 0;
  boost = 0;
  steerSmoothed = 0;
  driftAngle = 0;
  drifting = false;
  driftDir = 0;
  driftTime = 0;
  /** time since steering input released — drives lane assist */
  idleSteer = 0;
  wallContact = 0;
  wrecked = false;
  wreckSpin = 0;
  yaw = 0;
  roll = 0;
  pitch = 0;
  invulnerable = 0;
  laneTarget: number | null = null;
  halfWidth = 0.95;
  halfLength = 2.2;
  stats!: EffectiveStats;
  private lastAccel = 0;

  configure(stats: EffectiveStats, width: number, length: number) {
    this.stats = stats;
    this.halfWidth = width / 2;
    this.halfLength = length / 2;
  }

  reset(s: number, x: number, speedKmh: number) {
    this.s = s;
    this.x = x;
    this.vx = 0;
    this.speed = speedKmh / KMH;
    this.boost = 0;
    this.steerSmoothed = 0;
    this.driftAngle = 0;
    this.drifting = false;
    this.driftDir = 0;
    this.driftTime = 0;
    this.idleSteer = 0;
    this.wallContact = 0;
    this.wrecked = false;
    this.wreckSpin = 0;
    this.yaw = this.roll = this.pitch = 0;
    this.invulnerable = 0;
    this.laneTarget = null;
  }

  get topSpeed() {
    return this.stats.topSpeed / KMH;
  }
  get totalSpeed() {
    return this.speed + this.boost;
  }
  get speedKmh() {
    return this.totalSpeed * KMH;
  }

  /** Effective half extents of the (possibly rotated) car for collision checks. */
  extents() {
    const a = Math.abs(this.yaw);
    const c = Math.cos(a), sn = Math.sin(a);
    return { hx: this.halfWidth * c + this.halfLength * sn, hs: this.halfLength * c + this.halfWidth * sn };
  }

  /**
   * Advances the simulation. Returns a DriftEnd when a drift finishes this step.
   * `difficulty` 0..1 raises cruising and top speed over the course of a run.
   */
  update(dt: number, input: DriveInput, difficulty: number): DriftEnd | null {
    const st = this.stats;
    const top = this.topSpeed * (1 + difficulty * 0.05);
    let ended: DriftEnd | null = null;
    this.invulnerable = Math.max(0, this.invulnerable - dt);

    if (this.wrecked) {
      this.speed = approach(this.speed, 0, 22 * dt);
      this.boost = approach(this.boost, 0, 20 * dt);
      this.vx = damp(this.vx, 0, 2, dt);
      this.wreckSpin = damp(this.wreckSpin, 0, 0.8, dt);
      this.yaw += this.wreckSpin * dt;
      this.x = clamp(this.x + this.vx * dt, -ROAD_EDGE + 1, ROAD_EDGE - 1);
      this.s += this.speed * dt;
      return null;
    }

    // ---------- longitudinal ----------
    const cruise = top * lerp(0.58, 0.84, difficulty);
    let target = input.throttle ? top : cruise;
    if (input.brake) target = cruise * 0.42;
    const prev = this.speed;
    if (this.speed < target) {
      const falloff = 1 - 0.6 * Math.pow(this.speed / top, 2);
      this.speed = Math.min(target, this.speed + st.acceleration * falloff * dt);
    } else {
      this.speed = approach(this.speed, target, (input.brake ? st.braking : 5) * dt);
    }
    if (this.drifting) this.speed -= (2.2 / Math.sqrt(st.drift)) * dt * (input.throttle ? 0.4 : 1);
    this.boost = approach(this.boost, 0, 2.6 * dt);
    this.lastAccel = damp(this.lastAccel, (this.speed - prev) / Math.max(dt, 1e-4), 6, dt);

    // ---------- steering ----------
    let steer = input.steer;
    if (input.laneShift !== 0) {
      const cur = this.laneTarget ?? this.nearestLane();
      this.laneTarget = clamp(cur + input.laneShift, 0, LANES_X.length - 1);
    }
    if (Math.abs(steer) > 0.05) this.laneTarget = null;
    if (this.laneTarget !== null) {
      const dx = LANES_X[this.laneTarget] - this.x;
      // PD controller: approach the lane centre without overshooting
      steer = clamp(dx * 1.1 - this.vx * 0.17, -1, 1);
      if (Math.abs(dx) < 0.08 && Math.abs(this.vx) < 1) this.laneTarget = null;
    }
    this.steerSmoothed = approach(this.steerSmoothed, steer, (Math.abs(steer) > Math.abs(this.steerSmoothed) ? 7 : 10) * dt);
    const sSteer = this.steerSmoothed;
    this.idleSteer = Math.abs(sSteer) < 0.05 ? this.idleSteer + dt : 0;

    const speedFactor = clamp(this.speed / 30, 0.3, 1);
    const maxLat = st.handling * speedFactor;

    // ---------- drift state ----------
    const canDrift = this.speed > 18;
    if (input.drift && canDrift && !this.drifting && (Math.abs(sSteer) > 0.15 || Math.abs(this.vx) > 1.5)) {
      this.drifting = true;
      this.driftDir = sign(Math.abs(sSteer) > 0.15 ? sSteer : this.vx) || 1;
      this.driftTime = 0;
    }
    if (this.drifting && (!input.drift || !canDrift)) {
      ended = { time: this.driftTime, valid: this.driftTime > 0.45 };
      if (ended.valid) this.boost += Math.min(this.driftTime, 4) * 1.6 * Math.sqrt(st.drift);
      this.drifting = false;
      this.driftTime = 0;
    }

    let targetVx: number;
    let response: number;
    if (this.drifting) {
      // steering hard the other way flicks the drift into the opposite direction
      if (Math.abs(sSteer) > 0.45 && sign(sSteer) !== this.driftDir) this.driftDir = sign(sSteer);
      const ctrl = Math.pow(st.drift, 0.35);
      const angle = this.driftDir * (0.3 + 0.2 * Math.abs(sSteer)) * clamp(ctrl, 0.9, 1.35);
      this.driftAngle = approach(this.driftAngle, angle, 2.6 * ctrl * dt);
      targetVx = this.driftDir * maxLat * (0.5 + 0.5 * Math.abs(sSteer)) * 1.08;
      response = 2.6 * ctrl;
      if (Math.abs(this.driftAngle) > 0.14) this.driftTime += dt;
    } else {
      this.driftAngle = approach(this.driftAngle, 0, 2.8 * dt);
      targetVx = sSteer * maxLat;
      response = 7.5 * (st.handling / 10);
      if (this.idleSteer > 0.22 && this.laneTarget === null) {
        // gentle lane assist toward the nearest lane centre
        const dx = LANES_X[this.nearestLane()] - this.x;
        targetVx = clamp(dx * 1.8, -maxLat * 0.35, maxLat * 0.35);
        response = 3.5;
      }
    }
    this.vx = damp(this.vx, targetVx, response, dt);
    this.x += this.vx * dt;

    // ---------- barriers ----------
    const { hx } = this.extents();
    const limit = ROAD_EDGE - hx;
    this.wallContact = 0;
    if (Math.abs(this.x) >= limit) {
      this.x = sign(this.x) * limit;
      if (sign(this.vx) === sign(this.x)) this.vx = 0;
      if (this.laneTarget !== null) this.laneTarget = null;
    }
    // steering into the barrier while touching it scrapes speed off (constant decel → frame-rate independent)
    if (Math.abs(this.x) >= limit - 0.05 && sign(targetVx) === sign(this.x) && Math.abs(targetVx) > 0.5) {
      this.wallContact = Math.min(1, 0.35 + Math.abs(targetVx) / 12);
      this.speed = Math.max(0, this.speed - 6 * dt);
    }

    this.s += this.totalSpeed * dt;

    // ---------- visual attitude ----------
    const heading = Math.atan2(this.vx, Math.max(this.totalSpeed, 6)) * 0.9 + this.driftAngle;
    this.yaw = -heading;
    this.roll = damp(this.roll, clamp((targetVx - this.vx) * 0.012 + this.driftAngle * 0.08, -0.08, 0.08), 8, dt);
    this.pitch = damp(this.pitch, clamp(this.lastAccel * 0.0035, -0.04, 0.03), 6, dt);
    return ended;
  }

  nearestLane() {
    let best = 0;
    for (let i = 1; i < LANES_X.length; i++) if (Math.abs(LANES_X[i] - this.x) < Math.abs(LANES_X[best] - this.x)) best = i;
    return best;
  }

  hit(pushDir: number) {
    this.speed *= 0.6;
    this.boost = 0;
    this.vx = pushDir * 5;
    this.invulnerable = 1.6;
    const ended: DriftEnd | null = this.drifting ? { time: this.driftTime, valid: false } : null;
    this.drifting = false;
    this.driftTime = 0;
    return ended;
  }

  wreck(pushDir: number) {
    this.wrecked = true;
    this.drifting = false;
    this.vx = pushDir * 6;
    this.wreckSpin = pushDir * 7;
  }
}
