import { TopBar } from '../common/common';
import { useProfile } from '../../stores/profileStore';
import { goTo } from '../../stores/gameActions';
import { fmtDistance, fmtInt, fmtTime } from '../../utils/format';
import { getVehicle } from '../../data/vehicles';
import { useKeys } from '../../hooks/hooks';

const MODE_LABEL = { endless: 'Endless', timetrial: 'Time Trial', daily: 'Daily' } as const;

export function Stats() {
  const p = useProfile((s) => s.profile);
  const s = p.stats;
  const mph = p.settings.units === 'mph';
  const speed = (kmh: number) => (mph ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`);
  useKeys(['Escape'], () => goTo('menu'));
  const tiles: [string, string][] = [
    ['Best score', fmtInt(s.bestScore)],
    ['Best time trial', fmtInt(s.bestTimeTrial)],
    ['Games played', fmtInt(s.gamesPlayed)],
    ['Total distance', fmtDistance(s.totalDistance)],
    ['Longest run', fmtDistance(s.bestDistance)],
    ['Total time played', fmtTime(s.totalTime)],
    ['Highest speed', speed(s.highestSpeed)],
    ['Total coins collected', fmtInt(s.totalCoins)],
    ['Total near misses', fmtInt(s.totalNearMisses)],
    ['Vehicles overtaken', fmtInt(s.totalOvertakes)],
    ['Longest drift', `${s.longestDrift.toFixed(1)} s`],
    ['Total drifts', fmtInt(s.totalDrifts)],
    ['Best combo', `${fmtInt(s.bestCombo)}x`],
    ['Longest clean drive', fmtDistance(s.bestCleanDistance)],
    ['Total crashes', fmtInt(s.totalCrashes)],
    ['Missions completed', fmtInt(s.missionsCompleted)],
    ['Daily challenges', fmtInt(s.dailiesCompleted)],
    ['Lifetime score', fmtInt(s.totalScore)],
  ];
  return (
    <div className="layer dim">
      <TopBar back="menu" title="STATISTICS" />
      <div className="screen">
        <div className="scroll screen-enter" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="stats-grid">
            {tiles.map(([k, v]) => (
              <div key={k} className="stat-tile">
                <div className="k">{k}</div>
                <div className="v">{v}</div>
              </div>
            ))}
          </div>
          <div className="panel" style={{ padding: 18 }}>
            <div className="panel-title">Personal leaderboard</div>
            {p.leaderboard.length === 0 ? (
              <div className="muted">No runs yet — your top 10 runs will appear here.</div>
            ) : (
              <table className="lb">
                <thead>
                  <tr><th>#</th><th>Score</th><th>Mode</th><th>Vehicle</th><th style={{ textAlign: 'right' }}>Distance</th><th style={{ textAlign: 'right' }}>Date</th></tr>
                </thead>
                <tbody>
                  {p.leaderboard.slice(0, 10).map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td className="r" style={{ textAlign: 'left', color: i === 0 ? 'var(--gold)' : undefined }}>{fmtInt(r.score)}</td>
                      <td>{MODE_LABEL[r.mode]}</td>
                      <td>{getVehicle(r.vehicleId).name}</td>
                      <td className="r">{fmtDistance(r.distance)}</td>
                      <td className="r">{new Date(r.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
