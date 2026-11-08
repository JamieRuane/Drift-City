import { useState } from 'react';
import { Price, TopBar } from '../common/common';
import { useProfile } from '../../stores/profileStore';
import { useUi } from '../../stores/uiStore';
import { goTo, sfx, startGame, toastAchievement } from '../../stores/gameActions';
import { activeMissions, missionState } from '../../systems/missions/missions';
import { formatMetric, MISSIONS } from '../../data/missions';
import { ACHIEVEMENTS } from '../../data/achievements';
import { dailyChallengeFor } from '../../data/daily';
import { todayKey } from '../../utils/format';
import { unlocksAtLevel } from '../../systems/progression/progression';
import { useKeys } from '../../hooks/hooks';

export function MissionPanel() {
  const profile = useProfile((s) => s.profile);
  const claim = useProfile((s) => s.claimMission);
  const pushToast = useUi((s) => s.pushToast);
  const [tab, setTab] = useState<'missions' | 'achievements'>('missions');
  const missions = activeMissions(profile);
  const daily = dailyChallengeFor(todayKey());
  const dailyState = profile.daily.date === todayKey() ? profile.daily : { completed: false, best: 0 };
  const unlockedCount = ACHIEVEMENTS.filter((a) => profile.achievements[a.id]).length;
  const claimedCount = MISSIONS.filter((m) => missionState(profile, m.id).claimed).length;
  useKeys(['Escape'], () => goTo('menu'));

  return (
    <div className="layer dim">
      <TopBar back="menu" title="MISSIONS & ACHIEVEMENTS" />
      <div className="screen">
        <div className="tabs" style={{ marginBottom: 14 }}>
          <button className={`tab ${tab === 'missions' ? 'on' : ''}`} onClick={() => { sfx.click(); setTab('missions'); }}>Missions ({claimedCount}/{MISSIONS.length})</button>
          <button className={`tab ${tab === 'achievements' ? 'on' : ''}`} onClick={() => { sfx.click(); setTab('achievements'); }}>Achievements ({unlockedCount}/{ACHIEVEMENTS.length})</button>
        </div>
        <div className="scroll screen-enter" style={{ flex: 1, minHeight: 0 }}>
          {tab === 'missions' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="panel" style={{ padding: 18, borderColor: 'rgba(255,154,26,.45)' }}>
                <div className="panel-title">Daily challenge · {todayKey()}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{daily.title}</div>
                    <div className="muted" style={{ fontSize: 14, margin: '4px 0 8px' }}>
                      Best today: {formatMetric(daily.metric, dailyState.best)} / {formatMetric(daily.metric, daily.target)} · Reward <Price value={daily.rewardCoins} /> + {daily.rewardXp} XP
                    </div>
                    <div className="progress"><i style={{ width: `${Math.min(100, (dailyState.best / daily.target) * 100)}%` }} /></div>
                  </div>
                  {dailyState.completed ? <span className="chip ok">Completed ✓</span> : <button className="btn gold primary" onClick={() => { sfx.click(); startGame('daily'); }}>Play daily</button>}
                </div>
              </div>
              <div className="panel" style={{ padding: 18 }}>
                <div className="panel-title">Active missions</div>
                {missions.length === 0 && <div className="muted">Every mission is complete. Legendary.</div>}
                <div className="missions">
                  {missions.map((m) => {
                    const st = missionState(profile, m.id);
                    return (
                      <div key={m.id} className={`mission ${st.done ? 'done' : ''}`}>
                        <div className="top">
                          <div className="title">{m.title}</div>
                          <span className="chip">{m.scope === 'run' ? 'One run' : 'Total'}</span>
                        </div>
                        <div className="progress"><i style={{ width: `${Math.min(100, (st.progress / m.target) * 100)}%` }} /></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span className="muted" style={{ fontSize: 14 }}>{formatMetric(m.metric, st.progress)} / {formatMetric(m.metric, m.target)}</span>
                          {st.done ? (
                            <button className="btn small primary" onClick={() => {
                              const r = claim(m.id);
                              if (!r) return;
                              r.achievements.forEach(toastAchievement);
                              sfx.purchase();
                              pushToast({ kind: 'mission', title: 'Reward claimed', body: `+${r.coins} coins · +${r.xp} XP`, icon: '🎁' });
                              for (const lv of r.levels) {
                                const u = unlocksAtLevel(lv);
                                pushToast({ kind: 'level', title: `Level ${lv}!`, body: u.length ? `Unlocked: ${u.join(', ')}` : 'Bonus coins awarded', icon: '⭐' });
                              }
                            }}>Claim <Price value={m.rewardCoins} /></button>
                          ) : (
                            <span style={{ fontSize: 14 }}><Price value={m.rewardCoins} /> <span className="muted">+{m.rewardXp} XP</span></span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>Claim a reward to reveal the next mission. Completing a mission mid-run also awards +2,500 points.</div>
              </div>
            </div>
          ) : (
            <div className="ach-grid">
              {ACHIEVEMENTS.map((a) => (
                <div key={a.id} className={`ach ${profile.achievements[a.id] ? 'on' : ''}`}>
                  <div className="i">{a.icon}</div>
                  <div className="n">{a.name}</div>
                  <div className="d">{a.description}</div>
                  <div style={{ marginTop: 6 }}>{profile.achievements[a.id] ? <span className="chip ok">Unlocked</span> : <Price value={a.rewardCoins} />}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
