import { useEffect, useMemo, useRef } from 'react';
import { getGame } from '../../game/core/instance';
import { useGame } from '../../store/gameStore';
import { useProfile } from '../../store/profileStore';
import type { BuiltCity } from '../../game/world/CityBuilder';

const EMPTY: never[] = [];

const SCALE = 1.4; // px per metre in the static map

/** Renders the city's roads, blocks, parks and water once into an offscreen canvas. */
function renderStaticMap(city: BuiltCity) {
  const L = city.layout;
  const W = L.wall;
  const pad = 60;
  const x0 = W.x0 - pad, z0 = W.z0 - pad;
  const w = (W.x1 - W.x0 + pad * 2) * SCALE, h = (W.z1 - W.z0 + pad * 2) * SCALE;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const g = c.getContext('2d')!;
  const X = (x: number) => (x - x0) * SCALE, Z = (z: number) => (z - z0) * SCALE;
  g.fillStyle = '#1d2433';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#2b3446';
  g.fillRect(X(W.x0), Z(W.z0), (W.x1 - W.x0) * SCALE, (W.z1 - W.z0) * SCALE);
  for (const wr of L.waterRows()) {
    g.fillStyle = '#2d6f9a';
    g.fillRect(0, Z(wr.z0), w, (wr.z1 - wr.z0) * SCALE);
  }
  for (const r of L.regions) {
    const rc = r.rect;
    g.fillStyle = r.kind === 'park' ? '#3f7a4e' : r.kind === 'plaza' ? '#6a6458' : r.kind === 'landmark' ? '#5a5070' : '#3a4558';
    g.beginPath();
    g.roundRect(X(rc.x0), Z(rc.z0), (rc.x1 - rc.x0) * SCALE, (rc.z1 - rc.z0) * SCALE, 3);
    g.fill();
  }
  g.lineCap = 'square';
  for (const e of L.edges) {
    const a = L.nodes[e.a], b = L.nodes[e.b];
    g.strokeStyle = e.bridge ? '#b8c2d6' : '#9aa6bc';
    g.lineWidth = e.width * SCALE * 0.75;
    g.beginPath();
    g.moveTo(X(a.x), Z(a.z));
    g.lineTo(X(b.x), Z(b.z));
    g.stroke();
  }
  return { canvas: c, x0, z0 };
}

function drawDynamic(
  g: CanvasRenderingContext2D, city: BuiltCity, stat: ReturnType<typeof renderStaticMap>,
  px: number, pz: number, heading: number, size: number, zoom: number, rotate: boolean,
  discovered: string[], tokens: number[], target: { x: number; z: number } | null,
) {
  const cx = size / 2, cy = size / 2;
  g.clearRect(0, 0, size, size);
  g.save();
  if (rotate) {
    g.beginPath();
    g.arc(cx, cy, size / 2, 0, Math.PI * 2);
    g.clip();
  }
  g.translate(cx, cy);
  if (rotate) g.rotate(heading - Math.PI);
  g.scale(zoom, zoom);
  const k = SCALE;
  g.translate(-(px - stat.x0) * k, -(pz - stat.z0) * k);
  g.drawImage(stat.canvas, 0, 0);
  const P = (x: number, z: number) => [(x - stat.x0) * k, (z - stat.z0) * k] as const;
  // tokens
  city.tokens.forEach((t, i) => {
    if (tokens.includes(i)) return;
    const [x, y] = P(t.x, t.z);
    g.fillStyle = '#ffc83a';
    g.beginPath();
    g.arc(x, y, 3.2 / zoom, 0, Math.PI * 2);
    g.fill();
  });
  // landmarks
  for (const l of city.landmarks) {
    const [x, y] = P(l.x, l.z);
    const got = discovered.includes(l.def.id);
    g.save();
    g.translate(x, y);
    if (rotate) g.rotate(-(heading - Math.PI));
    g.scale(1 / zoom, 1 / zoom);
    g.fillStyle = got ? 'rgba(255,255,255,0.95)' : 'rgba(20,24,36,0.85)';
    g.strokeStyle = got ? '#ffb86b' : '#8a93a8';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.font = got ? '12px sans-serif' : 'bold 12px Outfit, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = got ? '#000' : '#cfd6e6';
    g.fillText(got ? l.def.icon : '?', 0, 1);
    g.restore();
  }
  if (target) {
    const [x, y] = P(target.x, target.z);
    g.strokeStyle = '#4de3ff';
    g.lineWidth = 3 / zoom;
    g.beginPath();
    g.arc(x, y, 9 / zoom, 0, Math.PI * 2);
    g.stroke();
  }
  // player arrow
  const [ppx, ppy] = P(px, pz);
  g.translate(ppx, ppy);
  g.rotate(-heading + Math.PI);
  g.scale(1 / zoom, 1 / zoom);
  g.fillStyle = '#ff6b4a';
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -9);
  g.lineTo(6.5, 7);
  g.lineTo(0, 3.5);
  g.lineTo(-6.5, 7);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

