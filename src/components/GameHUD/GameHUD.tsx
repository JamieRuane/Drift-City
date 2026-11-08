import { useEffect, useRef, useState } from 'react';
import { useUi } from '../../stores/uiStore';
import { useProfile } from '../../stores/profileStore';
import { togglePause, sfx } from '../../stores/gameActions';
import { fmtDistance, fmtInt, todayKey } from '../../utils/format';
import { MAX_ARMOR } from '../../game/constants';
import { dailyChallengeFor } from '../../data/daily';
import { formatMetric } from '../../data/missions';
import { TouchControls } from './TouchControls';
import { useIsTouch } from '../../hooks/hooks';

const TIER_LABEL = ['', 'FAST', 'HIGH SPEED ×2.5', 'HYPERSPEED ×4'];

export function GameHUD() {
  const hud = useUi((s) => s.hud);
  const screen = useUi((s) => s.screen);
  const best = useProfile((s) => (hud?.mode === 'timetrial' ? s.profile.stats.bestTimeTrial : s.profile.stats.bestScore));
  const settings = useProfile((s) => s.profile.settings);
  const touch = useIsTouch();
  const [flashKey, setFlashKey] = useState(0);
  const lastArmor = useRef(MAX_ARMOR);

  useEffect(() => {
    if (hud && hud.armor < lastArmor.current) setFlashKey((k) => k + 1);
    lastArmor.current = hud?.armor ?? MAX_ARMOR;
  }, [hud?.armor, hud]);

  if (!hud) return <><Countdown /><Popups /></>;
  const mph = settings.units === 'mph';
  const speed = mph ? hud.speedKmh * 0.621371 : hud.speedKmh;
  const daily = hud.mode === 'daily' ? dailyChallengeFor(todayKey()) : null;
  const beat = best > 0 && hud.score > best;

  return (
    <div className="hud">
      {flashKey > 0 && <div key={flashKey} className="hit-flash" />}
      <div className="hud-top">
        <div className="hud-block">
          <div className="hud-chip"><small>DIST</small>{fmtDistance(hud.distance)}</div>
          <div className="hud-chip"><span className="coin-icon" style={{ width: 16, height: 16 }} />{fmtInt(hud.coins)}</div>
          <div className={`armor ${hud.armor === 1 ? 'crit' : ''}`} aria-label={`Armor ${hud.armor}`}>
            {Array.from({ length: MAX_ARMOR }, (_, i) => <i key={i} className={i < hud.armor ? 'on' : ''} />)}
          </div>
          {settings.showFps && <div className="fps">{hud.fps} FPS</div>}
        </div>
        <div className="hud-block" style={{ alignItems: 'flex-end' }}>
          {screen === 'playing' && (
            <button className="icon-btn pause-btn" aria-label="Pause" onClick={() => { sfx.click(); togglePause(); }}>❚❚</button>
          )}
        </div>
      </div>

      <div className="hud-score">
        <div className="v">{fmtInt(hud.score)}</div>
        <div className={`best ${beat ? 'beat' : ''}`}>{beat ? 'NEW BEST!' : `BEST ${fmtInt(best)}`}</div>
      </div>

      <div className="combo-box" style={{ opacity: hud.combo > 0 ? 1 : 0 }}>
        <div className="mult">×{hud.multiplier.toFixed(2).replace(/\.?0+$/, '')}</div>
        <div className="lbl">COMBO {hud.combo}</div>
        <div className="combo-meter"><i style={{ width: `${hud.drifting ? 100 : hud.comboTime * 100}%` }} /></div>
      </div>

      {hud.drifting && (
        <div className="drift-box">
          <div className="pts">+{fmtInt(hud.driftPoints)}</div>
          <div className="t">DRIFT {hud.driftTime.toFixed(1)}s</div>
        </div>
      )}

      <Popups />

      <div className="hud-left-bottom">
        {hud.timeLeft !== null && (
          <div className={`timer ${hud.timeLeft < 10 ? 'low' : ''}`}>{Math.ceil(hud.timeLeft)}s</div>
        )}
        {daily && (
          <div className="hud-chip objective" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span>📅 {daily.title}</span>
            <span className="muted" style={{ fontSize: 12 }}>{formatMetric(daily.metric, hud.run[daily.metric])} / {formatMetric(daily.metric, daily.target)}</span>
            <div className="progress"><i style={{ width: `${Math.min(100, (hud.run[daily.metric] / daily.target) * 100)}%` }} /></div>
          </div>
        )}
      </div>

      {hud.speedTier > 0 && <div className="speed-tier">{TIER_LABEL[hud.speedTier]}</div>}
      <Speedometer value={speed} max={(mph ? 0.621371 : 1) * Math.max(hud.topSpeedKmh * 1.1, 260)} unit={mph ? 'MPH' : 'KM/H'} />

      {touch && screen === 'playing' && hud.phase !== 'ended' && <TouchControls mode={settings.controlMode} />}
      <Countdown />
    </div>
  );
}

function Speedometer({ value, max, unit }: { value: number; max: number; unit: string }) {
  const frac = Math.max(0, Math.min(1, value / max));
  const start = 135, sweep = 270;
  const r = 70, cx = 95, cy = 85;
  const arc = (from: number, to: number) => {
    const a0 = ((from - 90) * Math.PI) / 180, a1 = ((to - 90) * Math.PI) / 180;
    const large = to - from > 180 ? 1 : 0;
    return `M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
  };
  const a0 = start + 90;
  const end = a0 + sweep * Math.max(0.002, frac);
  const hot = frac > 0.82;
  return (
    <div className="speedo">
      <svg viewBox="0 0 190 150">
        <defs>
          <linearGradient id="spd" x1="0" x2="1">
            <stop offset="0" stopColor="#2b7bff" />
            <stop offset="0.6" stopColor="#00e5ff" />
            <stop offset="1" stopColor={hot ? '#ff2bd6' : '#b54dff'} />
          </linearGradient>
        </defs>
        <path d={arc(a0, a0 + sweep)} stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d={arc(a0, end)} stroke="url(#spd)" strokeWidth="10" fill="none" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 6px rgba(0,229,255,.8))' }} />
        {Array.from({ length: 10 }, (_, i) => {
          const a = ((a0 + (sweep * i) / 9 - 90) * Math.PI) / 180;
          return <line key={i} x1={cx + (r - 16) * Math.cos(a)} y1={cy + (r - 16) * Math.sin(a)} x2={cx + (r - 10) * Math.cos(a)} y2={cy + (r - 10) * Math.sin(a)} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />;
        })}
      </svg>
      <div className="num" style={hot ? { color: '#ffd0f5' } : undefined}>{Math.round(value)}</div>
      <div className="unit">{unit}</div>
    </div>
  );
}

function Popups() {
  const popups = useUi((s) => s.popups);
  const prune = useUi((s) => s.prunePopups);
  useEffect(() => {
    const id = window.setInterval(prune, 250);
    return () => window.clearInterval(id);
  }, [prune]);
  return (
    <div className="popups">
      {popups.map((p) => (
        <div key={p.id} className={`popup ${p.color} ${p.big ? 'big' : ''}`}>
          {p.text}
          {p.points !== undefined && <span className="p">+{fmtInt(p.points)}</span>}
        </div>
      ))}
    </div>
  );
}

function Countdown() {
  const n = useUi((s) => s.countdown);
  if (n === null) return null;
  return (
    <div className="countdown">
      <span key={n} className={n === 0 ? 'go' : ''}>{n === 0 ? 'GO!' : n}</span>
    </div>
  );
}
