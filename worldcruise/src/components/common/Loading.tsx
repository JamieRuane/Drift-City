import { Flag } from './Flag';
import { useGame } from '../../store/gameStore';
import { cityById } from '../../game/cities';
import { CityArt } from './CityArt';
import { MODE_INFO } from '../../game/missions/Missions';

const TIPS = [
  'Hold SPACE through a corner to kick the tail out — drifting refills your boost faster.',
  'Drive close to a landmark to discover it and earn exploration XP.',
  'Golden tokens hide on streets, plazas and parks. Check the minimap.',
  'Press C to switch between chase, far chase and cockpit cameras.',
  'Drag with the mouse to look around; scroll to zoom the camera.',
  'Press R if you get stuck — you will be placed back on the nearest road.',
  'Traffic drives on the left in London, Tokyo and Dublin.',
  'Press M for the full city map.',
];

export function Loading() {
  const { loading, city, mode } = useGame();
  const def = cityById(city);
  const tip = TIPS[Math.floor((Date.now() / 1000) % TIPS.length)];
  return (
    <div className="loading-screen" style={{ background: `linear-gradient(160deg, ${def.theme.sky[1]}, ${def.theme.sky[0]})` }}>
      <div className="loading-art">
        <CityArt id={def.id} />
      </div>
      <div className="loading-body">
        <div className="kicker">{MODE_INFO[mode].icon} {MODE_INFO[mode].name}</div>
        <h1>
          <Flag id={def.id} size={52} /> {def.name}
        </h1>
        <p className="loading-tag">{def.tagline}</p>
        <div className="loading-bar">
          <div className="loading-fill" style={{ width: `${loading.progress * 100}%` }} />
        </div>
        <div className="loading-label">{loading.label}…</div>
        <p className="tip">💡 {tip}</p>
      </div>
    </div>
  );
}
