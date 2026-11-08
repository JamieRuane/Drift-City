import { Flag } from '../common/Flag';
import { useEffect, useState } from 'react';
import { useGame, type Notice } from '../../store/gameStore';
import { useProfile } from '../../store/profileStore';
import { cityById } from '../../game/cities';
import { levelForXp } from '../../data/vehicles';
import { MODE_INFO } from '../../game/missions/Missions';
import { Speedometer } from './Speedometer';
import { BigMap, Minimap } from './Minimap';
import { Kbd, formatTime } from '../common/common';

function TopLeft() {
  const city = useGame((s) => s.city);
  const mode = useGame((s) => s.mode);
  const hour = useGame((s) => s.hud.hour);
  const xp = useProfile((s) => s.xp);
  const disc = useProfile((s) => s.discovered[city]?.length ?? 0);
  const toks = useProfile((s) => s.tokens[city]?.length ?? 0);
  const def = cityById(city);
  const lvl = levelForXp(xp);
  const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
  const icon = hour < 5.5 || hour > 20 ? '🌙' : hour < 8 ? '🌅' : hour > 18 ? '🌇' : '☀️';
  return (
    <div className="hud-tl glass">
      <div className="tl-city">
        <Flag id={def.id} size={34} />
        <div>
          <div className="tl-name">{def.name}</div>
          <div className="tl-sub">
            {MODE_INFO[mode].name} · {icon} {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}
          </div>
        </div>
      </div>
      <div className="tl-xp">
        <span className="tl-lvl">LV {lvl.level}</span>
        <div className="xpbar">
          <div style={{ width: `${lvl.progress * 100}%` }} />
        </div>
        <span className="tl-xpn">{xp.toLocaleString()} XP</span>
      </div>
      <div className="tl-counts">
        <span>🏛️ {disc}/{def.landmarks.length}</span>
        <span>⭐ {toks}/25</span>
      </div>
    </div>
  );
}

function ObjectivePanel() {
  const o = useGame((s) => s.objective);
  if (!o) return null;
  const low = o.timerKind === 'down' && (o.timer ?? 99) < 10;
  return (
    <div className="objective glass">
      <div className="obj-title">{o.title}</div>
      {o.timer !== undefined && <div className={`obj-timer ${low ? 'low' : ''}`}>{o.timerKind === 'down' ? Math.max(0, o.timer).toFixed(1) : formatTime(o.timer)}</div>}
      <div className="obj-row">
        {o.progress && (
          <span className="obj-prog">
            {o.progress[0]}/{o.progress[1]}
          </span>
        )}
        <span>{o.detail}</span>
        {o.distance !== undefined && <span className="obj-dist">{o.distance > 1000 ? `${(o.distance / 1000).toFixed(1)} km` : `${Math.round(o.distance)} m`}</span>}
      </div>
    </div>
  );
}

function NoticeView({ n }: { n: Notice }) {
  if (n.kind === 'landmark') {
    return (
      <div className="discovery-card">
        <div className="dc-kicker">Landmark discovered</div>
        <div className="dc-main">
          <div className="dc-icon">{n.icon}</div>
          <div>
            <div className="dc-name">{n.title}</div>
            <p className="dc-desc">{n.body}</p>
          </div>
        </div>
        {n.xp ? <div className="dc-xp">+{n.xp} XP</div> : null}
      </div>
    );
  }
  return (
    <div className={`toast toast-${n.kind}`}>
      <span className="toast-icon">{n.icon}</span>
      <span className="toast-title">{n.title}</span>
      {n.body && <span className="toast-body">{n.body}</span>}
      {n.xp ? <span className="toast-xp">+{n.xp} XP</span> : null}
    </div>
  );
}

function Notices() {
  const notices = useGame((s) => s.notices);
  const big = notices.filter((n) => n.kind === 'landmark' || n.kind === 'level').slice(-1);
  const small = notices.filter((n) => n.kind !== 'landmark' && n.kind !== 'level');
  return (
    <>
      <div className="discovery-slot">{big.map((n) => (n.kind === 'level' ? <div key={n.id} className="level-up">{n.icon} {n.title}<small>{n.body}</small></div> : <NoticeView key={n.id} n={n} />))}</div>
      <div className="toasts">{small.map((n) => <NoticeView key={n.id} n={n} />)}</div>
    </>
  );
}

function ControlsHint() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 14000);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'F1' || e.code === 'KeyK') {
        e.preventDefault();
        setShow((s) => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  if (!show)
    return (
      <div className="hint-mini">
        <Kbd>K</Kbd> controls
      </div>
    );
  return (
    <div className="controls-hint glass">
      <div><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> drive</div>
      <div><Kbd>Space</Kbd> handbrake drift</div>
      <div><Kbd>Shift</Kbd> boost</div>
      <div><Kbd>C</Kbd> camera · <Kbd>R</Kbd> reset</div>
      <div><Kbd>M</Kbd> map · <Kbd>Esc</Kbd> pause</div>
      <div className="muted">Drag mouse to look around</div>
    </div>
  );
}

export function HUD() {
  const mapOpen = useGame((s) => s.mapOpen);
  const showFps = useProfile((s) => s.settings.showFps);
  const fps = useGame((s) => s.hud.fps);
  const camera = useGame((s) => s.hud.camera);
  return (
    <div className={`hud ${camera === 'hood' ? 'hud-hood' : ''}`}>
      <TopLeft />
      <ObjectivePanel />
      <Minimap />
      <Speedometer />
      <Notices />
      <ControlsHint />
      {showFps && <div className="fps">{fps} FPS</div>}
      {mapOpen && <BigMap />}
    </div>
  );
}
