import type { VehicleDef } from '../../data/vehicles';
import type { UpgradeLevels } from '../../data/upgrades';
import type { PaintDef } from '../../data/cosmetics';
import type { GameMode, RunStats } from '../scoring/runStats';
import type { Popup } from '../scoring/ScoreSystem';
import type { Quality } from '../../systems/storage/profileSchema';

export type EngineView = 'attract' | 'garage' | 'play';
export type RunPhase = 'countdown' | 'running' | 'wrecking' | 'ended';

export interface HudSnapshot {
  mode: GameMode;
  phase: RunPhase;
  score: number;
  distance: number;
  speedKmh: number;
  topSpeedKmh: number;
  coins: number;
  combo: number;
  multiplier: number;
  /** 0..1 remaining combo window */
  comboTime: number;
  drifting: boolean;
  driftTime: number;
  driftPoints: number;
  armor: number;
  timeLeft: number | null;
  speedTier: number;
  inTunnel: boolean;
  fps: number;
  run: RunStats;
}

export interface RunConfig {
  mode: GameMode;
  vehicle: VehicleDef;
  upgrades: UpgradeLevels;
  paint: PaintDef;
  underglow: string | null;
  smoke: string;
  seed: number;
}

export interface Appearance {
  vehicle: VehicleDef;
  paint: PaintDef;
  underglow: string | null;
}

export interface EngineSettings {
  quality: Quality;
  cameraShake: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

export interface EngineCallbacks {
  onHud: (h: HudSnapshot) => void;
  onPopups: (p: Popup[]) => void;
  onCountdown: (n: number | null) => void;
  onRunEnd: (stats: RunStats, reason: 'wrecked' | 'timeup') => void;
  onPauseRequest: () => void;
}
