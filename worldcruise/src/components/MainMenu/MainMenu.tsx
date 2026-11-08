import { Flag } from '../common/Flag';
import { useEffect, useState } from 'react';
import { go, uiSound } from '../../store/actions';
import { useGame } from '../../store/gameStore';
import { useProfile } from '../../store/profileStore';
import { CITIES, cityById } from '../../game/cities';
import { levelForXp } from '../../data/vehicles';
import { Kbd } from '../common/common';

const ITEMS = [
  { id: 'play', label: 'Play', sub: 'Pick a city and hit the road' },
  { id: 'cities', label: 'Select City', sub: 'Change the city behind this menu' },
  { id: 'garage', label: 'Garage', sub: 'Choose and paint your car' },
  { id: 'discoveries', label: 'Discoveries', sub: 'Your landmark collection' },
  { id: 'settings', label: 'Settings', sub: 'Graphics, audio and controls' },
] as const;

export function MainMenu() {
  const city = useGame((s) => s.city);
  const hour = useGame((s) => s.hud.hour);
  const xp = useProfile((s) => s.xp);
  const discovered = useProfile((s) => s.discovered);
  const [focus, setFocus] = useState(0);
  const lvl = levelForXp(xp);
  const def = cityById(city);
  const totalLandmarks = CITIES.reduce((n, c) => n + c.landmarks.length, 0);
  const found = CITIES.reduce((n, c) => n + (discovered[c.id]?.length ?? 0), 0);

  const activate = (id: (typeof ITEMS)[number]['id']) => {
    if (id === 'play') useGame.getState().set({ screen: 'cities', cityIntent: 'play' });
    else if (id === 'cities') useGame.getState().set({ screen: 'cities', cityIntent: 'browse' });
    else go(id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setFocus((f) => (f + 1) % ITEMS.length);
        uiSound('hover');
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        setFocus((f) => (f + ITEMS.length - 1) % ITEMS.length);
        uiSound('hover');
      } else if (e.code === 'Enter' || e.code === 'Space') {
        uiSound('click');
        activate(ITEMS[focus].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  return (
    <div className="main-menu">
      <div className="menu-left">
        <div className="logo">
          <span className="logo-world">WORLD</span>
          <span className="logo-cruise">CRUISE</span>
        </div>
        <p className="logo-tag">Drive the world’s great cities. Find every landmark.</p>
        <nav className="menu-list">
          {ITEMS.map((it, i) => (
            <button
              key={it.id}
              className={`menu-item ${focus === i ? 'focus' : ''} ${it.id === 'play' ? 'menu-play' : ''}`}
              onMouseEnter={() => {
                setFocus(i);
                uiSound('hover');
              }}
              onClick={() => {
                uiSound('click');
                activate(it.id);
              }}
            >
              <span className="mi-index">0{i + 1}</span>
              <span className="mi-text">
                <span className="mi-label">{it.label}</span>
                <span className="mi-sub">{it.sub}</span>
              </span>
              <span className="mi-arrow">→</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="menu-profile glass">
        <div className="lvl-ring" style={{ ['--p' as string]: lvl.progress }}>
          <span>{lvl.level}</span>
        </div>
        <div>
          <div className="mp-title">Explorer level {lvl.level}</div>
          <div className="mp-sub">
            {xp.toLocaleString()} XP · {found}/{totalLandmarks} landmarks
          </div>
        </div>
      </div>

      <div className="menu-now glass">
        <Flag id={def.id} size={34} />
        <div>
          <div className="mp-title">{def.name}</div>
          <div className="mp-sub">
            {def.country} · {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}
          </div>
        </div>
      </div>
      <div className="menu-hint">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> navigate · <Kbd>Enter</Kbd> select
      </div>
    </div>
  );
}
