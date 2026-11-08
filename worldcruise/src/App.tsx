import { useEffect, useRef } from 'react';
import { createGame } from './game/core/instance';
import { bootMenu } from './store/actions';
import { useGame } from './store/gameStore';
import { MainMenu } from './components/MainMenu/MainMenu';
import { CitySelect } from './components/CitySelect/CitySelect';
import { Garage } from './components/Garage/Garage';
import { Discoveries } from './components/Discovery/Discoveries';
import { SettingsScreen } from './components/Settings/Settings';
import { HUD } from './components/HUD/HUD';
import { PauseMenu } from './components/PauseMenu/PauseMenu';
import { Loading } from './components/common/Loading';
import { Results } from './components/PauseMenu/Results';
import { getGame } from './game/core/instance';

export function App() {
  const ref = useRef<HTMLDivElement>(null);
  const screen = useGame((s) => s.screen);
  const paused = useGame((s) => s.paused);
  const result = useGame((s) => s.result);
  const ready = useGame((s) => s.engineReady);

  useEffect(() => {
    let alive = true;
    createGame(ref.current!).then(() => {
      if (alive) void bootMenu();
    }).catch((e) => console.error('Failed to start WORLDCRUISE', e));
    const unlock = () => getGame()?.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      alive = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const inMenus = screen !== 'playing' && screen !== 'loading';
  return (
    <div className="app">
      <div ref={ref} className="viewport" />
      {inMenus && <div className="menu-vignette" />}
      {!ready && screen === 'menu' && <div className="boot">Loading WORLDCRUISE…</div>}
      {screen === 'menu' && <MainMenu />}
      {screen === 'cities' && <CitySelect />}
      {screen === 'garage' && <Garage />}
      {screen === 'discoveries' && <Discoveries />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'loading' && <Loading />}
      {screen === 'playing' && <HUD />}
      {screen === 'playing' && paused && !result && <PauseMenu />}
      {screen === 'playing' && result && <Results />}
    </div>
  );
}
