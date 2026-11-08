import { describe, expect, it } from 'vitest';
import { TrafficSystem } from '../game/traffic/TrafficSystem';
import { PlayerController, emptyInput } from '../game/player/PlayerController';
import { Autopilot } from '../game/player/Autopilot';
import { checkCollisions } from '../game/collision/CollisionSystem';
import { effectiveStats, emptyUpgrades } from '../data/upgrades';
import { VEHICLES } from '../data/vehicles';
import { createRng } from '../utils/math';
import { LANES_X, LANE_COUNT, ROAD_EDGE, NEAR_MISS_GAP } from '../game/constants';

/** Headless gameplay simulation — no WebGL needed (three.js geometry works in Node). */
function setup(seed = 42) {
  const traffic = new TrafficSystem();
  const player = new PlayerController();
  player.configure(effectiveStats(VEHICLES[0], emptyUpgrades()), 1.85, 4.1);
  player.reset(0, LANES_X[1], 100);
  traffic.reset(0);
  const rng = createRng(seed);
  traffic.prefill({ playerS: 0, playerSpeed: player.totalSpeed, difficulty: 0, spawn: true, rng });
  return { traffic, player, rng };
}

describe('traffic & driving simulation', () => {
  it('runs 10 simulated minutes with bounded pools and frame-rate independent movement', () => {
    const { traffic, player, rng } = setup();
    const ai = new Autopilot();
    const input = emptyInput();
    const dt = 1 / 120;
    let maxActive = 0;
    let overlaps = 0;
    for (let i = 0; i < 120 * 600; i++) {
      const difficulty = Math.min(1, player.s / 9000);
      ai.update(dt, player, traffic.cars, input);
      player.update(dt, input, difficulty);
      traffic.update(dt, { playerS: player.s, playerSpeed: player.totalSpeed, difficulty, spawn: true, rng });
      const active = traffic.cars.filter((c) => c.active && !c.oncoming);
      maxActive = Math.max(maxActive, active.length);
      // same-lane traffic must never overlap each other
      if (i % 60 === 0) {
        for (const a of active) for (const b of active) {
          if (a === b || a.knocked || b.knocked || a.lane !== b.lane || a.targetLane !== a.lane || b.targetLane !== b.lane) continue;
          if (Math.abs(a.s - b.s) < (a.def.length + b.def.length) / 2 - 0.5) overlaps++;
        }
      }
      expect(Math.abs(player.x)).toBeLessThanOrEqual(ROAD_EDGE);
    }
    expect(player.s).toBeGreaterThan(20000); // drove >20 km in 10 min
    expect(maxActive).toBeGreaterThan(5);
    expect(maxActive).toBeLessThanOrEqual(traffic.cars.length);
    expect(overlaps).toBe(0);
  });

  it('never spawns a full wall across every lane', () => {
    const { traffic, player, rng } = setup(7);
    let checks = 0;
    let wallChecks = 0;
    for (let i = 0; i < 120 * 120; i++) {
      player.s += 70 / 120;
      traffic.update(1 / 120, { playerS: player.s, playerSpeed: 70, difficulty: 1, spawn: true, rng });
      if (i % 30 !== 0) continue;
      checks++;
      const ahead = traffic.cars.filter((c) => c.active && !c.oncoming && !c.knocked && c.s > player.s + 60 && c.s < player.s + 250);
      const wall = ahead.some((a) => new Set(ahead.filter((b) => Math.abs(b.s - a.s) < 4).map((b) => b.lane)).size >= LANE_COUNT);
      if (wall) wallChecks++;
    }
    // at maximum difficulty a fully blocked stretch should essentially never appear
    expect(wallChecks / checks).toBeLessThan(0.03);
  });

  it('a seed always produces the same traffic layout (daily challenge)', () => {
    const sample = (seed: number) => {
      const { traffic } = setup(seed);
      return traffic.cars.filter((c) => c.active && !c.oncoming).map((c) => `${c.def.kind}${c.lane}:${c.s.toFixed(2)}`).sort().join(',');
    };
    expect(sample(2026)).toBe(sample(2026));
    expect(sample(2026)).not.toBe(sample(2027));
  });

  it('movement is frame-rate independent', () => {
    const a = new PlayerController();
    const b = new PlayerController();
    const stats = effectiveStats(VEHICLES[0], emptyUpgrades());
    for (const p of [a, b]) {
      p.configure(stats, 1.85, 4.1);
      p.reset(0, 0, 100);
    }
    const input = { ...emptyInput(), throttle: true, steer: 0.5 };
    for (let i = 0; i < 300; i++) a.update(1 / 30, input, 0);
    for (let i = 0; i < 1200; i++) b.update(1 / 120, input, 0);
    expect(Math.abs(a.s - b.s) / b.s).toBeLessThan(0.01);
    expect(Math.abs(a.speed - b.speed)).toBeLessThan(0.5);
  });

  it('detects collisions, overtakes and near misses', () => {
    const { traffic, player } = setup();
    for (const c of traffic.cars) c.active = false;
    const car = traffic.cars.find((c) => c.def.kind === 'sedan')!;
    Object.assign(car, { active: true, oncoming: false, knocked: false, passed: false, minGap: Infinity, lane: 2, targetLane: 2, x: player.x + 1.85 + 0.6, s: player.s + 3, speed: 20 });
    // side by side with a ~0.6 m gap, then the player pulls ahead
    let res = checkCollisions(player, traffic.cars, NEAR_MISS_GAP);
    expect(res.hit).toBeNull();
    player.s += 10;
    res = checkCollisions(player, traffic.cars, NEAR_MISS_GAP);
    expect(res.overtakes).toHaveLength(1);
    expect(res.nearMisses).toHaveLength(1);
    // direct overlap is a hit
    Object.assign(car, { passed: false, x: player.x, s: player.s + 1 });
    res = checkCollisions(player, traffic.cars, NEAR_MISS_GAP);
    expect(res.hit).toBe(car);
  });

  it('drifting builds drift time and ends with a valid drift', () => {
    const p = new PlayerController();
    p.configure(effectiveStats(VEHICLES[0], emptyUpgrades()), 1.85, 4.1);
    p.reset(0, -5, 160);
    const input = { ...emptyInput(), drift: true, steer: 1 };
    for (let i = 0; i < 120; i++) p.update(1 / 120, input, 0);
    expect(p.drifting).toBe(true);
    expect(p.driftTime).toBeGreaterThan(0.5);
    const end = p.update(1 / 120, { ...emptyInput() }, 0);
    expect(end?.valid).toBe(true);
    expect(p.boost).toBeGreaterThan(0);
  });
});
