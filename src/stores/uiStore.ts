import { create } from 'zustand';
import type { HudSnapshot } from '../game/engine/types';
import type { Popup } from '../game/scoring/ScoreSystem';
import type { RunResult } from '../systems/progression/applyRun';
import type { GameMode } from '../game/scoring/runStats';

export type Screen =
  | 'loading' | 'menu' | 'modes' | 'garage' | 'upgrades' | 'missions' | 'stats' | 'settings'
  | 'playing' | 'paused' | 'gameover';

export interface Toast {
  id: number;
  kind: 'achievement' | 'level' | 'mission' | 'daily' | 'info';
  title: string;
  body: string;
  icon: string;
}

export interface LivePopup extends Popup {
  born: number;
}

interface UiState {
  screen: Screen;
  /** where the settings screen returns to */
  settingsReturn: Screen;
  hud: HudSnapshot | null;
  popups: LivePopup[];
  countdown: number | null;
  result: RunResult | null;
  endReason: 'wrecked' | 'timeup' | null;
  toasts: Toast[];
  mode: GameMode;
  garageCar: string | null;
  setScreen: (s: Screen) => void;
  openSettings: (from: Screen) => void;
  setHud: (h: HudSnapshot | null) => void;
  addPopups: (p: Popup[]) => void;
  prunePopups: () => void;
  setCountdown: (n: number | null) => void;
  setResult: (r: RunResult | null, reason: 'wrecked' | 'timeup' | null) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setMode: (m: GameMode) => void;
  setGarageCar: (id: string | null) => void;
}

let toastId = 0;

export const useUi = create<UiState>((set, get) => ({
  screen: 'loading',
  settingsReturn: 'menu',
  hud: null,
  popups: [],
  countdown: null,
  result: null,
  endReason: null,
  toasts: [],
  mode: 'endless',
  garageCar: null,
  setScreen: (screen) => set({ screen }),
  openSettings: (from) => set({ screen: 'settings', settingsReturn: from }),
  setHud: (hud) => set({ hud }),
  addPopups: (p) => {
    const now = performance.now();
    set({ popups: [...get().popups, ...p.map((x) => ({ ...x, born: now }))].slice(-6) });
  },
  prunePopups: () => {
    const now = performance.now();
    const keep = get().popups.filter((p) => now - p.born < 1400);
    if (keep.length !== get().popups.length) set({ popups: keep });
  },
  setCountdown: (countdown) => set({ countdown }),
  setResult: (result, endReason) => set({ result, endReason }),
  pushToast: (t) => {
    const toast = { ...t, id: ++toastId };
    set({ toasts: [...get().toasts, toast].slice(-4) });
    setTimeout(() => get().dismissToast(toast.id), 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setMode: (mode) => set({ mode }),
  setGarageCar: (garageCar) => set({ garageCar }),
}));
