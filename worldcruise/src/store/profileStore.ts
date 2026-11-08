import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CityId } from '../game/cities/types';
import { VEHICLES, levelForXp, type VehicleId } from '../data/vehicles';

export type Quality = 'low' | 'medium' | 'high';
export type TimeMode = 'dynamic' | 'morning' | 'noon' | 'sunset' | 'night';

export interface Settings {
  quality: Quality;
  master: number;
  music: number;
  sfx: number;
  sensitivity: number;
  timeMode: TimeMode;
  /** Real minutes per in-game day. */
  dayMinutes: number;
  showFps: boolean;
  driveMusic: boolean;
}

export interface Profile {
  xp: number;
  discovered: Partial<Record<CityId, string[]>>;
  tokens: Partial<Record<CityId, number[]>>;
  bestTimes: Partial<Record<CityId, number>>;
  medals: Partial<Record<CityId, 'gold' | 'silver' | 'bronze'>>;
  vehicle: VehicleId;
  paints: Partial<Record<VehicleId, string>>;
  lastCity: CityId;
  settings: Settings;
  seenIntro: boolean;
}

interface ProfileActions {
  addXp(n: number): void;
  discover(city: CityId, id: string): boolean;
  takeToken(city: CityId, i: number): void;
  recordTime(city: CityId, t: number, medal: 'gold' | 'silver' | 'bronze' | null): boolean;
  setVehicle(v: VehicleId): void;
  setPaint(v: VehicleId, c: string): void;
  setLastCity(c: CityId): void;
  updateSettings(s: Partial<Settings>): void;
  resetProgress(): void;
  markIntro(): void;
}

const defaultQuality = (): Quality => {
  const mobile = /Mobi|Android/i.test(navigator.userAgent);
  return mobile ? 'low' : 'medium';
};

const initial = (): Profile => ({
  xp: 0,
  discovered: {},
  tokens: {},
  bestTimes: {},
  medals: {},
  vehicle: 'sports',
  paints: {},
  lastCity: 'paris',
  seenIntro: false,
  settings: {
    quality: defaultQuality(), master: 0.8, music: 0.5, sfx: 0.85, sensitivity: 1, timeMode: 'dynamic', dayMinutes: 16, showFps: false, driveMusic: false,
  },
});

const medalRank = { gold: 3, silver: 2, bronze: 1 } as const;

export const useProfile = create<Profile & ProfileActions>()(
  persist(
    (set, get) => ({
      ...initial(),
      addXp: (n) => set({ xp: get().xp + n }),
      discover: (city, id) => {
        const list = get().discovered[city] ?? [];
        if (list.includes(id)) return false;
        set({ discovered: { ...get().discovered, [city]: [...list, id] } });
        return true;
      },
      takeToken: (city, i) => {
        const list = get().tokens[city] ?? [];
        if (list.includes(i)) return;
        set({ tokens: { ...get().tokens, [city]: [...list, i] } });
      },
      recordTime: (city, t, medal) => {
        const best = get().bestTimes[city];
        const better = best === undefined || t < best;
        const cur = get().medals[city];
        const medals = { ...get().medals };
        if (medal && (!cur || medalRank[medal] > medalRank[cur])) medals[city] = medal;
        set({ bestTimes: better ? { ...get().bestTimes, [city]: t } : get().bestTimes, medals });
        return better;
      },
      setVehicle: (v) => {
        const spec = VEHICLES.find((x) => x.id === v);
        if (spec && levelForXp(get().xp).level >= spec.unlockLevel) set({ vehicle: v });
      },
      setPaint: (v, c) => set({ paints: { ...get().paints, [v]: c } }),
      setLastCity: (c) => set({ lastCity: c }),
      updateSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      resetProgress: () => set({ ...initial(), settings: get().settings }),
      markIntro: () => set({ seenIntro: true }),
    }),
    {
      name: 'worldcruise-profile',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Profile>;
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } };
      },
    },
  ),
);
