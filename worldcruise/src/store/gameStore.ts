import { create } from 'zustand';
import type { CityId } from '../game/cities/types';
import type { GameMode, Objective } from '../game/missions/Missions';

export type Screen = 'menu' | 'cities' | 'garage' | 'discoveries' | 'settings' | 'loading' | 'playing';

export interface Notice {
  id: number;
  kind: 'landmark' | 'token' | 'checkpoint' | 'info' | 'level';
  title: string;
  body?: string;
  icon?: string;
  xp?: number;
}

export interface Hud {
  speed: number;
  gear: string;
  rpm: number;
  boost: number;
  boosting: boolean;
  drifting: boolean;
  x: number;
  z: number;
  heading: number;
  fps: number;
  camera: string;
  night: number;
  hour: number;
}

export interface RunResult {
  mode: GameMode;
  success: boolean;
  time: number;
  medal?: 'gold' | 'silver' | 'bronze' | null;
  xp: number;
  newBest?: boolean;
  medalTimes?: [number, number, number];
}

interface GameState {
  screen: Screen;
  /** Screen to return to from settings. */
  returnTo: Screen;
  mode: GameMode;
  city: CityId;
  /** Whether the city screen starts a drive or only changes the menu city. */
  cityIntent: 'play' | 'browse';
  paused: boolean;
  mapOpen: boolean;
  loading: { progress: number; label: string };
  hud: Hud;
  notices: Notice[];
  objective: Objective | null;
  result: RunResult | null;
  engineReady: boolean;
  set(p: Partial<GameState>): void;
  notify(n: Omit<Notice, 'id'>): void;
  dismiss(id: number): void;
}

let nid = 1;

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  returnTo: 'menu',
  mode: 'free',
  city: 'paris',
  cityIntent: 'play',
  paused: false,
  mapOpen: false,
  loading: { progress: 0, label: '' },
  hud: { speed: 0, gear: 'N', rpm: 900, boost: 1, boosting: false, drifting: false, x: 0, z: 0, heading: 0, fps: 60, camera: 'chase', night: 0, hour: 12 },
  notices: [],
  objective: null,
  result: null,
  engineReady: false,
  set: (p) => set(p),
  notify: (n) => {
    const notice = { ...n, id: nid++ };
    set({ notices: [...get().notices.slice(-4), notice] });
    const ttl = n.kind === 'landmark' ? 7000 : n.kind === 'level' ? 5000 : 2600;
    setTimeout(() => get().dismiss(notice.id), ttl);
  },
  dismiss: (id) => set({ notices: get().notices.filter((x) => x.id !== id) }),
}));
