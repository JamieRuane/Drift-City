import * as THREE from 'three';
import { createRng } from '../../utils/math';

/** Procedurally generated canvas textures. No external image assets are used anywhere in the game. */

export const ROAD_TEX_X0 = -18.4;
export const ROAD_TEX_W = 27.2;
export const ROAD_TILE_LEN = 40;

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, opts: { srgb?: boolean; repeat?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso ?? 4;
  t.needsUpdate = true;
  return t;
}

export function createRoadTextures(anisotropy: number) {
  const W = 1024, H = 1024;
  const { c, ctx } = canvas(W, H);
  const rough = canvas(W, H);
  const rng = createRng(1337);
  const px = (x: number) => ((x - ROAD_TEX_X0) / ROAD_TEX_W) * W;
  const py = (m: number) => (m / ROAD_TILE_LEN) * H;

  // asphalt base
  ctx.fillStyle = '#1a1a21';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#202029';
  ctx.fillRect(px(-8.0), 0, px(8.0) - px(-8.0), H);
  ctx.fillRect(px(-17.6), 0, px(-10.0) - px(-17.6), H);
  // median
  ctx.fillStyle = '#26262c';
  ctx.fillRect(px(-9.9), 0, px(-8.1) - px(-9.9), H);
  // speckle noise
  for (let i = 0; i < 26000; i++) {
    const g = 20 + rng.int(0, 30);
    ctx.fillStyle = `rgba(${g},${g},${g + 6},${rng.range(0.25, 0.7)})`;
    ctx.fillRect(rng.range(0, W), rng.range(0, H), rng.range(1, 2.5), rng.range(1, 2.5));
  }
  // tyre wear streaks in lane centres
  for (const lx of [-6.2, -4.6, -2.6, -1.0, 1.0, 2.6, 4.6, 6.2, -11.4, -13.0, -15.0, -16.6]) {
    const grd = ctx.createLinearGradient(px(lx - 0.35), 0, px(lx + 0.35), 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.5, 'rgba(6,6,10,0.35)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(px(lx - 0.35), 0, px(lx + 0.35) - px(lx - 0.35), H);
  }
  // cracks / patches
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(10,10,14,${rng.range(0.15, 0.35)})`;
    ctx.fillRect(px(rng.range(-17, 7.5)), rng.range(0, H), rng.range(20, 90), rng.range(10, 60));
  }

  const line = (x: number, w: number, color: string, dash?: [number, number]) => {
    ctx.fillStyle = color;
    if (!dash) {
      ctx.fillRect(px(x - w / 2), 0, px(x + w / 2) - px(x - w / 2), H);
      return;
    }
    const [on, off] = dash;
    for (let m = 0; m < ROAD_TILE_LEN; m += on + off) ctx.fillRect(px(x - w / 2), py(m), px(x + w / 2) - px(x - w / 2), py(on));
  };
  const white = 'rgba(235,238,245,0.92)';
  line(-7.32, 0.16, white);
  line(7.32, 0.16, white);
  for (const x of [-3.6, 0, 3.6]) line(x, 0.14, white, [3, 7]);
  line(-10.25, 0.15, 'rgba(255,196,40,0.9)');
  line(-17.35, 0.15, white);
  line(-13.95, 0.14, white, [3, 7]);
  // reflective cat's eyes on lane dividers
  for (const x of [-3.6, 0, 3.6]) for (let m = 5; m < ROAD_TILE_LEN; m += 10) {
    ctx.fillStyle = 'rgba(120,220,255,0.95)';
    ctx.fillRect(px(x) - 3, py(m) - 3, 6, 6);
  }

  // roughness: mostly rough with glossy wet patches (so neon reflects on the road)
  const r = rough.ctx;
  r.fillStyle = 'rgb(170,170,170)';
  r.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), rad = rng.range(25, 120);
    const g = r.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(25,25,25,0.95)');
    g.addColorStop(1, 'rgba(25,25,25,0)');
    r.fillStyle = g;
    r.beginPath();
    r.ellipse(x, y, rad, rad * rng.range(0.4, 1.2), 0, 0, Math.PI * 2);
    r.fill();
    // wrap vertically so the tile repeats seamlessly
    for (const dy of [-H, H]) {
      const g2 = r.createRadialGradient(x, y + dy, 0, x, y + dy, rad);
      g2.addColorStop(0, 'rgba(25,25,25,0.95)');
      g2.addColorStop(1, 'rgba(25,25,25,0)');
      r.fillStyle = g2;
      r.beginPath();
      r.ellipse(x, y + dy, rad, rad, 0, 0, Math.PI * 2);
      r.fill();
    }
  }
  // painted lines are smoother
  r.fillStyle = 'rgb(110,110,110)';
  for (const x of [-7.32, 7.32, -10.25, -17.35]) r.fillRect(px(x - 0.1), 0, px(x + 0.1) - px(x - 0.1), H);

  const map = finish(c, { repeat: true, aniso: anisotropy });
  const roughnessMap = finish(rough.c, { repeat: true, srgb: false, aniso: anisotropy });
  return { map, roughnessMap };
}

export function createSidewalkTexture(anisotropy: number) {
  const { c, ctx } = canvas(256, 256);
  ctx.fillStyle = '#2a2a33';
  ctx.fillRect(0, 0, 256, 256);
  const rng = createRng(7);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 38 + rng.int(-6, 6);
    ctx.fillStyle = `rgb(${v},${v},${v + 8})`;
    ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
  return finish(c, { repeat: true, aniso: anisotropy });
}

/** Soft radial gradient used for light pools, underglow, flares and blob shadows. */
export function createGlowTexture() {
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return finish(c, { srgb: false });
}

export function createSkylineTexture() {
  const W = 2048, H = 512;
  const { c, ctx } = canvas(W, H);
  ctx.clearRect(0, 0, W, H);
  const rng = createRng(99);
  const drawLayer = (color: string, minH: number, maxH: number, windowAlpha: number) => {
    let x = 0;
    while (x < W) {
      const w = rng.range(18, 70);
      const h = rng.range(minH, maxH) * (rng.chance(0.08) ? 1.5 : 1);
      ctx.fillStyle = color;
      ctx.fillRect(x, H - h, w, h);
      if (rng.chance(0.25)) ctx.fillRect(x + w / 2 - 1, H - h - rng.range(10, 40), 2, 40); // antenna
      for (let wy = H - h + 6; wy < H - 4; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        if (rng.chance(0.18)) {
          ctx.fillStyle = rng.chance(0.7) ? `rgba(255,200,130,${windowAlpha})` : `rgba(120,220,255,${windowAlpha})`;
          ctx.fillRect(wx, wy, 2, 3);
        }
      }
      x += w + rng.range(0, 8);
    }
  };
  drawLayer('#120f24', 120, 330, 0.5);
  drawLayer('#0b0918', 60, 200, 0.75);
  const t = finish(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

const NEON = ['#ff2bd6', '#00e5ff', '#b54dff', '#ff8a1a', '#7dff3a', '#ff3355', '#3aa0ff', '#ffe23a'];

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.font = `900 ${size}px Orbitron, "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.35;
  ctx.lineWidth = size * 0.07;
  ctx.strokeStyle = color;
  ctx.strokeText(text, x, y);
  ctx.shadowBlur = size * 0.15;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

export const BILLBOARD_CELLS = { cols: 2, rows: 4 };
/** Horizontal neon billboards (2:1). Original fictional brand names. */
export function createBillboardAtlas() {
  const CW = 512, CH = 256;
  const { c, ctx } = canvas(CW * 2, CH * 4);
  const items = ['NOVA', 'KAIJU COLA', 'HYPERION', 'VOLT', 'NEON NOODLE', 'SYNTHWAVE FM', 'ZERO-G', 'ARCLIGHT'];
  items.forEach((label, i) => {
    const cx = (i % 2) * CW, cy = Math.floor(i / 2) * CH;
    const color = NEON[i % NEON.length];
    ctx.fillStyle = '#07060d';
    ctx.fillRect(cx, cy, CW, CH);
    const grd = ctx.createLinearGradient(cx, cy, cx + CW, cy + CH);
    grd.addColorStop(0, 'rgba(255,255,255,0.04)');
    grd.addColorStop(1, `${color}22`);
    ctx.fillStyle = grd;
    ctx.fillRect(cx, cy, CW, CH);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(cx + 14, cy + 14, CW - 28, CH - 28);
    ctx.shadowBlur = 0;
    const size = label.length > 9 ? 54 : label.length > 6 ? 70 : 92;
    neonText(ctx, label, cx + CW / 2, cy + CH / 2 - 8, size, color);
    ctx.font = '600 22px Rajdhani, Arial, sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(['OPEN ALL NIGHT', 'TASTE THE STORM', 'MOBILITY CORP', 'POWER THE CITY', '24H • DOWNTOWN', '101.9 • ALL NIGHT', 'ORBITAL TOURS', 'LIGHT INDUSTRIES'][i], cx + CW / 2, cy + CH - 46);
  });
  return finish(c);
}

export const BLADE_COUNT = 6;
/** Vertical blade signs (1:4). */
export function createBladeAtlas() {
  const CW = 128, CH = 512;
  const { c, ctx } = canvas(CW * BLADE_COUNT, CH);
  const words = ['HOTEL', 'CLUB', 'OPEN', 'TECH', 'ARCADE', 'BAR'];
  words.forEach((w, i) => {
    const cx = i * CW;
    const color = NEON[(i * 3 + 1) % NEON.length];
    ctx.fillStyle = '#06050b';
    ctx.fillRect(cx, 0, CW, CH);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(cx + 8, 8, CW - 16, CH - 16);
    ctx.shadowBlur = 0;
    const step = (CH - 60) / w.length;
    for (let k = 0; k < w.length; k++) neonText(ctx, w[k], cx + CW / 2, 40 + step * (k + 0.5), Math.min(78, step * 0.9), color);
  });
  return finish(c);
}

/** Overhead highway gantry signs. */
export function createGantryAtlas() {
  const CW = 512, CH = 192;
  const { c, ctx } = canvas(CW * 2, CH * 2);
  const signs: [string, string][] = [
    ['NEON DISTRICT', 'EXIT 14  ›  1 km'],
    ['SKYPORT', 'KEEP LEFT  ›  4 km'],
    ['HARBOR FRONT', 'EXIT 21  ›  2 km'],
    ['CENTRAL LOOP', 'ALL LANES  ›  6 km'],
  ];
  signs.forEach(([a, b], i) => {
    const cx = (i % 2) * CW, cy = Math.floor(i / 2) * CH;
    ctx.fillStyle = '#0b5b3a';
    ctx.fillRect(cx, cy, CW, CH);
    ctx.strokeStyle = '#e8f5ee';
    ctx.lineWidth = 6;
    ctx.strokeRect(cx + 8, cy + 8, CW - 16, CH - 16);
    ctx.fillStyle = '#f2fff8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 54px Rajdhani, Arial, sans-serif';
    ctx.fillText(a, cx + CW / 2, cy + 70);
    ctx.font = '600 34px Rajdhani, Arial, sans-serif';
    ctx.fillText(b, cx + CW / 2, cy + 132);
  });
  return finish(c);
}

/** Remaps a plane geometry's UVs to a cell of an atlas. */
export function atlasPlane(width: number, height: number, col: number, row: number, cols: number, rows: number) {
  const g = new THREE.PlaneGeometry(width, height);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (col + u) / cols, 1 - (row + 1 - v) / rows);
  }
  return g;
}
