import { useState, type ReactNode } from 'react';
import { useProfile } from '../../stores/profileStore';
import { useUi, type Screen } from '../../stores/uiStore';
import { goTo, sfx } from '../../stores/gameActions';
import { xpToNext } from '../../systems/progression/progression';
import { fmtInt } from '../../utils/format';

export function Coin({ size }: { size?: number }) {
  return <span className="coin-icon" style={size ? { width: size, height: size } : undefined} />;
}

export function CoinBadge() {
  const coins = useProfile((s) => s.profile.coins);
  return (
    <span className="coin-badge" title="Coins">
      <Coin />
      {fmtInt(coins)}
    </span>
  );
}

export function Price({ value }: { value: number }) {
  return (
    <span className="price">
      <Coin />
      {fmtInt(value)}
    </span>
  );
}

export function LevelBlock() {
  const level = useProfile((s) => s.profile.level);
  const xp = useProfile((s) => s.profile.xp);
  const name = useProfile((s) => s.profile.playerName);
  const need = xpToNext(level);
  return (
    <div className="level-block" title={`${xp} / ${need} XP`}>
      <div className="level-num">{level}</div>
      <div>
        <div className="player-name">{name}</div>
        <div className="xp-bar"><i style={{ width: `${Math.min(100, (xp / need) * 100)}%` }} /></div>
      </div>
    </div>
  );
}

/** Top bar shared by every menu screen. */
export function TopBar({ back, title }: { back?: Screen; title?: string }) {
  const openSettings = useUi((s) => s.openSettings);
  const screen = useUi((s) => s.screen);
  return (
    <div className="topbar">
      <div className="topbar-left">
        {back ? (
          <button className="btn small back-btn" onClick={() => { sfx.click(); goTo(back); }}>
            ‹ Back
          </button>
        ) : (
          <LevelBlock />
        )}
        {title && <span className="h-display" style={{ fontSize: 14, letterSpacing: '0.2em', color: 'var(--muted)' }}>{title}</span>}
      </div>
      <div className="topbar-right">
        {back && <LevelBlock />}
        <CoinBadge />
        {screen !== 'settings' && (
          <button className="icon-btn" aria-label="Settings" onClick={() => { sfx.click(); openSettings(screen); }}>
            ⚙
          </button>
        )}
      </div>
    </div>
  );
}

export function StatBar({ label, value, rating, preview, display }: { label: string; value?: number; rating: number; preview?: number; display: string }) {
  return (
    <div className="stat-row" data-value={value}>
      <span className="label">{label}</span>
      <div className="bar">
        {preview !== undefined && preview > rating && <b style={{ width: `${preview * 100}%` }} />}
        <i style={{ width: `${rating * 100}%` }} />
      </div>
      <span className="val">{display}</span>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => { sfx.click(); onChange(!on); }} />;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.v} className={o.v === value ? 'on' : ''} onClick={() => { sfx.click(); onChange(o.v); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Confirm({ title, body, confirmLabel, danger, onConfirm, onCancel }: { title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="modal-wrap" onClick={onCancel}>
      <div className="modal panel screen-enter" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="row">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** Small helper for "flash an error message" UX on purchase buttons. */
export function useFlash() {
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 1800);
  };
  return [msg, flash] as const;
}
