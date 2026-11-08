import { useEffect, useRef, useState } from 'react';

/** True on devices whose primary pointer is a finger. */
export function useIsTouch() {
  const [touch, setTouch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    const onTouch = () => setTouch(true);
    window.addEventListener('touchstart', onTouch, { once: true, passive: true });
    return () => window.removeEventListener('touchstart', onTouch);
  }, []);
  return touch;
}

/** Animates a number from 0 to `target` over `ms`. */
export function useCountUp(target: number, ms = 1100, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      setV(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

/** Calls handler on keydown for any of the given codes. */
export function useKeys(codes: string[], handler: (code: string) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  const key = codes.join(',');
  useEffect(() => {
    if (!enabled) return;
    const list = key.split(',');
    const fn = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (list.includes(e.code)) {
        e.preventDefault();
        ref.current(e.code);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [key, enabled]);
}
