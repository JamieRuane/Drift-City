import { create } from 'zustand';
import { storage } from '../systems/storage/storage';
import { defaultProfile, type Profile, type Settings } from '../systems/storage/profileSchema';
import { getVehicle, type StatKey } from '../data/vehicles';
import { MAX_UPGRADE_LEVEL, upgradeCost } from '../data/upgrades';
import { getGlow, getPaint, getSmoke } from '../data/cosmetics';
import { MISSIONS } from '../data/missions';
import { applyRun, type RunResult } from '../systems/progression/applyRun';
import { evaluateAchievements } from '../systems/achievements/achievements';
import { addXp, levelUpReward } from '../systems/progression/progression';
import type { RunStats } from '../game/scoring/runStats';
import type { AchievementDef } from '../data/achievements';

export type PurchaseResult = { ok: true; achievements: AchievementDef[] } | { ok: false; reason: string };

interface ProfileState {
  profile: Profile;
  buyCar: (id: string) => PurchaseResult;
  selectCar: (id: string) => void;
  upgrade: (carId: string, stat: StatKey) => PurchaseResult;
  buyPaint: (paintId: string) => PurchaseResult;
  setPaint: (carId: string, paintId: string) => void;
  buyGlow: (id: string) => PurchaseResult;
  selectGlow: (id: string) => void;
  buySmoke: (id: string) => PurchaseResult;
  selectSmoke: (id: string) => void;
  claimMission: (id: string) => { coins: number; xp: number; levels: number[]; achievements: AchievementDef[] } | null;
  updateSettings: (s: Partial<Settings>) => void;
  setName: (name: string) => void;
  commitRun: (run: RunStats) => RunResult;
  resetProgress: () => void;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function initialProfile() {
  let hadSave = false;
  try {
    hadSave = !!localStorage.getItem('driftcity.profile.v1');
  } catch {
    /* ignore */
  }
  const p = storage.load();
  if (!hadSave && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) p.settings.quality = 'medium';
  return p;
}

export const useProfile = create<ProfileState>((set, get) => {
  /** Applies a mutation to a copy of the profile, re-checks achievements and saves. */
  const mutate = (fn: (p: Profile) => string | null): PurchaseResult => {
    const p = clone(get().profile);
    const err = fn(p);
    if (err) return { ok: false, reason: err };
    const achievements = evaluateAchievements(p);
    set({ profile: p });
    storage.save(p);
    return { ok: true, achievements };
  };

  const spend = (p: Profile, price: number, level: number) => {
    if (p.level < level) return `Requires level ${level}`;
    if (p.coins < price) return 'Not enough coins';
    p.coins -= price;
    return null;
  };

  return {
    profile: initialProfile(),

    buyCar: (id) => mutate((p) => {
      if (p.ownedCars.includes(id)) return 'Already owned';
      const v = getVehicle(id);
      const err = spend(p, v.price, v.levelRequired);
      if (err) return err;
      p.ownedCars.push(id);
      p.selectedCar = id;
      return null;
    }),
    selectCar: (id) => void mutate((p) => (p.ownedCars.includes(id) ? ((p.selectedCar = id), null) : 'Not owned')),
    upgrade: (carId, stat) => mutate((p) => {
      if (!p.ownedCars.includes(carId)) return 'Buy this vehicle first';
      const lv = p.upgrades[carId][stat];
      if (lv >= MAX_UPGRADE_LEVEL) return 'Maxed out';
      const err = spend(p, upgradeCost(getVehicle(carId), lv), 1);
      if (err) return err;
      p.upgrades[carId][stat] = lv + 1;
      return null;
    }),
    buyPaint: (paintId) => mutate((p) => {
      if (p.ownedPaints.includes(paintId)) return 'Already owned';
      const d = getPaint(paintId);
      const err = spend(p, d.price, d.levelRequired);
      if (err) return err;
      p.ownedPaints.push(paintId);
      return null;
    }),
    setPaint: (carId, paintId) => void mutate((p) => (p.ownedPaints.includes(paintId) ? ((p.carPaint[carId] = paintId), null) : 'Locked')),
    buyGlow: (id) => mutate((p) => {
      if (p.ownedGlows.includes(id)) return 'Already owned';
      const d = getGlow(id);
      const err = spend(p, d.price, d.levelRequired);
      if (err) return err;
      p.ownedGlows.push(id);
      p.selectedGlow = id;
      return null;
    }),
    selectGlow: (id) => void mutate((p) => (p.ownedGlows.includes(id) ? ((p.selectedGlow = id), null) : 'Locked')),
    buySmoke: (id) => mutate((p) => {
      if (p.ownedSmokes.includes(id)) return 'Already owned';
      const d = getSmoke(id);
      const err = spend(p, d.price, d.levelRequired);
      if (err) return err;
      p.ownedSmokes.push(id);
      p.selectedSmoke = id;
      return null;
    }),
    selectSmoke: (id) => void mutate((p) => (p.ownedSmokes.includes(id) ? ((p.selectedSmoke = id), null) : 'Locked')),

    claimMission: (id) => {
      const m = MISSIONS.find((x) => x.id === id);
      const st = get().profile.missions[id];
      if (!m || !st?.done || st.claimed) return null;
      let levels: number[] = [];
      const res = mutate((p) => {
        p.missions[id] = { ...st, claimed: true };
        p.coins += m.rewardCoins;
        p.stats.missionsCompleted += 1;
        const lv = addXp(p.level, p.xp, m.rewardXp);
        p.level = lv.level;
        p.xp = lv.xp;
        levels = lv.reached;
        p.coins += lv.reached.reduce((s, l) => s + levelUpReward(l), 0);
        return null;
      });
      return { coins: m.rewardCoins, xp: m.rewardXp, levels, achievements: res.ok ? res.achievements : [] };
    },

    updateSettings: (s) => {
      const p = clone(get().profile);
      p.settings = { ...p.settings, ...s };
      set({ profile: p });
      storage.save(p);
    },
    setName: (name) => {
      const p = clone(get().profile);
      p.playerName = name.replace(/[^\w \-.]/g, '').slice(0, 16) || 'Racer';
      set({ profile: p });
      storage.save(p);
    },

    commitRun: (run) => {
      const { profile, result } = applyRun(get().profile, run);
      set({ profile });
      storage.save(profile);
      return result;
    },

    resetProgress: () => {
      storage.clear();
      const fresh = defaultProfile();
      fresh.settings = get().profile.settings;
      set({ profile: fresh });
      storage.save(fresh);
    },
  };
});
