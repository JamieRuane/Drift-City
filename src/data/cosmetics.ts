export type PaintFinish = 'gloss' | 'metallic' | 'matte' | 'chrome' | 'pearl';

export interface PaintDef {
  id: string;
  name: string;
  color: string;
  finish: PaintFinish;
  price: number;
  levelRequired: number;
}

export const PAINTS: PaintDef[] = [
  { id: 'cyan', name: 'Electric Cyan', color: '#14c8ff', finish: 'gloss', price: 0, levelRequired: 1 },
  { id: 'violet', name: 'Neon Violet', color: '#8b2cff', finish: 'metallic', price: 0, levelRequired: 1 },
  { id: 'sunset', name: 'Sunset Orange', color: '#ff6a13', finish: 'gloss', price: 0, levelRequired: 1 },
  { id: 'crimson', name: 'Crimson Rush', color: '#e3002d', finish: 'metallic', price: 0, levelRequired: 1 },
  { id: 'lime', name: 'Toxic Lime', color: '#8cff1a', finish: 'gloss', price: 0, levelRequired: 1 },
  { id: 'pearl', name: 'Ghost Pearl', color: '#e9f0ff', finish: 'pearl', price: 0, levelRequired: 1 },
  { id: 'midnight', name: 'Midnight Blue', color: '#1a3ab8', finish: 'metallic', price: 300, levelRequired: 1 },
  { id: 'hotpink', name: 'Hot Pink', color: '#ff2fa8', finish: 'gloss', price: 300, levelRequired: 2 },
  { id: 'arctic', name: 'Arctic White', color: '#f4f6fa', finish: 'gloss', price: 400, levelRequired: 2 },
  { id: 'gold', name: 'Liquid Gold', color: '#ffb81f', finish: 'metallic', price: 600, levelRequired: 3 },
  { id: 'stealth', name: 'Stealth Matte', color: '#24262e', finish: 'matte', price: 800, levelRequired: 4 },
  { id: 'teal', name: 'Acid Teal', color: '#00d6a0', finish: 'pearl', price: 900, levelRequired: 5 },
  { id: 'chrome', name: 'Mirror Chrome', color: '#cfd6e3', finish: 'chrome', price: 2500, levelRequired: 8 },
  { id: 'blackchrome', name: 'Black Chrome', color: '#3a3f4c', finish: 'chrome', price: 4000, levelRequired: 12 },
];

export interface GlowDef {
  id: string;
  name: string;
  /** CSS colour, 'rainbow', or null for none */
  color: string | null;
  price: number;
  levelRequired: number;
}

export const UNDERGLOWS: GlowDef[] = [
  { id: 'none', name: 'None', color: null, price: 0, levelRequired: 1 },
  { id: 'cyan', name: 'Cyan Glow', color: '#00e5ff', price: 500, levelRequired: 2 },
  { id: 'magenta', name: 'Magenta Glow', color: '#ff2bd6', price: 500, levelRequired: 3 },
  { id: 'lime', name: 'Lime Glow', color: '#8dff2b', price: 700, levelRequired: 5 },
  { id: 'amber', name: 'Amber Glow', color: '#ffa31a', price: 700, levelRequired: 6 },
  { id: 'white', name: 'Xenon White', color: '#e6f3ff', price: 1200, levelRequired: 9 },
];

export const SMOKES: GlowDef[] = [
  { id: 'white', name: 'Classic White', color: '#d8dce6', price: 0, levelRequired: 1 },
  { id: 'cyan', name: 'Cyan Smoke', color: '#40e8ff', price: 800, levelRequired: 3 },
  { id: 'pink', name: 'Pink Smoke', color: '#ff58c8', price: 800, levelRequired: 4 },
  { id: 'purple', name: 'Ultraviolet', color: '#9a52ff', price: 1100, levelRequired: 6 },
  { id: 'orange', name: 'Inferno', color: '#ff7a2a', price: 1100, levelRequired: 8 },
  { id: 'rainbow', name: 'Spectrum', color: 'rainbow', price: 3000, levelRequired: 12 },
];

export const getPaint = (id: string) => PAINTS.find((p) => p.id === id) ?? PAINTS[0];
export const getGlow = (id: string) => UNDERGLOWS.find((p) => p.id === id) ?? UNDERGLOWS[0];
export const getSmoke = (id: string) => SMOKES.find((p) => p.id === id) ?? SMOKES[0];
