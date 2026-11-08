import { Flag } from '../common/Flag';
import { useEffect } from 'react';
import { CITIES } from '../../game/cities';
import type { CityDefinition } from '../../game/cities/types';
import { MODE_INFO, type GameMode } from '../../game/missions/Missions';
import { go, play, previewCity, uiSound } from '../../store/actions';
import { useGame } from '../../store/gameStore';
import { useProfile } from '../../store/profileStore';
import { CityArt } from '../common/CityArt';
import { Bar, ScreenHeader, formatTime } from '../common/common';

export function cityCompletion(def: CityDefinition, discovered: string[] = [], tokens: number[] = []) {
  const l = def.landmarks.length ? discovered.length / def.landmarks.length : 0;
  return Math.round((l * 0.75 + Math.min(1, tokens.length / 25) * 0.25) * 100);
}

const MODES: GameMode[] = ['free', 'explore', 'checkpoints', 'timetrial', 'collect'];

export function CitySelect() {
  const intent = useGame((s) => s.cityIntent);
  const mode = useGame((s) => s.mode);
  const current = useGame((s) => s.city);
  const prof = useProfile();

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

  const choose = (id: CityDefinition['id']) => {
    if (intent === 'play') void play(id, mode);
    else {
      void previewCity(id);
      go('menu');
    }
  };

  return (
    <div className="screen city-select">
      <ScreenHeader kicker={intent === 'play' ? 'Step 1 · Choose a mode and a city' : 'Menu backdrop'} title={intent === 'play' ? 'Where to?' : 'Select City'} />
      {intent === 'play' && (
        <div className="mode-tabs">
          {MODES.map((m) => (
            <button
              key={m}
              className={`mode-tab ${mode === m ? 'active' : ''}`}
              onMouseEnter={() => uiSound('hover')}
              onClick={() => {
                uiSound('click');
                useGame.getState().set({ mode: m });
              }}
            >
              <span className="mt-icon">{MODE_INFO[m].icon}</span>
              <span className="mt-name">{MODE_INFO[m].name}</span>
            </button>
          ))}
          <p className="mode-desc">{MODE_INFO[mode].description}</p>
        </div>
      )}
      <div className="city-grid">
        {CITIES.map((c, i) => {
          const disc = prof.discovered[c.id] ?? [];
          const toks = prof.tokens[c.id] ?? [];
          const pct = cityCompletion(c, disc, toks);
          const best = prof.bestTimes[c.id];
          const medal = prof.medals[c.id];
          return (
            <button
              key={c.id}
              className={`city-card ${current === c.id ? 'current' : ''}`}
              style={{ ['--accent' as string]: c.theme.accent, animationDelay: `${i * 60}ms` }}
              onMouseEnter={() => uiSound('hover')}
              onClick={() => {
                uiSound('click');
                choose(c.id);
              }}
            >
              <div className="cc-art">
                <CityArt id={c.id} />
                <span className="cc-flag"><Flag id={c.id} /></span>
                {pct >= 100 && <span className="cc-badge">100%</span>}
              </div>
              <div className="cc-body">
                <div className="cc-top">
                  <h2>{c.name}</h2>
                  <span className="cc-country">{c.country}</span>
                </div>
                <p className="cc-tag">{c.description}</p>
                <div className="cc-stats">
                  <span>🏛️ {disc.length}/{c.landmarks.length} landmarks</span>
                  <span>⭐ {toks.length}/25</span>
                  {best !== undefined && <span>🏁 {formatTime(best)} {medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : ''}</span>}
                </div>
                <div className="cc-progress">
                  <Bar value={pct / 100} color={c.theme.accent} />
                  <span>{pct}% explored</span>
                </div>
                <div className="cc-cta">{intent === 'play' ? `Drive · ${MODE_INFO[mode].short}` : current === c.id ? 'Showing now' : 'Show in menu'} →</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
