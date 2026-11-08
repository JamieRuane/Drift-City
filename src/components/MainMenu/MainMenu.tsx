import { TopBar } from '../common/common';
import { useProfile } from '../../stores/profileStore';
import { useUi } from '../../stores/uiStore';
import { goTo, sfx, startGame } from '../../stores/gameActions';
import { fmtInt, todayKey } from '../../utils/format';
import { dailyChallengeFor } from '../../data/daily';
import { activeMissions, missionState } from '../../systems/missions/missions';
import { useIsTouch, useKeys } from '../../hooks/hooks';

export function MainMenu() {
  const best = useProfile((s) => s.profile.stats.bestScore);
  const profile = useProfile((s) => s.profile);
  const openSettings = useUi((s) => s.openSettings);
  const touch = useIsTouch();
  const daily = dailyChallengeFor(todayKey());
  const dailyDone = profile.daily.date === todayKey() && profile.daily.completed;
  const claimable = activeMissions(profile).filter((m) => missionState(profile, m.id).done).length;

  useKeys(['Enter', 'Space'], () => {
    sfx.click();
    goTo('modes');
  });

  const nav = (fn: () => void) => () => {
    sfx.click();
    fn();
  };

  return (
    <div className="layer menu-shade">
      <TopBar />
      <div className="menu-root screen-enter">
        <h1 className="logo">
          <span className="l1">DRIFT</span>
          <span className="l2">CITY</span>
          <span className="tag">ENDLESS NEON HIGHWAY</span>
        </h1>
        <div className="menu-buttons">
          <button className="btn primary big" onClick={nav(() => goTo('modes'))}>
            ▶ Play <span className="k">{touch ? '' : 'ENTER'}</span>
          </button>
          <div className="menu-grid">
            <button className="btn" onClick={nav(() => goTo('garage'))}>Garage</button>
            <button className="btn" onClick={nav(() => goTo('upgrades'))}>Upgrades</button>
            <button className="btn" onClick={nav(() => goTo('missions'))}>
              Missions {claimable > 0 && <span className="chip ok">{claimable}</span>}
            </button>
            <button className="btn" onClick={nav(() => goTo('stats'))}>Statistics</button>
          </div>
          <button className="btn" onClick={nav(() => openSettings('menu'))}>Settings</button>
        </div>
        <div className="menu-footer">
          <div className="panel daily-mini">
            <div className="panel-title" style={{ marginBottom: 6 }}>Daily challenge</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{daily.title}</div>
            {dailyDone ? (
              <span className="chip ok">Completed ✓</span>
            ) : (
              <button className="btn small gold primary" onClick={nav(() => startGame('daily'))}>Play daily · +{daily.rewardCoins}</button>
            )}
          </div>
          <div className="panel best-card">
            <div className="panel-title" style={{ marginBottom: 4 }}>Best score</div>
            <div className="v">{fmtInt(best)}</div>
            {!touch && (
              <div className="controls-hint" style={{ marginTop: 8 }}>
                <span className="kbd">A</span><span className="kbd">D</span> steer · <span className="kbd">W</span> boost · <span className="kbd">S</span> brake · <span className="kbd">SPACE</span> drift
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ModeSelect() {
  const profile = useProfile((s) => s.profile);
  const daily = dailyChallengeFor(todayKey());
  const dailyDone = profile.daily.date === todayKey() && profile.daily.completed;
  useKeys(['Escape'], () => goTo('menu'));
  const play = (m: 'endless' | 'timetrial' | 'daily') => () => {
    sfx.click();
    startGame(m);
  };
  return (
    <div className="layer dim">
      <TopBar back="menu" title="SELECT MODE" />
      <div className="modes-root">
        <div className="modes screen-enter">
          <button className="panel mode-card" onClick={play('endless')}>
            <div className="icon">∞</div>
            <h3>ENDLESS</h3>
            <p>The classic. Weave through ever-thickening traffic as the highway speeds up. Three hits and you're done.</p>
            <div className="foot">
              <span className="muted">Best {fmtInt(profile.stats.bestScore)}</span>
              <span className="btn small primary">Drive</span>
            </div>
          </button>
          <button className="panel mode-card" onClick={play('timetrial')}>
            <div className="icon">⏱</div>
            <h3>TIME TRIAL</h3>
            <p>90 seconds. Starts hard, gets harder. Chain near misses and drifts for the biggest score you can.</p>
            <div className="foot">
              <span className="muted">Best {fmtInt(profile.stats.bestTimeTrial)}</span>
              <span className="btn small primary">Drive</span>
            </div>
          </button>
          <button className="panel mode-card daily" onClick={play('daily')}>
            <div className="icon">📅</div>
            <h3>DAILY CHALLENGE</h3>
            <p>Today's seeded traffic layout, the same for every driver. Objective: <b style={{ color: 'var(--text)' }}>{daily.title}</b>.</p>
            <div className="foot">
              {dailyDone ? <span className="chip ok">Completed ✓</span> : <span className="chip warn">+{daily.rewardCoins} coins · +{daily.rewardXp} XP</span>}
              <span className="btn small gold primary">Drive</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
