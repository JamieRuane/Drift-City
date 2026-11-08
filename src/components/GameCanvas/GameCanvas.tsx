import { useEffect, useRef, useState } from 'react';
import { createEngine, destroyEngine } from '../../stores/gameActions';

/** Hosts the single WebGL canvas. The engine lives for the lifetime of the app. */
export function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    createEngine(el).catch((e: unknown) => {
      console.error(e);
      if (!cancelled) setError('WebGL could not be started on this device/browser.');
    });
    return () => {
      cancelled = true;
      destroyEngine();
    };
  }, []);

  return (
    <div className="canvas-host" ref={ref}>
      {error && <div className="fatal-error">{error}</div>}
    </div>
  );
}
