import { describe, expect, it } from 'vitest';
import { defaultProfile, sanitizeProfile } from '../systems/storage/profileSchema';
import { applyRun } from '../systems/progression/applyRun';
import { addXp, xpToNext } from '../systems/progression/progression';
import { activeMissions } from '../systems/missions/missions';
import { emptyRunStats } from '../game/scoring/runStats';
import { ScoreSystem } from '../game/scoring/ScoreSystem';
import { dailyChallengeFor } from '../data/daily';
import { upgradeCost, effectiveStats, MAX_UPGRADE_LEVEL } from '../data/upgrades';
import { VEHICLES } from '../data/vehicles';
import { ACHIEVEMENTS } from '../data/achievements';

describe('profile validation', () => {
  it('returns defaults for garbage', () => {
    expect(sanitizeProfile(null).coins).toBe(defaultProfile().coins);
    expect(sanitizeProfile('nope').ownedCars).toEqual(['street_racer']);
    expect(sanitizeProfile([1, 2, 3]).level).toBe(1);
  });

  it('repairs invalid fields and keeps valid ones', () => {
    const p = sanitizeProfile({
      coins: 999,
      level: -5,
      ownedCars: ['neon_gt', 'not_a_car', 42],
      selectedCar: 'hypercar', // not owned
      upgrades: { neon_gt: { speed: 99, handling: 2, drift: 'x' } },
      settings: { quality: 'ultra', masterVolume: 7, units: 'mph' },
      stats: { bestScore: 1234, gamesPlayed: NaN },
      achievements: { first_drive: 123, bad: 'x' },
      missions: { m_speed200: { progress: 200, done: true, claimed: false }, fake: {} },
    });
    expect(p.coins).toBe(999);
    expect(p.level).toBe(1);
    expect(p.ownedCars).toEqual(['street_racer', 'neon_gt']);
    expect(p.selectedCar).toBe('street_racer');
    expect(p.upgrades.neon_gt.speed).toBe(MAX_UPGRADE_LEVEL);
    expect(p.upgrades.neon_gt.handling).toBe(2);
    expect(p.upgrades.neon_gt.drift).toBe(0);
    expect(p.settings.quality).toBe('high');
    expect(p.settings.masterVolume).toBe(1);
    expect(p.settings.units).toBe('mph');
    expect(p.stats.bestScore).toBe(1234);
    expect(p.stats.gamesPlayed).toBe(0);
    expect(p.achievements).toEqual({ first_drive: 123 });
    expect(Object.keys(p.missions)).toEqual(['m_speed200']);
  });

  it('round-trips through JSON', () => {
    const p = defaultProfile();
    p.coins = 4321;
    p.ownedCars.push('turbo_coupe');
    expect(sanitizeProfile(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
});

describe('progression & economy', () => {
  it('levels up and carries over xp', () => {
    const r = addXp(1, 0, xpToNext(1) + xpToNext(2) + 5);
    expect(r.level).toBe(3);
    expect(r.xp).toBe(5);
    expect(r.reached).toEqual([2, 3]);
  });

  it('applies a run: stats, coins, best score, missions, achievements', () => {
    const p = defaultProfile();
    const run = { ...emptyRunStats('endless', 'street_racer'), score: 12000, distance: 3200, coins: 55, nearMisses: 12, maxSpeed: 230, time: 95, longestDrift: 4 };
    const { profile, result } = applyRun(p, run);
    expect(profile.stats.gamesPlayed).toBe(1);
    expect(profile.stats.bestScore).toBe(12000);
    expect(result.isPersonalBest).toBe(true);
    expect(profile.coins).toBeGreaterThanOrEqual(p.coins + 55 + result.bonusCoins);
    const completed = result.missionsCompleted.map((m) => m.id);
    expect(completed).toEqual(expect.arrayContaining(['m_speed200', 'm_coins50', 'm_near10']));
    expect(result.achievements.map((a) => a.id)).toContain('first_drive');
    expect(p.stats.gamesPlayed).toBe(0); // input not mutated
    expect(profile.leaderboard[0].score).toBe(12000);
  });

  it('only shows unclaimed missions on the board', () => {
    const p = defaultProfile();
    p.missions.m_speed200 = { progress: 200, done: true, claimed: true };
    expect(activeMissions(p).map((m) => m.id)).not.toContain('m_speed200');
    expect(activeMissions(p)).toHaveLength(3);
  });

  it('time trial best is tracked separately', () => {
    const { profile } = applyRun(defaultProfile(), { ...emptyRunStats('timetrial', 'street_racer'), score: 5000 });
    expect(profile.stats.bestTimeTrial).toBe(5000);
    expect(profile.stats.bestScore).toBe(0);
  });

  it('upgrade prices rise and stats improve', () => {
    for (const v of VEHICLES) {
      let prev = 0;
      for (let l = 0; l < MAX_UPGRADE_LEVEL; l++) {
        const c = upgradeCost(v, l);
        expect(c).toBeGreaterThan(prev);
        prev = c;
      }
      expect(upgradeCost(v, MAX_UPGRADE_LEVEL)).toBe(Infinity);
      const base = effectiveStats(v, { speed: 0, acceleration: 0, handling: 0, drift: 0, braking: 0 });
      const maxed = effectiveStats(v, { speed: 5, acceleration: 5, handling: 5, drift: 5, braking: 5 });
      expect(maxed.topSpeed).toBeGreaterThan(base.topSpeed);
      expect(maxed.drift).toBeGreaterThan(base.drift);
    }
  });

  it('vehicles are distinct and ordered by price', () => {
    expect(VEHICLES.length).toBeGreaterThanOrEqual(6);
    for (let i = 1; i < VEHICLES.length; i++) expect(VEHICLES[i].price).toBeGreaterThan(VEHICLES[i - 1].price);
    const sigs = new Set(VEHICLES.map((v) => `${v.topSpeed}/${v.acceleration}/${v.handling}/${v.drift}/${v.braking}`));
    expect(sigs.size).toBe(VEHICLES.length);
  });

  it('has at least 15 unique achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('daily challenge is deterministic per date', () => {
    expect(dailyChallengeFor('2026-11-08')).toEqual(dailyChallengeFor('2026-11-08'));
    const days = new Set(Array.from({ length: 14 }, (_, i) => dailyChallengeFor(`2026-11-${String(i + 1).padStart(2, '0')}`).title));
    expect(days.size).toBeGreaterThan(3);
  });
});

describe('scoring', () => {
  it('combo multiplies skill points and breaks on hit', () => {
    const s = new ScoreSystem();
    const first = s.nearMiss(1.0, false);
    const second = s.nearMiss(1.0, false);
    expect(second).toBeGreaterThan(first);
    expect(s.combo).toBe(2);
    s.hit();
    expect(s.combo).toBe(0);
    expect(s.multiplier).toBe(1);
  });

  it('combo expires after the window unless drifting', () => {
    const s = new ScoreSystem();
    s.nearMiss(1, false);
    s.update(3, true);
    expect(s.combo).toBe(1);
    s.update(10, false);
    expect(s.combo).toBe(0);
  });

  it('banks drift points with multiplier and rewards longer drifts', () => {
    const s = new ScoreSystem();
    for (let i = 0; i < 60; i++) s.driftTick(1 / 60, 50, 1);
    const shortPts = s.bankDrift(1);
    for (let i = 0; i < 60; i++) s.driftTick(1 / 60, 50, 1);
    const longPts = s.bankDrift(6);
    expect(longPts).toBeGreaterThan(shortPts);
    expect(s.combo).toBe(2);
  });

  it('high speed earns more distance points', () => {
    const slow = new ScoreSystem();
    const fast = new ScoreSystem();
    slow.addDistance(100, 120);
    fast.addDistance(100, 280);
    expect(fast.score).toBeGreaterThan(slow.score * 3);
  });
});
