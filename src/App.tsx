import { GameCanvas } from './components/GameCanvas/GameCanvas';
import { MainMenu, ModeSelect } from './components/MainMenu/MainMenu';
import { Garage } from './components/Garage/Garage';
import { UpgradeShop } from './components/UpgradeShop/UpgradeShop';
import { MissionPanel } from './components/MissionPanel/MissionPanel';
import { Stats } from './components/Stats/Stats';
import { Settings } from './components/Settings/Settings';
import { GameHUD } from './components/GameHUD/GameHUD';
import { PauseMenu } from './components/PauseMenu/PauseMenu';
import { GameOver } from './components/GameOver/GameOver';
import { Toasts } from './components/common/Toasts';
import { useUi } from './stores/uiStore';

export function App() {
  const screen = useUi((s) => s.screen);
  const inGame = screen === 'playing' || screen === 'paused' || screen === 'gameover' || (screen === 'settings' && useUi.getState().settingsReturn === 'paused');
  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}>
      <GameCanvas />
      {inGame && <GameHUD />}
      {screen === 'loading' && (
        <div className="loading"><div className="h-display">LOADING</div></div>
      )}
      {screen === 'menu' && <MainMenu />}
      {screen === 'modes' && <ModeSelect />}
      {screen === 'garage' && <Garage />}
      {screen === 'upgrades' && <UpgradeShop />}
      {screen === 'missions' && <MissionPanel />}
      {screen === 'stats' && <Stats />}
      {screen === 'settings' && <Settings />}
      {screen === 'paused' && <PauseMenu />}
      {screen === 'gameover' && <GameOver />}
      <Toasts />
    </div>
  );
}
