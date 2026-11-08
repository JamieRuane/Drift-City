import { GameEngine } from '../game/engine/GameEngine';
import type { EngineCallbacks, HudSnapshot } from '../game/engine/types';
import type { GameMode, RunStats } from '../game/scoring/runStats';
import { useProfile } from './profileStore';
import { useUi, type Screen } from './uiStore';
import { getVehicle } from '../data/vehicles';
import { getGlow, getPaint, getSmoke } from '../data/cosmetics';
import { dailyChallengeFor } from '../data/daily';
import { applyRun } from '../systems/progression/applyRun';
import { unlocksAtLevel } from '../systems/progression/progression';
import { todayKey } from '../utils/format';
import type { AchievementDef } from '../data/achievements';

/**
 * The bridge between React and the engine. Components call these functions; the engine reports back
 * through callbacks which update the zustand stores.
 */

let engine: GameEngine | null = null;
export const getEngine = () => engine;

const MISSION_BONUS = 2500;
/** Achievements that only make sense once a run is finished. */
const END_ONLY = new Set(['first_drive', 'centurion', 'veteran']);

let liveTimer = 0;
const liveShown = new Set<string>();

function engineSettings() {
  const s = useProfile.getState().profile.settings;
  return { quality: s.quality, cameraShake: s.cameraShake, masterVolume: s.masterVolume, musicVolume: s.musicVolume, sfxVolume: s.sfxVolume, muted: s.muted };
}

export function appearanceFor(carId?: string) {
  const p = useProfile.getState().profile;
  const id = carId ?? p.selectedCar;
  return {
    vehicle: getVehicle(id),
    paint: getPaint(p.carPaint[id]),
    underglow: getGlow(p.selectedGlow).color,
  };
}

function liveCheck(h: HudSnapshot) {
  const now = performance.now();
  if (now - liveTimer < 900 || h.phase !== 'running') return;
  liveTimer = now;
  const { result } = applyRun(useProfile.getState().profile, h.run);
  const ui = useUi.getState();
  for (const m of result.missionsCompleted) {
    const key = `m:${m.id}`;
    if (liveShown.has(key)) continue;
    liveShown.add(key);
    ui.pushToast({ kind: 'mission', title: 'Mission complete', body: m.title, icon: '📋' });
    engine?.awardBonus(MISSION_BONUS, 'MISSION COMPLETE');
  }
  for (const a of result.achievements) {
    if (END_ONLY.has(a.id) || liveShown.has(`a:${a.id}`)) continue;
    liveShown.add(`a:${a.id}`);
    toastAchievement(a);
  }
  if (result.dailyCompleted && !liveShown.has('daily')) {
    liveShown.add('daily');
    ui.pushToast({ kind: 'daily', title: 'Daily challenge complete', body: `+${result.dailyCoins} coins`, icon: '📅' });
    engine?.awardBonus(MISSION_BONUS, 'DAILY COMPLETE');
  }
}

export function toastAchievement(a: AchievementDef) {
  useUi.getState().pushToast({ kind: 'achievement', title: `Achievement: ${a.name}`, body: `${a.description}  +${a.rewardCoins} coins`, icon: a.icon });
}

function onRunEnd(run: RunStats, reason: 'wrecked' | 'timeup') {
  const result = useProfile.getState().commitRun(run);
  const ui = useUi.getState();
  for (const a of result.achievements) if (!liveShown.has(`a:${a.id}`)) toastAchievement(a);
  for (const lv of result.levelsReached) {
    const unlocks = unlocksAtLevel(lv);
    ui.pushToast({ kind: 'level', title: `Level ${lv}!`, body: unlocks.length ? `Unlocked: ${unlocks.join(', ')}` : 'Bonus coins awarded', icon: '⭐' });
  }
  if (result.levelsReached.length || result.achievements.length) engine?.audio.fanfare();
  ui.setResult(result, reason);
  // short beat so the wreck/time-up moment is visible before the overlay
  setTimeout(() => {
    if (useUi.getState().screen === 'playing' || useUi.getState().screen === 'paused') ui.setScreen('gameover');
  }, reason === 'timeup' ? 900 : 300);
}

export async function createEngine(container: HTMLElement) {
  if (engine) return engine;
  const ui = useUi.getState();
  const callbacks: EngineCallbacks = {
    onHud: (h) => {
      useUi.getState().setHud(h);
      liveCheck(h);
    },
    onPopups: (p) => useUi.getState().addPopups(p),
    onCountdown: (n) => useUi.getState().setCountdown(n),
    onRunEnd,
    onPauseRequest: () => togglePause(),
  };
  const e = new GameEngine(container, engineSettings(), callbacks);
  engine = e;
  await e.init();
  if (engine !== e) return e; // disposed while initialising (React StrictMode remount)
  if (import.meta.env.DEV) Object.assign(window, { __drift: { engine: e, ui: useUi, profile: useProfile } });
  e.setAppearance(appearanceFor());
  useProfile.subscribe((st, prev) => {
    if (st.profile.settings !== prev.profile.settings) e.applySettings(engineSettings());
  });
  ui.setScreen('menu');
  return e;
}

export function destroyEngine() {
  engine?.dispose();
  engine = null;
}

export function startGame(mode: GameMode) {
  if (!engine) return;
  const p = useProfile.getState().profile;
  const id = p.selectedCar;
  const today = todayKey();
  const seed = mode === 'daily' ? dailyChallengeFor(today).seed : Math.floor(Math.random() * 2 ** 31);
  liveShown.clear();
  liveTimer = 0;
  const ui = useUi.getState();
  ui.setMode(mode);
  ui.setResult(null, null);
  ui.setHud(null);
  ui.setCountdown(null);
  useUi.setState({ popups: [] });
  engine.startRun({
    mode, seed, vehicle: getVehicle(id), upgrades: p.upgrades[id], paint: getPaint(p.carPaint[id]),
    underglow: getGlow(p.selectedGlow).color, smoke: getSmoke(p.selectedSmoke).color ?? '#d8dce6',
  });
  ui.setScreen('playing');
}

export function retry() {
  startGame(useUi.getState().mode);
}

export function togglePause() {
  const ui = useUi.getState();
  if (!engine) return;
  if (ui.screen === 'playing' && engine.isRunning) {
    engine.pause();
    ui.setScreen('paused');
  } else if (ui.screen === 'paused') {
    resumeGame();
  }
}

export function resumeGame() {
  engine?.resume();
  useUi.getState().setScreen('playing');
}

export function goTo(screen: Screen) {
  const ui = useUi.getState();
  if (!engine) return;
  engine.audio.unlock();
  if (screen === 'garage' || screen === 'upgrades') {
    engine.setView('garage');
    engine.setAppearance(appearanceFor(ui.garageCar ?? undefined));
  } else if (screen !== 'playing' && screen !== 'paused' && screen !== 'gameover' && !(screen === 'settings' && ui.screen === 'paused')) {
    engine.setView('attract');
    engine.setAppearance(appearanceFor());
  }
  ui.setScreen(screen);
}

export function quitToMenu() {
  if (!engine) return;
  useUi.getState().setHud(null);
  engine.setView('attract');
  engine.setAppearance(appearanceFor());
  useUi.getState().setScreen('menu');
}

/** Garage preview of a car that may not be owned/selected. */
export function previewCar(carId: string) {
  useUi.getState().setGarageCar(carId);
  engine?.setAppearance(appearanceFor(carId));
}

export const sfx = {
  click: () => engine?.audio.click(),
  purchase: () => engine?.audio.purchase(),
  denied: () => engine?.audio.denied(),
};
