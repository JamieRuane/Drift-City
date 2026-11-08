import { useUi } from '../../stores/uiStore';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="ti">{t.icon}</div>
          <div>
            <div className="tt">{t.title}</div>
            <div className="tb">{t.body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
