import * as THREE from 'three';
import { FACADE_TILE } from './GeometryBuilder';

/** All textures are painted on canvases at runtime: no external image assets are needed. */

export type FacadeStyle = 'haussmann' | 'brick' | 'modern' | 'glass' | 'georgian' | 'stone';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, { map: THREE.Texture; emissive: THREE.Texture }>();

/**
 * Facade texture: an 8×8 grid of window bays. The wall is near-white so that the vertex colour of each
 * building tints it. The emissive map holds a random set of lit windows for night time.
 */
export function facadeTextures(style: FacadeStyle) {
  const hit = cache.get(style);
  if (hit) return hit;
  const S = 512, cell = S / FACADE_TILE;
  const { c, ctx } = canvas(S, S);
  const { c: ec, ctx: ectx } = canvas(S, S);
  const r = rand(style.length * 7919 + 13);
  ctx.fillStyle = '#f4f1ec';
  ctx.fillRect(0, 0, S, S);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S, S);

  // subtle wall texture
  if (style === 'brick' || style === 'georgian') {
    for (let y = 0; y < S; y += 6) {
      const off = (y / 6) % 2 ? 6 : 0;
      for (let x = -12; x < S; x += 12) {
        ctx.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`;
        ctx.fillRect(x + off, y, 11, 5);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(0, y + 5, S, 1);
    }
  } else if (style === 'stone' || style === 'haussmann') {
    for (let y = 0; y < S; y += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, y, S, 1);
      for (let x = (y / 16) % 2 ? 0 : 20; x < S; x += 40) ctx.fillRect(x, y, 1, 16);
    }
  }

  for (let fy = 0; fy < FACADE_TILE; fy++) {
    for (let fx = 0; fx < FACADE_TILE; fx++) {
      // canvas y grows downward; floor 0 is at the bottom of the texture
      const x0 = fx * cell, y0 = S - (fy + 1) * cell;
      const lit = r() < 0.38;
      const warm = r() < 0.75;
      const litColor = warm ? `hsl(${38 + r() * 10}, 95%, ${62 + r() * 12}%)` : `hsl(${190 + r() * 30}, 60%, 80%)`;
      const glass = `hsl(${205 + r() * 15}, ${30 + r() * 15}%, ${22 + r() * 12}%)`;
      let wx = 0, wy = 0, ww = 0, wh = 0;
      switch (style) {
        case 'haussmann':
          wx = x0 + cell * 0.28; ww = cell * 0.44; wy = y0 + cell * 0.14; wh = cell * 0.66;
          break;
        case 'brick':
          wx = x0 + cell * 0.25; ww = cell * 0.5; wy = y0 + cell * 0.2; wh = cell * 0.56;
          break;
        case 'georgian':
          wx = x0 + cell * 0.27; ww = cell * 0.46; wy = y0 + cell * 0.16; wh = cell * (fy % 4 === 3 ? 0.4 : 0.62);
          break;
        case 'stone':
          wx = x0 + cell * 0.26; ww = cell * 0.48; wy = y0 + cell * 0.18; wh = cell * 0.58;
          break;
        case 'modern':
          wx = x0; ww = cell; wy = y0 + cell * 0.3; wh = cell * 0.48;
          break;
        case 'glass':
          wx = x0 + 2; ww = cell - 4; wy = y0 + 2; wh = cell - 4;
          break;
      }
      // frame
      if (style !== 'glass' && style !== 'modern') {
        ctx.fillStyle = style === 'brick' || style === 'georgian' ? '#fbfbf7' : '#e2ddd4';
        ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      }
      const grd = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      grd.addColorStop(0, glass);
      grd.addColorStop(1, `hsl(210, 35%, ${14 + r() * 8}%)`);
      ctx.fillStyle = style === 'glass' ? `hsl(${200 + r() * 12}, 40%, ${48 + r() * 14}%)` : grd;
      ctx.fillRect(wx, wy, ww, wh);
      // reflections
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh * 0.7);
      ctx.lineTo(wx + ww * 0.5, wy);
      ctx.lineTo(wx + ww * 0.75, wy);
      ctx.lineTo(wx, wy + wh);
      ctx.fill();
      // mullions
      if (style === 'haussmann' || style === 'georgian' || style === 'brick' || style === 'stone') {
        ctx.fillStyle = '#f3efe8';
        ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        ctx.fillRect(wx, wy + wh * 0.38, ww, 2);
      } else if (style === 'modern') {
        ctx.fillStyle = 'rgba(230,230,235,0.9)';
        ctx.fillRect(wx, wy, 2, wh);
      } else {
        ctx.fillStyle = 'rgba(220,235,245,0.75)';
        ctx.fillRect(x0, y0, cell, 2);
        ctx.fillRect(x0, y0, 2, cell);
      }
      // Haussmann balconies on 2nd and 5th floors + cornices
      if (style === 'haussmann') {
        if (fy % 4 === 1) {
          ctx.fillStyle = '#2d2f36';
          ctx.fillRect(x0, wy + wh * 0.62, cell, 3);
          for (let k = 0; k < cell; k += 5) ctx.fillRect(x0 + k, wy + wh * 0.62, 1.5, wh * 0.38);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(x0, wy + wh + 2, cell, 5);
        } else {
          ctx.fillStyle = '#2d2f36';
          ctx.fillRect(wx - 2, wy + wh * 0.66, ww + 4, 2);
          for (let k = 0; k < ww; k += 4) ctx.fillRect(wx + k, wy + wh * 0.66, 1, wh * 0.34);
        }
      }
      if (lit) {
        ectx.fillStyle = litColor;
        ectx.fillRect(wx, wy, ww, wh);
        if (style !== 'glass' && style !== 'modern') {
          ectx.fillStyle = 'rgba(0,0,0,0.6)';
          ectx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        }
      }
    }
  }
  // keep the lower-left texel plain wall so untextured faces (roofs) sample a neutral colour
  ctx.fillStyle = '#f4f1ec';
  ctx.fillRect(0, S - 3, 3, 3);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, S - 3, 3, 3);
  const res = { map: toTexture(c), emissive: toTexture(ec) };
  cache.set(style, res);
  return res;
}

function noiseCanvas(size: number, base: string, specks: { color: string; n: number; s: number }[], seed: number) {
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const r = rand(seed);
  for (const sp of specks) {
    ctx.fillStyle = sp.color;
    for (let i = 0; i < sp.n; i++) {
      const s = 1 + r() * sp.s;
      ctx.globalAlpha = 0.25 + r() * 0.6;
      ctx.fillRect(r() * size, r() * size, s, s);
    }
  }
  ctx.globalAlpha = 1;
  return { c, ctx };
}

let asphalt: THREE.Texture | null = null;
export function asphaltTexture() {
  if (asphalt) return asphalt;
  const { c } = noiseCanvas(256, '#ffffff', [
    { color: '#c8c8cc', n: 2600, s: 2 },
    { color: '#e9e9ee', n: 900, s: 2 },
    { color: '#b4b4ba', n: 140, s: 5 },
  ], 11);
  asphalt = toTexture(c);
  return asphalt;
}

let paving: THREE.Texture | null = null;
export function pavingTexture() {
  if (paving) return paving;
  const S = 256;
  const { c, ctx } = noiseCanvas(S, '#ffffff', [{ color: '#d8d6d2', n: 1400, s: 2 }], 21);
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= S; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke();
  }
  paving = toTexture(c);
  return paving;
}

let cobble: THREE.Texture | null = null;
export function cobbleTexture() {
  if (cobble) return cobble;
  const S = 256;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = '#bdb8b0';
  ctx.fillRect(0, 0, S, S);
  const r = rand(5);
  for (let y = 0; y < S; y += 16) {
    for (let x = (y / 16) % 2 ? -8 : 0; x < S; x += 16) {
      const l = 82 + r() * 14;
      ctx.fillStyle = `hsl(35, 8%, ${l}%)`;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, 14, 14, 4);
      ctx.fill();
    }
  }
  cobble = toTexture(c);
  return cobble;
}

let grass: THREE.Texture | null = null;
export function grassTexture() {
  if (grass) return grass;
  const { c } = noiseCanvas(256, '#ffffff', [
    { color: '#d9e8c8', n: 3000, s: 2 },
    { color: '#c3d6ae', n: 1600, s: 3 },
    { color: '#f4ffe6', n: 800, s: 2 },
  ], 31);
  grass = toTexture(c);
  return grass;
}

let glow: THREE.Texture | null = null;
/** Radial falloff used for street-light pools, headlight glows and blob shadows. */
export function glowTexture() {
  if (glow) return glow;
  const { c, ctx } = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glow = toTexture(c, true, false);
  return glow;
}

let waterNormal: THREE.Texture | null = null;
export function waterNormalTexture() {
  if (waterNormal) return waterNormal;
  const S = 256;
  const { c, ctx } = canvas(S, S);
  const img = ctx.createImageData(S, S);
  const h = (x: number, y: number) =>
    Math.sin((x / S) * Math.PI * 2 * 3 + Math.sin((y / S) * Math.PI * 2 * 2) * 1.5) * 0.5 +
    Math.sin((y / S) * Math.PI * 2 * 5 + (x / S) * Math.PI * 2 * 1) * 0.35 +
    Math.sin(((x + y) / S) * Math.PI * 2 * 7) * 0.15;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const n = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  waterNormal = toTexture(c, false);
  return waterNormal;
}

/** Animated "screen" texture for billboards (Times Square, Shibuya). Returns a draw function to animate it. */
export function billboardTexture(seed: number, kind: 'ad' | 'kanji' | 'news') {
  const W = 256, H = 128;
  const { c, ctx } = canvas(W, H);
  const tex = toTexture(c, true, false);
  const r = rand(seed);
  const hue = Math.floor(r() * 360);
  const words = kind === 'kanji'
    ? ['東京', '渋谷', 'ラーメン', '音楽', 'ゲーム', '夜', '寿司', 'カラオケ']
    : kind === 'news'
      ? ['BREAKING: CITY TRAFFIC FLOWING', 'WEATHER: SUNNY 24°', 'STOCKS ▲ 2.4%', 'WORLDCRUISE LIVE']
      : ['SODA', 'CINEMA', 'SNEAKERS', 'MUSIC', 'PHONE X', 'BURGER', 'BROADWAY', 'COFFEE'];
  let frame = 0;
  const draw = (t: number) => {
    frame++;
    const phase = Math.floor(t / 4 + seed) % words.length;
    const h2 = (hue + phase * 47) % 360;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, `hsl(${h2}, 85%, 55%)`);
    g.addColorStop(1, `hsl(${(h2 + 60) % 360}, 90%, 40%)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (kind === 'news') {
      ctx.fillStyle = '#0b1530';
      ctx.fillRect(0, H * 0.62, W, H * 0.38);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      const txt = words.join('   •   ');
      const off = (t * 60) % (ctx.measureText(txt).width + W);
      ctx.fillText(txt, W - off, H * 0.88);
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('NEWS', 16, 56);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(((i * 53 + t * 30) % (W + 60)) - 30, 30 + ((i * 37) % 70), 18 + (i % 3) * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${kind === 'kanji' ? 54 : 46}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(words[phase], W / 2, H / 2 + Math.sin(t * 2) * 4);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    tex.needsUpdate = true;
  };
  draw(0);
  return { tex, draw, frame: () => frame };
}

/** Text sign texture (shop names, neon). */
export function signTexture(text: string, bg: string, fg: string, w = 256, h = 64) {
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.floor(h * 0.6)}px Outfit, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  return toTexture(c, true, false);
}
