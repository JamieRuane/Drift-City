import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PAINTS, VEHICLES, levelForXp, type VehicleSpec } from '../../data/vehicles';
import { buildCarParts } from '../../game/vehicle/carModels';
import { useProfile } from '../../store/profileStore';
import { Bar, Button, ScreenHeader } from '../common/common';
import { go, uiSound } from '../../store/actions';
import { getGame } from '../../game/core/instance';

/** Turntable preview rendered with its own small renderer. */
function Preview({ spec, paint }: { spec: VehicleSpec; paint: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const paintRef = useRef<THREE.MeshStandardMaterial | null>(null);
  useEffect(() => {
    const el = ref.current!;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.shadowMap.enabled = true;
    el.appendChild(r.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    cam.position.set(7.5, 3.2, 8.5);
    cam.lookAt(0, 0.7, 0);
    scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x3a3040, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fd4ff, 1.6);
    rim.position.set(-6, 3, -6);
    scene.add(rim);
    const pm = new THREE.PMREMGenerator(r);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x8aa0c8, side: THREE.BackSide })));
    const lightPanel = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lightPanel.position.set(0, 8, 0);
    lightPanel.rotation.x = Math.PI / 2;
    envScene.add(lightPanel);
    scene.environment = pm.fromScene(envScene).texture;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x232a3d, roughness: 0.4, metalness: 0.2 }));
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.1, 4.25, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4de3ff }));
    ring.position.y = 0.01;
    scene.add(ring);
    const car = new THREE.Group();
    scene.add(car);
    const parts = buildCarParts(spec.body);
    const pmat = new THREE.MeshStandardMaterial({ color: paint, metalness: 0.5, roughness: 0.28, vertexColors: true });
    paintRef.current = pmat;
    const meshes: [THREE.BufferGeometry, THREE.Material][] = [
      [parts.paint, pmat],
      [parts.trim, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.45 })],
      [parts.glass, new THREE.MeshStandardMaterial({ color: 0x1b2533, metalness: 0.9, roughness: 0.05, vertexColors: true })],
      [parts.head, new THREE.MeshBasicMaterial({ color: 0xfff6dc })],
      [parts.tail, new THREE.MeshBasicMaterial({ color: 0xcc1818 })],
    ];
    for (const [g, m] of meshes) {
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = true;
      car.add(mesh);
    }
    for (const w of parts.wheels) {
      const m = new THREE.Mesh(parts.wheel, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.5 }));
      m.position.set(w[0], w[1], w[2]);
      m.castShadow = true;
      car.add(m);
    }
    const scale = 4.4 / parts.length;
    car.scale.setScalar(scale);
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      r.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);
    let raf = 0;
    let drag: number | null = null;
    let spin = 0.6;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (drag === null) car.rotation.y += 0.006 * spin;
      car.position.y = Math.sin(t * 1.5) * 0.02;
      r.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();
    const down = (e: PointerEvent) => (drag = e.clientX);
    const move = (e: PointerEvent) => {
      if (drag === null) return;
      car.rotation.y += (e.clientX - drag) * 0.01;
      drag = e.clientX;
    };
    const up = () => {
      drag = null;
      spin = 0.6;
    };
    r.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      pm.dispose();
      r.dispose();
      r.domElement.remove();
    };
  }, [spec.id]);
  useEffect(() => {
    paintRef.current?.color.set(paint);
  }, [paint]);
  return <div className="garage-preview" ref={ref} />;
}

export function Garage() {
  const prof = useProfile();
  const level = levelForXp(prof.xp).level;
  const [sel, setSel] = useState(prof.vehicle);
  const spec = VEHICLES.find((v) => v.id === sel)!;
  const paint = prof.paints[spec.id] ?? spec.defaultPaint;
  const locked = level < spec.unlockLevel;
  const active = prof.vehicle === spec.id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        uiSound('back');
        go('menu');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="screen garage">
      <ScreenHeader kicker={`Explorer level ${level}`} title="Garage" />
      <div className="garage-layout">
        <div className="garage-list">
          {VEHICLES.map((v) => {
            const lk = level < v.unlockLevel;
            return (
              <button
                key={v.id}
                className={`veh-item ${sel === v.id ? 'sel' : ''} ${lk ? 'locked' : ''}`}
                onMouseEnter={() => uiSound('hover')}
                onClick={() => {
                  uiSound('click');
                  setSel(v.id);
                }}
              >
                <span className="veh-swatch" style={{ background: prof.paints[v.id] ?? v.defaultPaint }} />
                <span className="veh-name">{v.name}</span>
                <span className="veh-meta">{lk ? `🔒 Level ${v.unlockLevel}` : prof.vehicle === v.id ? 'Equipped' : v.physics.drive.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
        <div className="garage-stage">
          <Preview spec={spec} paint={paint} />
          {locked && <div className="garage-lock">🔒 Reach explorer level {spec.unlockLevel} to unlock</div>}
        </div>
        <div className="garage-info glass">
          <h2>{spec.name}</h2>
          <p className="muted">{spec.tagline}</p>
          <div className="stat-rows">
            {(
              [
                ['Top speed', spec.stats.speed, `${spec.physics.maxSpeedKmh} km/h`],
                ['Acceleration', spec.stats.accel, ''],
                ['Handling', spec.stats.handling, ''],
                ['Drift', spec.stats.drift, ''],
              ] as const
            ).map(([k, v, note]) => (
              <div className="stat-row" key={k}>
                <span>{k}</span>
                <Bar value={v / 10} />
                <span className="stat-note">{note}</span>
              </div>
            ))}
          </div>
          <div className="paint-title">Paint</div>
          <div className="paints">
            {PAINTS.map((c) => (
              <button
                key={c}
                className={`paint ${paint === c ? 'sel' : ''}`}
                style={{ background: c }}
                aria-label={`Paint ${c}`}
                onClick={() => {
                  uiSound('click');
                  prof.setPaint(spec.id, c);
                }}
              />
            ))}
          </div>
          <Button
            variant="primary"
            disabled={locked || active}
            onClick={() => {
              prof.setVehicle(spec.id);
              getGame()?.startAttract();
            }}
          >
            {active ? 'Equipped' : locked ? 'Locked' : 'Equip vehicle'}
          </Button>
        </div>
      </div>
    </div>
  );
}
