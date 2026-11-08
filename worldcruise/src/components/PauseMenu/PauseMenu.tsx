import { Flag } from '../common/Flag';
import { changeCity, go, restart, resume, toMenu } from '../../store/actions';
import { useGame } from '../../store/gameStore';
import { useProfile } from '../../store/profileStore';
import { cityById } from '../../game/cities';
import { MODE_INFO } from '../../game/missions/Missions';
import { Button } from '../common/common';

export function PauseMenu() {
  const city = useGame((s) => s.city);
  const mode = useGame((s) => s.mode);
  const disc = useProfile((s) => s.discovered[city]?.length ?? 0);
  const toks = useProfile((s) => s.tokens[city]?.length ?? 0);
  const def = cityById(city);
  return (
    <div className="overlay">
      <div className="pause glass">
        <div className="kicker">Paused · {MODE_INFO[mode].name}</div>
        <h1>
          <Flag id={def.id} size={36} /> {def.name}
        </h1>
        <div className="pause-stats">
          <span>🏛️ {disc}/{def.landmarks.length} landmarks</span>
          <span>⭐ {toks}/25 tokens</span>
        </div>
        <div className="pause-buttons">
          <Button variant="primary" onClick={resume}>Resume</Button>
          <Button onClick={restart}>Restart</Button>
          <Button onClick={changeCity}>Change city</Button>
          <Button onClick={() => go('settings')}>Settings</Button>
          <Button onClick={toMenu}>Main menu</Button>
        </div>
      </div>
    </div>
  );
}
