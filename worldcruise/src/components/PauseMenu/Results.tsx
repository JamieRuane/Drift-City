import { useEffect } from 'react';
import { restart, toMenu, changeCity } from '../../store/actions';
import { useGame } from '../../store/gameStore';
import { getGame } from '../../game/core/instance';
import { Button, formatTime } from '../common/common';

export function Results() {
  const r = useGame((s) => s.result)!;
  useEffect(() => {
    getGame()?.setPaused(true);
  }, []);
  const medalIcon = r.medal === 'gold' ? '🥇' : r.medal === 'silver' ? '🥈' : r.medal === 'bronze' ? '🥉' : '🏁';
  const title =
    r.mode === 'timetrial' ? (r.medal ? `${r.medal[0].toUpperCase()}${r.medal.slice(1)} medal!` : 'Finished')
      : r.mode === 'checkpoints' ? (r.success ? 'Challenge complete!' : 'Out of time')
        : 'All tokens collected!';
  return (
    <div className="overlay">
      <div className="results glass">
        <div className="res-icon">{r.success ? medalIcon : '⌛'}</div>
        <h1>{title}</h1>
        {r.mode === 'timetrial' && (
          <>
            <div className="res-time">{formatTime(r.time)}</div>
            {r.newBest && <div className="res-best">New personal best</div>}
            {r.medalTimes && (
              <div className="res-medals">
                <span>🥇 {formatTime(r.medalTimes[0])}</span>
                <span>🥈 {formatTime(r.medalTimes[1])}</span>
                <span>🥉 {formatTime(r.medalTimes[2])}</span>
              </div>
            )}
          </>
        )}
        {r.mode === 'checkpoints' && r.success && <div className="res-time">{r.time.toFixed(1)}s left</div>}
        <div className="res-xp">+{r.xp} XP</div>
        <div className="pause-buttons">
          <Button variant="primary" onClick={restart}>Try again</Button>
          <Button onClick={changeCity}>Change city</Button>
          <Button onClick={toMenu}>Main menu</Button>
        </div>
      </div>
    </div>
  );
}
