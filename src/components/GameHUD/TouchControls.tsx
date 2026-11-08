import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { getEngine } from '../../stores/gameActions';
import type { ControlMode } from '../../systems/storage/profileSchema';

type Key = 'left' | 'right' | 'throttle' | 'brake' | 'drift';

/**
 * Mobile controls.
 *  - zones: hold the left / right half of the screen to steer
 *  - swipe: swipe left / right to change lane
 * Plus on-screen DRIFT, BOOST and BRAKE buttons. Multi-touch safe (tracks pointer ids).
 */
export function TouchControls({ mode }: { mode: ControlMode }) {
  const [active, setActive] = useState<Record<Key, boolean>>({ left: false, right: false, throttle: false, brake: false, drift: false });
  const pointers = useRef(new Map<number, Key>());
  const swipe = useRef(new Map<number, { x: number; y: number; t: number; fired: boolean }>());

  const set = (k: Key, v: boolean) => {
    getEngine()?.input.setVirtual(k, v);
    setActive((a) => (a[k] === v ? a : { ...a, [k]: v }));
  };

  useEffect(() => () => {
    for (const k of ['left', 'right', 'throttle', 'brake', 'drift'] as Key[]) getEngine()?.input.setVirtual(k, false);
  }, []);

  const press = (k: Key) => (e: RPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer may already be released */
    }
    pointers.current.set(e.pointerId, k);
    getEngine()?.audio.unlock();
    set(k, true);
    if (e.isTrusted) navigator.vibrate?.(8);
  };
  const release = (e: RPointerEvent) => {
    const k = pointers.current.get(e.pointerId);
    if (!k) return;
    pointers.current.delete(e.pointerId);
    if (![...pointers.current.values()].includes(k)) set(k, false);
  };
  const btn = { onPointerUp: release, onPointerCancel: release, onLostPointerCapture: release, onContextMenu: (e: { preventDefault(): void }) => e.preventDefault() };

  const swipeDown = (e: RPointerEvent) => {
    swipe.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), fired: false });
    getEngine()?.audio.unlock();
  };
  const swipeMove = (e: RPointerEvent) => {
    const s = swipe.current.get(e.pointerId);
    if (!s || s.fired) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      s.fired = true;
      getEngine()?.input.queueLaneShift(dx > 0 ? 1 : -1);
      if (e.isTrusted) navigator.vibrate?.(6);
    }
  };
  const swipeUp = (e: RPointerEvent) => swipe.current.delete(e.pointerId);

  return (
    <div className="touch">
      {mode === 'zones' ? (
        <>
          <div className={`zone l ${active.left ? 'active' : ''}`} onPointerDown={press('left')} {...btn} />
          <div className={`zone r ${active.right ? 'active' : ''}`} onPointerDown={press('right')} {...btn} />
          <div className="steer-hint l">‹</div>
          <div className="steer-hint r">›</div>
        </>
      ) : (
        <div className="zone full" onPointerDown={swipeDown} onPointerMove={swipeMove} onPointerUp={swipeUp} onPointerCancel={swipeUp} />
      )}
      <button className={`tbtn brake ${active.brake ? 'on' : ''}`} onPointerDown={press('brake')} {...btn}>BRAKE</button>
      <button className={`tbtn boost ${active.throttle ? 'on' : ''}`} onPointerDown={press('throttle')} {...btn}>BOOST</button>
      <button className={`tbtn drift ${active.drift ? 'on' : ''}`} onPointerDown={press('drift')} {...btn}>DRIFT</button>
    </div>
  );
}
