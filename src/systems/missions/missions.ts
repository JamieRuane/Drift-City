import { ACTIVE_MISSION_SLOTS, MISSIONS, type MissionDef } from '../../data/missions';
import type { Profile, MissionProgress } from '../storage/profileSchema';
import type { RunStats } from '../../game/scoring/runStats';

export const missionState = (p: Profile, id: string): MissionProgress =>
  p.missions[id] ?? { progress: 0, done: false, claimed: false };

/** The missions currently on the board: the first N that have not been claimed. */
export function activeMissions(p: Profile): MissionDef[] {
  return MISSIONS.filter((m) => !missionState(p, m.id).claimed).slice(0, ACTIVE_MISSION_SLOTS);
}

/** Applies a finished run to the active missions. Mutates the given missions map, returns newly completed missions. */
export function applyRunToMissions(p: Profile, run: RunStats): MissionDef[] {
  const completed: MissionDef[] = [];
  for (const m of activeMissions(p)) {
    const st = { ...missionState(p, m.id) };
    if (st.done) continue;
    const value = run[m.metric];
    st.progress = m.scope === 'run' ? Math.max(st.progress, value) : st.progress + value;
    if (st.progress >= m.target) {
      st.progress = m.target;
      st.done = true;
      completed.push(m);
    }
    p.missions[m.id] = st;
  }
  return completed;
}

/** Live check used by the HUD: which active run-scope missions does the current run satisfy? */
export function missionsMetByRun(p: Profile, run: RunStats): string[] {
  return activeMissions(p)
    .filter((m) => !missionState(p, m.id).done)
    .filter((m) => (m.scope === 'run' ? run[m.metric] : missionState(p, m.id).progress + run[m.metric]) >= m.target)
    .map((m) => m.id);
}
