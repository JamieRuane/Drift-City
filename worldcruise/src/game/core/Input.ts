import type { DriveInput } from '../vehicle/PlayerVehicle';
import { clamp } from './rng';

type Action = 'reset' | 'camera' | 'pause' | 'map' | 'horn';

/** Keyboard + gamepad input. Edge-triggered actions are delivered through `onAction`. */
export class Input {
  private keys = new Set<string>();
  private steerSmooth = 0;
  enabled = true;
  onAction: (a: Action) => void = () => {};
  private padPrev: boolean[] = [];

  constructor() {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.blur);
  }

  private down = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    if (!this.keys.has(k)) {
      if (k === 'KeyR') this.onAction('reset');
      if (k === 'KeyC') this.onAction('camera');
      if (k === 'Escape' || k === 'KeyP') this.onAction('pause');
      if (k === 'KeyM' || k === 'Tab') {
        e.preventDefault();
        this.onAction('map');
      }
      if (k === 'KeyH') this.onAction('horn');
    }
    this.keys.add(k);
  };

  private up = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private blur = () => this.keys.clear();

  has(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }

  read(dt: number): DriveInput {
    if (!this.enabled) return { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
    let throttle = this.has('KeyW', 'ArrowUp') ? 1 : 0;
    let brake = this.has('KeyS', 'ArrowDown') ? 1 : 0;
    let steerRaw = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    let handbrake = this.has('Space');
    let boost = this.has('ShiftLeft', 'ShiftRight');

    // gamepad
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes[0] ?? 0;
      if (Math.abs(ax) > 0.12) steerRaw = ax;
      const rt = p.buttons[7]?.value ?? 0, lt = p.buttons[6]?.value ?? 0;
      if (rt > 0.05) throttle = rt;
      if (lt > 0.05) brake = lt;
      if (p.buttons[0]?.pressed) handbrake = true;
      if (p.buttons[1]?.pressed || p.buttons[2]?.pressed) boost = true;
      const edge = (i: number, a: Action) => {
        const v = !!p.buttons[i]?.pressed;
        if (v && !this.padPrev[i]) this.onAction(a);
        this.padPrev[i] = v;
      };
      edge(3, 'reset');
      edge(5, 'camera');
      edge(9, 'pause');
      break;
    }
    // keyboard steering eases in/out so taps don't jerk the car
    const rate = steerRaw === 0 ? 7 : Math.sign(steerRaw) !== Math.sign(this.steerSmooth) ? 9 : 4.5;
    this.steerSmooth += clamp(steerRaw - this.steerSmooth, -rate * dt, rate * dt);
    return { throttle, brake, steer: this.steerSmooth, handbrake, boost };
  }

  dispose() {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.blur);
  }
}
