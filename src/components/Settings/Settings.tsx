import { useState } from 'react';
import { Confirm, Seg, Toggle } from '../common/common';
import { useProfile } from '../../stores/profileStore';
import { useUi } from '../../stores/uiStore';
import { goTo, sfx } from '../../stores/gameActions';
import { useKeys } from '../../hooks/hooks';
import type { Settings as S } from '../../systems/storage/profileSchema';

export function Settings() {
  const settings = useProfile((s) => s.profile.settings);
  const name = useProfile((s) => s.profile.playerName);
  const { updateSettings, setName, resetProgress } = useProfile.getState();
  const ret = useUi((s) => s.settingsReturn);
  const pushToast = useUi((s) => s.pushToast);
  const [confirm, setConfirm] = useState<0 | 1 | 2>(0);
  const [draftName, setDraftName] = useState(name);
  const back = () => goTo(ret === 'settings' ? 'menu' : ret);
  useKeys(['Escape'], back, confirm === 0);

  const set = <K extends keyof S>(k: K) => (v: S[K]) => updateSettings({ [k]: v } as Partial<S>);
  const slider = (k: 'masterVolume' | 'musicVolume' | 'sfxVolume', label: string) => (
    <div className="set-row">
      <label htmlFor={k}>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input id={k} type="range" min={0} max={1} step={0.05} value={settings[k]} onChange={(e) => set(k)(Number(e.target.value))} />
        <span style={{ width: 44, textAlign: 'right', fontFamily: 'var(--display)', fontSize: 13 }}>{Math.round(settings[k] * 100)}</span>
      </div>
    </div>
  );

  return (
    <div className="layer dim">
      <div className="topbar">
        <div className="topbar-left">
          <button className="btn small" onClick={() => { sfx.click(); back(); }}>‹ Back</button>
          <span className="h-display" style={{ fontSize: 14, letterSpacing: '0.2em', color: 'var(--muted)' }}>SETTINGS</span>
        </div>
      </div>
      <div className="screen">
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          <div className="panel settings screen-enter">
            <div className="panel-title">Audio</div>
            <div className="set-row"><label>Mute all</label><Toggle label="Mute" on={settings.muted} onChange={set('muted')} /></div>
            {slider('masterVolume', 'Master volume')}
            {slider('musicVolume', 'Music')}
            {slider('sfxVolume', 'Sound effects')}

            <div className="panel-title" style={{ marginTop: 8 }}>Graphics</div>
            <div className="set-row">
              <label>Quality</label>
              <Seg value={settings.quality} onChange={set('quality')} options={[{ v: 'low', label: 'Low' }, { v: 'medium', label: 'Medium' }, { v: 'high', label: 'High' }]} />
            </div>
            <div className="set-row"><label>Camera shake</label><Toggle label="Camera shake" on={settings.cameraShake} onChange={set('cameraShake')} /></div>
            <div className="set-row"><label>Show FPS</label><Toggle label="Show FPS" on={settings.showFps} onChange={set('showFps')} /></div>

            <div className="panel-title" style={{ marginTop: 8 }}>Gameplay</div>
            <div className="set-row">
              <label>Touch steering</label>
              <Seg value={settings.controlMode} onChange={set('controlMode')} options={[{ v: 'zones', label: 'Hold left/right' }, { v: 'swipe', label: 'Swipe lanes' }]} />
            </div>
            <div className="set-row">
              <label>Speed units</label>
              <Seg value={settings.units} onChange={set('units')} options={[{ v: 'kmh', label: 'km/h' }, { v: 'mph', label: 'mph' }]} />
            </div>
            <div className="set-row">
              <label htmlFor="pname">Driver name</label>
              <input
                id="pname"
                className="text-input"
                maxLength={16}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => setName(draftName)}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            </div>

            <div className="panel-title" style={{ marginTop: 8 }}>Data</div>
            <div className="set-row">
              <label>Reset progress</label>
              <div><button className="btn small danger" onClick={() => { sfx.click(); setConfirm(1); }}>Reset all progress…</button></div>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>Progress is saved automatically on this device.</div>
          </div>
        </div>
      </div>
      {confirm === 1 && (
        <Confirm
          title="Reset progress?"
          body="This erases coins, vehicles, upgrades, missions, achievements and statistics. Settings are kept."
          confirmLabel="Continue"
          danger
          onCancel={() => setConfirm(0)}
          onConfirm={() => setConfirm(2)}
        />
      )}
      {confirm === 2 && (
        <Confirm
          title="Are you absolutely sure?"
          body="This cannot be undone."
          confirmLabel="Erase everything"
          danger
          onCancel={() => setConfirm(0)}
          onConfirm={() => {
            resetProgress();
            setDraftName('Racer');
            setConfirm(0);
            pushToast({ kind: 'info', title: 'Progress reset', body: 'Fresh start. Good luck out there.', icon: '♻️' });
            goTo('menu');
          }}
        />
      )}
    </div>
  );
}
