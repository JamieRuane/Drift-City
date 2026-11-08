import { Flag } from '../common/Flag';
import { useEffect, useState } from 'react';
import { CITIES } from '../../game/cities';
import type { CityId } from '../../game/cities/types';
import { useProfile } from '../../store/profileStore';
import { useGame } from '../../store/gameStore';
import { go, uiSound } from '../../store/actions';
import { Bar, ScreenHeader, formatTime } from '../common/common';
import { cityCompletion } from '../CitySelect/CitySelect';
import { levelForXp } from '../../data/vehicles';

export function Discoveries() {
  const prof = useProfile();
  const [city, setCity] = useState<CityId>(useGame.getState().city);
  const def = CITIES.find((c) => c.id === city) ?? CITIES[0];
  const disc = prof.discovered[def.id] ?? [];
  const toks = prof.tokens[def.id] ?? [];
  const pct = cityCompletion(def, disc, toks);
  const cityXp = def.landmarks.filter((l) => disc.includes(l.id)).reduce((n, l) => n + l.xp, 0) + toks.length * 25;
  const lvl = levelForXp(prof.xp);
  const total = CITIES.reduce((n, c) => n + c.landmarks.length, 0);
  const found = CITIES.reduce((n, c) => n + (prof.discovered[c.id]?.length ?? 0), 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        uiSound('back');
        go('menu');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="screen discoveries">
      <ScreenHeader kicker={`${found}/${total} landmarks worldwide · ${prof.xp.toLocaleString()} XP · Level ${lvl.level}`} title="Discoveries" />
      <div className="city-tabs">
        {CITIES.map((c) => {
          const p = cityCompletion(c, prof.discovered[c.id], prof.tokens[c.id]);
          return (
            <button
              key={c.id}
              className={`city-tab ${c.id === city ? 'active' : ''}`}
              style={{ ['--accent' as string]: c.theme.accent }}
              onMouseEnter={() => uiSound('hover')}
              onClick={() => {
                uiSound('click');
                setCity(c.id);
              }}
            >
              <Flag id={c.id} size={20} /> {c.name} <span className="tab-pct">{p}%</span>
            </button>
          );
        })}
      </div>
      <div className="disc-summary glass">
        <div className="ds-big" style={{ color: def.theme.accent }}>{pct}%</div>
        <div className="ds-meta">
          <div className="mp-title">{def.name} explored</div>
          <Bar value={pct / 100} color={def.theme.accent} />
          <div className="ds-row">
            <span>🏛️ {disc.length}/{def.landmarks.length} landmarks</span>
            <span>⭐ {toks.length}/25 tokens</span>
            <span>✨ {cityXp} XP earned here</span>
            {prof.bestTimes[def.id] !== undefined && <span>🏁 Best trial {formatTime(prof.bestTimes[def.id]!)}</span>}
          </div>
        </div>
      </div>
      <div className="landmark-grid">
        {def.landmarks.map((l) => {
          const got = disc.includes(l.id);
          return (
            <div key={l.id} className={`landmark-card ${got ? 'got' : 'missing'}`} style={{ ['--accent' as string]: def.theme.accent }}>
              <div className="lc-icon">{got ? l.icon : '?'}</div>
              <div className="lc-body">
                <div className="lc-name">{got ? l.name : 'Undiscovered landmark'}</div>
                <p className="lc-desc">{got ? l.description : 'Explore the streets of ' + def.name + ' to reveal this landmark. Landmark Exploration mode will point the way.'}</p>
                <div className="lc-xp">{got ? `✓ +${l.xp} XP` : `${l.xp} XP available`}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
