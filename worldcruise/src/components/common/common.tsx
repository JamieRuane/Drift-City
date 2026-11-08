import type { ReactNode } from 'react';
import { uiSound, go } from '../../store/actions';
import { useGame } from '../../store/gameStore';

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'menu';
  disabled?: boolean;
  className?: string;
  title?: string;
  sound?: boolean;
}) {
  const { variant = 'ghost', sound = true } = props;
  return (
    <button
      className={`btn btn-${variant} ${props.className ?? ''}`}
      disabled={props.disabled}
      title={props.title}
      onMouseEnter={() => sound && !props.disabled && uiSound('hover')}
      onClick={() => {
        if (props.disabled) return;
        if (sound) uiSound('click');
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function ScreenHeader({ title, kicker, onBack }: { title: string; kicker?: string; onBack?: () => void }) {
  return (
    <header className="screen-header">
      <button
        className="back"
        onMouseEnter={() => uiSound('hover')}
        onClick={() => {
          uiSound('back');
          if (onBack) onBack();
          else go('menu');
        }}
      >
        <span aria-hidden>←</span> Back
      </button>
      <div>
        {kicker && <div className="kicker">{kicker}</div>}
        <h1>{title}</h1>
      </div>
    </header>
  );
}

export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="bar">
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

export function useBackOnEscape(onBack: () => void) {
  // handled in screens via keydown listener
  return onBack;
}

export function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function useScreen() {
  return useGame((s) => s.screen);
}
