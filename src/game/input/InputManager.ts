import { emptyInput, type DriveInput } from '../player/PlayerController';

type VirtualKey = 'left' | 'right' | 'throttle' | 'brake' | 'drift';

/**
 * Merges keyboard and touch input into a single DriveInput.
 * Touch UI components call `setVirtual` / `queueLaneShift`; the engine reads `read()` each frame.
 */
export class InputManager {
  private keys = new Set<string>();
  private virtual: Record<VirtualKey, boolean> = { left: false, right: false, throttle: false, brake: false, drift: false };
  private laneShift = 0;
  private out: DriveInput = emptyInput();
  onPauseKey: (() => void) | null = null;
  onAnyKey: (() => void) | null = null;

  private down = (e: KeyboardEvent) => {
    const k = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    if (k === 'Escape' || k === 'KeyP') {
      if (!e.repeat) this.onPauseKey?.();
      return;
    }
    this.keys.add(k);
    this.onAnyKey?.();
  };
  private up = (e: KeyboardEvent) => this.keys.delete(e.code);
  private blur = () => this.clear();

  attach() {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }

  detach() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
  }

  clear() {
    this.keys.clear();
    for (const k of Object.keys(this.virtual) as VirtualKey[]) this.virtual[k] = false;
    this.laneShift = 0;
  }

  setVirtual(key: VirtualKey, value: boolean) {
    this.virtual[key] = value;
  }

  queueLaneShift(dir: -1 | 1) {
    this.laneShift = dir;
  }

  read(): DriveInput {
    const k = this.keys;
    const left = k.has('KeyA') || k.has('ArrowLeft') || this.virtual.left;
    const right = k.has('KeyD') || k.has('ArrowRight') || this.virtual.right;
    this.out.steer = (right ? 1 : 0) - (left ? 1 : 0);
    this.out.throttle = k.has('KeyW') || k.has('ArrowUp') || this.virtual.throttle;
    this.out.brake = k.has('KeyS') || k.has('ArrowDown') || this.virtual.brake;
    this.out.drift = k.has('Space') || k.has('ShiftLeft') || this.virtual.drift;
    this.out.laneShift = this.laneShift;
    this.laneShift = 0;
    return this.out;
  }
}