export function useStaticMap() {
  const cityId = useGame((s) => s.city);
  return useMemo(() => {
    const city = getGame()?.cityData;
    return city ? { city, stat: renderStaticMap(city) } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, getGame()?.cityData]);
}

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useStaticMap();
  const cityId = useGame((s) => s.city);
  const discovered = useProfile((s) => s.discovered[cityId] ?? EMPTY);
  const tokens = useProfile((s) => s.tokens[cityId] ?? EMPTY);
  useEffect(() => {
    if (!data) return;
    let raf = 0;
    const size = 200;
    const cv = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    let last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return;
      last = t;
      const s = useGame.getState();
      const target = getGame()?.guideTarget ?? null;
      const pxPerMetre = 1.0 - Math.min(0.4, s.hud.speed / 380);
      drawDynamic(g, data.city, data.stat, s.hud.x, s.hud.z, s.hud.heading, size, pxPerMetre / SCALE, true, discovered, tokens, target);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [data, discovered, tokens]);
  return (
    <div className="minimap">
      <canvas ref={ref} />
      <div className="mm-n">N</div>
    </div>
  );
}

export function BigMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const data = useStaticMap();
  const cityId = useGame((s) => s.city);
  const discovered = useProfile((s) => s.discovered[cityId] ?? EMPTY);
  const tokens = useProfile((s) => s.tokens[cityId] ?? EMPTY);
  useEffect(() => {
    if (!data) return;
    let raf = 0;
    const cv = ref.current!;
    const size = Math.min(window.innerWidth, window.innerHeight) * 0.82;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr;
    cv.height = size * dpr;
    cv.style.width = cv.style.height = `${size}px`;
    const g = cv.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = data.city.layout.wall;
    const span = Math.max(L.x1 - L.x0, L.z1 - L.z0) + 120;
    const zoom = size / (span * SCALE);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const s = useGame.getState();
      const target = getGame()?.guideTarget ?? null;
      // centre the map on the city (not the player)
      const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
      g.clearRect(0, 0, size, size);
      g.save();
      g.translate(size / 2, size / 2);
      g.scale(zoom, zoom);
      g.translate(-(cx - data.stat.x0) * SCALE, -(cz - data.stat.z0) * SCALE);
      g.drawImage(data.stat.canvas, 0, 0);
      g.restore();
      // overlay markers via the shared routine (centred on city, unrotated)
      drawMarkers(g, data, size, zoom, cx, cz, s.hud.x, s.hud.z, s.hud.heading, discovered, tokens, target);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [data, discovered, tokens]);
  return (
    <div className="bigmap" onClick={() => useGame.getState().set({ mapOpen: false })}>
      <canvas ref={ref} />
      <div className="bigmap-legend glass">
        <span><i className="dot me" /> You</span>
        <span><i className="dot tok" /> Golden token</span>
        <span>❔ Undiscovered</span>
        <span className="muted">M / click to close</span>
      </div>
    </div>
  );
}

function drawMarkers(
  g: CanvasRenderingContext2D, data: NonNullable<ReturnType<typeof useStaticMap>>, size: number, zoom: number,
  cx: number, cz: number, px: number, pz: number, heading: number, discovered: string[], tokens: number[], target: { x: number; z: number } | null,
) {
  const k = SCALE * zoom;
  const P = (x: number, z: number) => [size / 2 + (x - cx) * k, size / 2 + (z - cz) * k] as const;
  data.city.tokens.forEach((t, i) => {
    if (tokens.includes(i)) return;
    const [x, y] = P(t.x, t.z);
    g.fillStyle = '#ffc83a';
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  });
  for (const l of data.city.landmarks) {
    const [x, y] = P(l.x, l.z);
    const got = discovered.includes(l.def.id);
    g.fillStyle = got ? '#fff' : 'rgba(20,24,36,0.9)';
    g.strokeStyle = got ? '#ffb86b' : '#8a93a8';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, 14, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.font = '15px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = got ? '#000' : '#cfd6e6';
    g.fillText(got ? l.def.icon : '?', x, y + 1);
    if (got) {
      g.font = '600 12px Outfit, sans-serif';
      g.fillStyle = '#fff';
      g.fillText(l.def.name, x, y + 26);
    }
  }
  if (target) {
    const [x, y] = P(target.x, target.z);
    g.strokeStyle = '#4de3ff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, 12, 0, Math.PI * 2);
    g.stroke();
  }
  const [x, y] = P(px, pz);
  g.save();
  g.translate(x, y);
  g.rotate(-heading + Math.PI);
  g.fillStyle = '#ff6b4a';
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -11);
  g.lineTo(8, 9);
  g.lineTo(0, 4);
  g.lineTo(-8, 9);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
