import { ULTRA_NEAR_GAP } from '../constants';

export const COMBO_WINDOW = 4.5;
export const MAX_COMBO_FOR_MULT = 36;

export type PopupColor = 'cyan' | 'pink' | 'gold' | 'orange' | 'red' | 'white' | 'lime';

export interface Popup {
  id: number;
  text: string;
  points?: number;
  color: PopupColor;
  big?: boolean;
}

/**
 * Skill-based scoring. Distance gives a steady trickle; near misses, drifts and combos are where the
 * real points are. Every skill event extends the combo chain; a collision breaks it.
 */
export class ScoreSystem {
  score = 0;
  combo = 0;
  comboTimer = 0;
  driftPoints = 0;
  speedTier = 0;
  private popupId = 0;
  readonly popups: Popup[] = [];

  reset() {
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.driftPoints = 0;
    this.speedTier = 0;
    this.popups.length = 0;
  }

  get multiplier() {
    return 1 + Math.min(this.combo, MAX_COMBO_FOR_MULT) * 0.25;
  }

  private pop(text: string, color: PopupColor, points?: number, big = false) {
    this.popups.push({ id: ++this.popupId, text, color, points, big });
  }

  private bumpCombo() {
    this.combo++;
    this.comboTimer = COMBO_WINDOW;
  }

  update(dt: number, drifting: boolean) {
    if (this.combo > 0 && !drifting) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }
  }

  addDistance(meters: number, kmh: number) {
    this.speedTier = kmh >= 270 ? 3 : kmh >= 220 ? 2 : kmh >= 170 ? 1 : 0;
    this.score += meters * [1, 1.5, 2.5, 4][this.speedTier];
  }

  nearMiss(gap: number, rare: boolean) {
    this.bumpCombo();
    let pts: number;
    if (rare) {
      pts = Math.round(1500 * this.multiplier);
      this.pop('GOLDEN NEAR MISS', 'gold', pts, true);
    } else if (gap < ULTRA_NEAR_GAP) {
      pts = Math.round(450 * this.multiplier);
      this.pop('ULTRA CLOSE', 'pink', pts, true);
    } else {
      pts = Math.round(220 * this.multiplier);
      this.pop('NEAR MISS', 'cyan', pts);
    }
    this.score += pts;
    return pts;
  }

  overtake(weight: number) {
    this.score += Math.round(25 * weight * (1 + (this.multiplier - 1) * 0.5));
  }

  driftTick(dt: number, speed: number, driftStat: number) {
    this.driftPoints += dt * Math.pow(speed / 10, 1.15) * 16 * driftStat;
    this.comboTimer = Math.max(this.comboTimer, COMBO_WINDOW);
  }

  bankDrift(time: number) {
    this.bumpCombo();
    let pts = this.driftPoints * this.multiplier;
    let label = 'DRIFT';
    if (time > 8) {
      pts *= 1.5;
      label = 'LEGENDARY DRIFT';
    } else if (time > 5) {
      pts *= 1.3;
      label = 'INSANE DRIFT';
    } else if (time > 2.5) {
      pts *= 1.15;
      label = 'GREAT DRIFT';
    }
    pts = Math.round(pts);
    this.score += pts;
    this.driftPoints = 0;
    this.pop(label, 'lime', pts, time > 2.5);
    return pts;
  }

  failDrift(reason: string) {
    if (this.driftPoints > 50) this.pop(reason, 'red');
    this.driftPoints = 0;
  }

  coin(value: number) {
    this.score += 40 * value;
  }

  hit() {
    if (this.combo >= 3) this.pop(`COMBO LOST x${this.combo}`, 'red');
    this.combo = 0;
    this.comboTimer = 0;
    this.driftPoints = 0;
  }

  bonus(points: number, label: string, color: PopupColor = 'orange') {
    this.score += points;
    this.pop(label, color, points, true);
  }

  message(text: string, color: PopupColor, big = false) {
    this.pop(text, color, undefined, big);
  }
}
