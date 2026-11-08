/**
 * World conventions
 *  - `s` is forward distance along the highway in metres (float64, unbounded).
 *  - `x` is lateral position in metres, +x to the right.
 *  - The player car sits at scene z = 0. World-anchored objects live in `worldGroup`, whose z is set to the
 *    player's s each frame, and are placed at local z = -s. Three's forward is -z.
 */
export const LANE_WIDTH = 3.6;
export const LANE_COUNT = 4;
export const LANES_X = [-5.4, -1.8, 1.8, 5.4];
export const ROAD_EDGE = 8.0; // inner edge of the barrier on both sides of the main carriageway
export const BARRIER_X = 8.3;

/** Oncoming carriageway on the left, separated by a median. Decorative traffic only. */
export const ONCOMING_LANES_X = [-12.2, -15.8];
export const MEDIAN_LEFT = -9.7;
export const ONCOMING_OUTER = -17.9;

export const BUILDING_RIGHT_X = 15.5;
export const BUILDING_LEFT_X = -25.5;

export const VIEW_AHEAD = 620;
export const VIEW_BEHIND = 40;

export const KMH = 3.6;

export const MAX_ARMOR = 3;
export const NEAR_MISS_GAP = 1.15;
export const ULTRA_NEAR_GAP = 0.45;

export const STREETLIGHT_SPACING = 34;
export const TUNNEL_PERIOD = 2600;
export const TUNNEL_OFFSET = 1500;
export const TUNNEL_LENGTH = 260;
export const BRIDGE_PERIOD = 720;
export const BRIDGE_OFFSET = 420;
export const GANTRY_PERIOD = 460;
export const GANTRY_OFFSET = 220;

/** Is the given s inside a tunnel (with optional margin)? */
export function inTunnel(s: number, margin = 0) {
  if (s < TUNNEL_OFFSET - margin) return false;
  const k = Math.floor((s - TUNNEL_OFFSET + margin) / TUNNEL_PERIOD);
  const start = TUNNEL_OFFSET + k * TUNNEL_PERIOD;
  return s >= start - margin && s <= start + TUNNEL_LENGTH + margin;
}

/** Start of the next tunnel at or after s. */
export function nextTunnelStart(s: number) {
  const k = Math.max(0, Math.ceil((s - TUNNEL_OFFSET) / TUNNEL_PERIOD));
  return TUNNEL_OFFSET + k * TUNNEL_PERIOD;
}
