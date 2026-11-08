import { getGame } from '../game/core/instance';
import { useGame, type Screen } from './gameStore';
import { useProfile } from './profileStore';
import type { CityId } from '../game/cities/types';
import type { GameMode } from '../game/missions/Missions';

/** The only place where UI intent is translated into engine calls. */

let loadedCity: CityId | null = null;
let loading: Promise<unknown> | null = null;

async function ensureCity(id: CityId, showProgress: boolean) {
  const game = getGame();
  if (!game) return false;
  if (loadedCity === id && game.cityData) return true;
  const g = useGame.getState();
  try {
    loading = game.loadCity(id, (p, label) => {
      if (showProgress) g.set({ loading: { progress: p, label } });
    });
    await loading;
    loadedCity = id;
    return true;
  } catch (e) {
    if ((e as Error).message !== 'superseded') console.error(e);
    return false;
  }
}

export async function bootMenu() {
  const city = useProfile.getState().lastCity;
  useGame.getState().set({ city });
  const ok = await ensureCity(city, false);
  if (ok && useGame.getState().screen !== 'playing') getGame()?.startAttract();
  useGame.getState().set({ engineReady: true });
}

export function go(screen: Screen) {
  const g = useGame.getState();
  if (screen === 'settings') g.set({ returnTo: g.screen === 'playing' ? 'playing' : g.screen, screen });
  else g.set({ screen });
}

export async function previewCity(id: CityId) {
  useProfile.getState().setLastCity(id);
  useGame.getState().set({ city: id });
  const ok = await ensureCity(id, false);
  if (ok && useGame.getState().screen !== 'playing' && useGame.getState().screen !== 'loading') getGame()?.startAttract();
}

export async function play(id: CityId, mode: GameMode) {
  const g = useGame.getState();
  useProfile.getState().setLastCity(id);
  g.set({ screen: 'loading', city: id, mode, loading: { progress: 0, label: 'Preparing' }, result: null, paused: false });
  getGame()?.audio.ui('start');
  const ok = await ensureCity(id, true);
  if (!ok) return;
  getGame()?.startSession(mode);
  useGame.getState().set({ screen: 'playing' });
}

export function resume() {
  getGame()?.setPaused(false);
}

export function restart() {
  getGame()?.restart();
}

export function toMenu() {
  const game = getGame();
  useGame.getState().set({ screen: 'menu', paused: false, result: null, objective: null, mapOpen: false });
  game?.endSession();
  game?.startAttract();
}

export function changeCity() {
  const game = getGame();
  game?.endSession();
  game?.startAttract();
  useGame.getState().set({ screen: 'cities', paused: false, result: null, objective: null });
}

export function uiSound(kind: 'hover' | 'click' | 'back' | 'start') {
  const a = getGame()?.audio;
  if (!a) return;
  a.unlock();
  a.ui(kind);
}
