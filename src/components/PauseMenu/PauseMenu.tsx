import { useUi } from '../../stores/uiStore';
import { quitToMenu, resumeGame, retry, sfx } from '../../stores/gameActions';
import { fmtDistance, fmtInt, fmtTime } from '../../utils/format';
import { useKeys } from '../../hooks/hooks';

export function PauseMenu() {
  const hud = useUi((s) => s.hud);
  const openSettings = useUi((s) => s.openSettings);
  useKeys(['KeyR'], () => retry());
  const r = hud?.run;
  const act = (fn: () => void) => () => {
    sfx.click();
    fn();
  };
  return (
    <div className="layer dim">
      <div className="center-wrap">
        <div className="panel pause screen-enter">
          <h2>PAUSED</h2>
          {r && hud && (
            <div className="kv" style={{ margin: '4px 0 10px' }}>
              <span className="k">Score</span><span className="v">{fmtInt(hud.score)}</span>
              <span className="k">Distance</span><span className="v">{fmtDistance(r.distance)}</span>
              <span className="k">Time</span><span className="v">{fmtTime(r.time)}</span>
              <span className="k">Coins</span><span className="v gold">{fmtInt(r.coins)}</span>
              <span className="k">Near misses</span><span className="v">{r.nearMisses}</span>
              <span className="k">Best combo</span><span className="v">{r.maxCombo}x</span>
            </div>
          )}
          <button className="btn primary" onClick={act(resumeGame)} autoFocus>Resume</button>
          <button className="btn" onClick={act(retry)}>Restart</button>
          <button className="btn" onClick={act(() => openSettings('paused'))}>Settings</button>
          <button className="btn danger" onClick={act(quitToMenu)}>Main menu</button>
          <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>Progress from an abandoned run is not saved.</div>
        </div>
      </div>
    </div>
  );
}
