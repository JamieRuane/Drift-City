import { useEffect, useState } from 'react';
import { useProfile, type Quality, type TimeMode } from '../../store/profileStore';
import { useGame } from '../../store/gameStore';
import { uiSound } from '../../store/actions';
import { Button, Kbd, ScreenHeader } from '../common/common';

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button
          key={v}
          className={v === value ? 'on' : ''}
          onMouseEnter={() => uiSound('hover')}
          onClick={() => {
            uiSound('click');
            onChange(v);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Slider({ value, onChange, min = 0, max = 1, step = 0.05, fmt }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; fmt?: (v: number) => string }) {
  return (
    <div className="slider">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <span>{fmt ? fmt(value) : `${Math.round(value * 100)}%`}</span>
    </div>
  );
}

export function SettingsScreen() {
  const s = useProfile((p) => p.settings);
  const update = useProfile((p) => p.updateSettings);
  const reset = useProfile((p) => p.resetProgress);
  const returnTo = useGame((g) => g.returnTo);
  const [confirm, setConfirm] = useState(false);
  const back = () => useGame.getState().set({ screen: returnTo === 'settings' ? 'menu' : returnTo });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        uiSound('back');
        back();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <div className="screen settings">
      <ScreenHeader kicker="Make it yours" title="Settings" onBack={back} />
      <div className="settings-grid">
        <section className="glass set-card">
          <h3>Graphics</h3>
          <label>Quality</label>
          <Segmented<Quality> value={s.quality} options={[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]} onChange={(v) => update({ quality: v })} />
          <p className="muted small">
            {s.quality === 'low' && 'No shadows, fewer cars and pedestrians, shorter view distance. Best for older laptops.'}
            {s.quality === 'medium' && 'Soft shadows and a balanced crowd. Recommended for most laptops.'}
            {s.quality === 'high' && 'Sharper shadows, bloom on neon and lights, busier streets and the full skyline.'}
            {' '}Traffic and detail changes apply when a city next loads.
          </p>
          <label>Time of day</label>
          <Segmented<TimeMode>
            value={s.timeMode}
            options={[['dynamic', 'Cycle'], ['morning', 'Morning'], ['noon', 'Noon'], ['sunset', 'Sunset'], ['night', 'Night']]}
            onChange={(v) => update({ timeMode: v })}
          />
          {s.timeMode === 'dynamic' && (
            <>
              <label>Day length</label>
              <Slider value={s.dayMinutes} min={4} max={40} step={1} fmt={(v) => `${v} min`} onChange={(v) => update({ dayMinutes: v })} />
            </>
          )}
          <label className="check">
            <input type="checkbox" checked={s.showFps} onChange={(e) => update({ showFps: e.target.checked })} /> Show FPS counter
          </label>
        </section>
        <section className="glass set-card">
          <h3>Audio</h3>
          <label>Master volume</label>
          <Slider value={s.master} onChange={(v) => update({ master: v })} />
          <label>Music</label>
          <Slider value={s.music} onChange={(v) => update({ music: v })} />
          <label>Effects &amp; engine</label>
          <Slider value={s.sfx} onChange={(v) => update({ sfx: v })} />
          <label className="check">
            <input type="checkbox" checked={s.driveMusic} onChange={(e) => update({ driveMusic: e.target.checked })} /> Play music while driving
          </label>
        </section>
        <section className="glass set-card">
          <h3>Controls</h3>
          <label>Mouse camera sensitivity</label>
          <Slider value={s.sensitivity} min={0.3} max={2.5} step={0.1} fmt={(v) => `${v.toFixed(1)}×`} onChange={(v) => update({ sensitivity: v })} />
          <div className="controls-table">
            {[
              [['W', '↑'], 'Accelerate'],
              [['S', '↓'], 'Brake / reverse'],
              [['A', 'D'], 'Steer'],
              [['Space'], 'Handbrake / drift'],
              [['Shift'], 'Boost'],
              [['C'], 'Change camera'],
              [['R'], 'Reset car'],
              [['M'], 'City map'],
              [['H'], 'Horn'],
              [['Esc'], 'Pause'],
              [['Mouse'], 'Drag to look · scroll to zoom'],
            ].map(([keys, label]) => (
              <div key={label as string} className="ct-row">
                <span>{(keys as string[]).map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                <span>{label as string}</span>
              </div>
            ))}
          </div>
          <p className="muted small">Gamepads work too: triggers to drive, left stick to steer, A to drift, B/X to boost.</p>
        </section>
        <section className="glass set-card">
          <h3>Progress</h3>
          <p className="muted small">Discoveries, tokens, XP and best times are saved in this browser.</p>
          {!confirm ? (
            <Button variant="danger" onClick={() => setConfirm(true)}>Reset all progress</Button>
          ) : (
            <div className="row">
              <Button variant="danger" onClick={() => { reset(); setConfirm(false); }}>Yes, erase everything</Button>
              <Button onClick={() => setConfirm(false)}>Cancel</Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
