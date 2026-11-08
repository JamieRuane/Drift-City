import { useGame } from '../../store/gameStore';
import { useProfile } from '../../store/profileStore';
import { vehicleById } from '../../data/vehicles';

const START = 135; // degrees
const SWEEP = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

/** Racing-style dashboard: speed arc with ticks, RPM ring with redline, digital speed, gear and boost. */
export function Speedometer() {
  const hud = useGame((s) => s.hud);
  const vehicle = useProfile((s) => s.vehicle);
  const spec = vehicleById(vehicle);
  const max = Math.ceil(spec.physics.boostSpeedKmh / 40) * 40;
  const sp = Math.min(hud.speed, max);
  const sa = START + (sp / max) * SWEEP;
  const rpmFrac = Math.min(1, (hud.rpm - 600) / 6800);
  const ra = START + rpmFrac * SWEEP;
  const ticks = [];
  for (let v = 0; v <= max; v += 20) {
    const a = START + (v / max) * SWEEP;
    const major = v % 40 === 0;
    const [x0, y0] = polar(110, 110, major ? 84 : 88, a);
    const [x1, y1] = polar(110, 110, 94, a);
    ticks.push(<line key={v} x1={x0} y1={y0} x2={x1} y2={y1} className={major ? 'tick major' : 'tick'} />);
    if (major) {
      const [tx, ty] = polar(110, 110, 72, a);
      ticks.push(
        <text key={`t${v}`} x={tx} y={ty + 4} className="tick-label" textAnchor="middle">
          {v}
        </text>,
      );
    }
  }
  return (
    <div className={`speedo ${hud.boosting ? 'boosting' : ''} ${hud.drifting ? 'drifting' : ''}`}>
      <svg viewBox="0 0 220 220">
        <defs>
          <linearGradient id="spd" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#4de3ff" />
            <stop offset="0.6" stopColor="#7d8bff" />
            <stop offset="1" stopColor="#ff5a7a" />
          </linearGradient>
        </defs>
        <circle cx="110" cy="110" r="104" className="speedo-bg" />
        <path d={arc(110, 110, 98, START, START + SWEEP)} className="track" />
        {sp > 0.5 && <path d={arc(110, 110, 98, START, sa)} className="fill" stroke="url(#spd)" />}
        <path d={arc(110, 110, 58, START, START + SWEEP)} className="rpm-track" />
        <path d={arc(110, 110, 58, START + SWEEP * 0.82, START + SWEEP)} className="rpm-red" />
        {rpmFrac > 0.01 && <path d={arc(110, 110, 58, START, ra)} className={`rpm-fill ${rpmFrac > 0.82 ? 'hot' : ''}`} />}
        {ticks}
        <text x="110" y="118" className="speed-num" textAnchor="middle">
          {Math.round(hud.speed)}
        </text>
        <text x="110" y="136" className="speed-unit" textAnchor="middle">
          KM/H
        </text>
        <rect x="94" y="152" width="32" height="30" rx="8" className="gear-box" />
        <text x="110" y="174" className={`gear ${hud.gear === 'R' ? 'rev' : ''}`} textAnchor="middle">
          {hud.gear}
        </text>
      </svg>
      <div className="boost">
        <span className="boost-label">BOOST</span>
        <div className="boost-cells">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={i < Math.round(hud.boost * 10) ? 'on' : ''} />
          ))}
        </div>
      </div>
      {hud.drifting && <div className="drift-tag">DRIFT</div>}
    </div>
  );
}
