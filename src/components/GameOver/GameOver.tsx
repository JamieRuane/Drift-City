import { useUi } from '../../stores/uiStore';
import { useProfile } from '../../stores/profileStore';
import { quitToMenu, retry, sfx } from '../../stores/gameActions';
import { fmtDistance, fmtInt, fmtTime } from '../../utils/format';
import { useCountUp, useIsTouch, useKeys } from '../../hooks/hooks';
import { xpToNext } from '../../systems/progression/progression';
import { Coin } from '../common/common';

export function GameOver() {
  const result = useUi((s) => s.result);
  const reason = useUi((s) => s.endReason);
  const level = useProfile((s) => s.profile.level);
  const xp = useProfile((s) => s.profile.xp);
  const units = useProfile((s) => s.profile.settings.units);
  const touch = useIsTouch();
  const score = useCountUp(result?.run.score ?? 0, 1200, 150);
  useKeys(['Enter', 'Space', 'KeyR'], () => retry());
  useKeys(['Escape'], () => quitToMenu());
  if (!result) return null;
  const r = result.run;
  const totalCoins = result.coinsCollected + result.bonusCoins + result.dailyCoins + result.levelUpCoins;
  const speed = units === 'mph' ? `${Math.round(r.maxSpeed * 0.621371)} mph` : `${Math.round(r.maxSpeed)} km/h`;
  const modeLabel = r.mode === 'timetrial' ? 'TIME TRIAL' : r.mode === 'daily' ? 'DAILY CHALLENGE' : 'ENDLESS';

  return (
    <div className="layer dim">
      <div className="center-wrap">
        <div className="panel gameover screen-enter">
          <div className="head">
            <div className={`reason ${reason === 'timeup' ? 'tu' : ''}`}>{reason === 'timeup' ? 'TIME UP' : 'WRECKED'} · {modeLabel}</div>
            <div className="final">{fmtInt(score)}</div>
            {result.isPersonalBest ? <div className="pb">★ NEW PERSONAL BEST ★</div> : <div className="muted">Best {fmtInt(result.previousBest)}</div>}
          </div>
          <div>
            <div className="panel-title">Run summary</div>
            <div className="kv">
              <span className="k">Distance</span><span className="v">{fmtDistance(r.distance)}</span>
              <span className="k">Time survived</span><span className="v">{fmtTime(r.time)}</span>
              <span className="k">Top speed</span><span className="v">{speed}</span>
              <span className="k">Near misses</span><span className="v">{r.nearMisses}</span>
              <span className="k">Vehicles overtaken</span><span className="v">{r.overtakes}</span>
              <span className="k">Best combo</span><span className="v">{r.maxCombo}x</span>
              <span className="k">Longest drift</span><span className="v">{r.longestDrift.toFixed(1)} s</span>
              <span className="k">Drifts</span><span className="v">{r.drifts}</span>
            </div>
          </div>
          <div>
            <div className="panel-title">Rewards</div>
            <div className="reward-list">
              <div className="reward"><span>Coins collected</span><span className="gold">+{fmtInt(result.coinsCollected)}</span></div>
              <div className="reward"><span>Score bonus</span><span className="gold">+{fmtInt(result.bonusCoins)}</span></div>
              {result.dailyCoins > 0 && <div className="reward"><span>Daily challenge ✓</span><span className="gold">+{fmtInt(result.dailyCoins)}</span></div>}
              {result.levelUpCoins > 0 && <div className="reward"><span>Level up → {level}</span><span className="gold">+{fmtInt(result.levelUpCoins)}</span></div>}
              <div className="reward total"><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Coin /> Total</span><span className="gold">+{fmtInt(totalCoins)}</span></div>
              <div className="reward"><span>XP</span><span className="cyan">+{fmtInt(result.xpGained)}</span></div>
              <div className="xp-bar" style={{ width: '100%' }}><i style={{ width: `${Math.min(100, (xp / xpToNext(level)) * 100)}%` }} /></div>
              <div className="muted" style={{ fontSize: 13 }}>Level {level} · {xp} / {xpToNext(level)} XP</div>
              {result.missionsCompleted.map((m) => (
                <div key={m.id} className="reward" style={{ borderColor: 'rgba(157,255,58,.5)' }}><span>📋 {m.title}</span><span className="lime">Claim in Missions</span></div>
              ))}
              {result.achievements.map((a) => (
                <div key={a.id} className="reward" style={{ borderColor: 'rgba(255,194,26,.5)' }}><span>{a.icon} {a.name}</span><span className="gold">+{a.rewardCoins}</span></div>
              ))}
            </div>
          </div>
          <div className="go-actions">
            <button className="btn primary big" onClick={() => { sfx.click(); retry(); }} autoFocus>↻ Retry</button>
            <button className="btn big" onClick={() => { sfx.click(); quitToMenu(); }}>Main menu</button>
          </div>
          {!touch && <div className="go-hint">Press ENTER to retry instantly · ESC for menu</div>}
        </div>
      </div>
    </div>
  );
}
