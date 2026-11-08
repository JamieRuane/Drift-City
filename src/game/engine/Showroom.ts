import * as THREE from 'three';
import { applyPaint, buildCar, setCarTextures, setUnderglow, type CarVisual } from '../vehicles/carFactory';
import type { VehicleDef } from '../../data/vehicles';
import type { PaintDef } from '../../data/cosmetics';
import { damp } from '../../utils/math';

/** Garage turntable scene rendered by the same renderer as the game (one WebGL context). */
export class Showroom {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  private turntable = new THREE.Group();
  private car: CarVisual | null = null;
  private carKey = '';
  private angle = 0.6;
  private targetSpin = 0.25;
  private dragVel = 0;
  private time = 0;
  private ring: THREE.Mesh;
  private ringMat: THREE.MeshBasicMaterial;
  private framingX = 0;
  private framingY = 0;
  private distance = 10.5;
  private aspect = 1;
  private disposables: { dispose(): void }[] = [];

  constructor(envMap: THREE.Texture, private glowTex: THREE.Texture) {
    this.scene.background = new THREE.Color('#06050c');
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 0.55;
    this.scene.fog = new THREE.Fog('#06050c', 18, 45);

    const floorMat = new THREE.MeshStandardMaterial({ color: '#0c0b14', roughness: 0.38, metalness: 0.5 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const podiumMat = new THREE.MeshStandardMaterial({ color: '#15141f', roughness: 0.25, metalness: 0.8 });
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.75, 0.22, 64), podiumMat);
    podium.position.y = 0.11;
    this.turntable.position.y = 0.22;
    this.scene.add(podium, this.turntable);

    this.ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.8, 2.6), toneMapped: false });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.035, 8, 96), this.ringMat);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.2;
    this.scene.add(this.ring);

    // neon light bars in the background
    const barGeo = new THREE.BoxGeometry(0.08, 6, 0.08);
    const colors = [new THREE.Color(2.4, 0.3, 2.0), new THREE.Color(0.3, 1.6, 2.6), new THREE.Color(1.6, 0.5, 2.6)];
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.7 - Math.PI / 2;
      const m = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: colors[i % 3], toneMapped: false }));
      m.position.set(Math.cos(a) * 14, 3, Math.sin(a) * 14);
      this.scene.add(m);
    }
    const strip = new THREE.Mesh(new THREE.TorusGeometry(14, 0.04, 6, 128, Math.PI * 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.4, 2.4), toneMapped: false }));
    strip.rotation.x = Math.PI / 2;
    strip.position.y = 6.2;
    this.scene.add(strip);

    this.scene.add(new THREE.HemisphereLight('#8a7cff', '#1a0f24', 0.45));
    const key = new THREE.SpotLight('#ffffff', 150, 40, 0.5, 0.7, 2);
    key.position.set(4, 9, 6);
    key.target = this.turntable;
    const rim = new THREE.SpotLight('#ff3df2', 90, 40, 0.5, 0.8, 2);
    rim.position.set(-6, 5, -6);
    rim.target = this.turntable;
    const fill = new THREE.SpotLight('#28d8ff', 70, 40, 0.5, 0.8, 2);
    fill.position.set(6, 3, -5);
    fill.target = this.turntable;
    this.scene.add(key, rim, fill);
    this.disposables.push(floorMat, podiumMat, barGeo, this.ringMat);
  }

  setCar(vehicle: VehicleDef, paint: PaintDef, glow: string | null) {
    const key = vehicle.id;
    if (this.carKey !== key || !this.car) {
      if (this.car) {
        this.turntable.remove(this.car.root);
        this.car.dispose();
      }
      this.car = buildCar(vehicle.model, paint);
      setCarTextures(this.car, this.glowTex);
      this.car.shadow.scale.multiplyScalar(1.2);
      this.turntable.add(this.car.root);
      this.carKey = key;
    } else {
      applyPaint(this.car.paint, paint);
    }
    setUnderglow(this.car, glow);
    this.ringMat.color.set(vehicle.model.accentColor).multiplyScalar(2.2);
  }

  drag(dxPixels: number) {
    this.dragVel = dxPixels * 0.012;
    this.angle += this.dragVel;
  }

  resize(aspect: number) {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    if (aspect > 1.25) {
      this.framingX = -1.6;
      this.framingY = 0.2;
      this.distance = 13.5;
      this.camera.fov = 30;
    } else {
      this.framingX = 0;
      this.framingY = -0.9;
      this.distance = aspect < 0.7 ? 17 : 14;
      this.camera.fov = 34;
    }
    this.camera.updateProjectionMatrix();
  }

  update(dt: number) {
    this.time += dt;
    this.dragVel = damp(this.dragVel, 0, 3, dt);
    this.angle += (this.targetSpin + this.dragVel * 10) * dt;
    this.turntable.rotation.y = this.angle;
    const camAngle = 0.35 + Math.sin(this.time * 0.15) * 0.08;
    this.camera.position.set(Math.sin(camAngle) * this.distance, 2.6 + Math.sin(this.time * 0.2) * 0.15, Math.cos(camAngle) * this.distance);
    this.camera.lookAt(0, 0.7, 0);
    // shift the car in screen space so UI panels don't cover it
    // note: setViewOffset sets camera.aspect = fullWidth / fullHeight, so pass the real aspect
    const fw = 1000 * this.aspect;
    this.camera.setViewOffset(fw, 1000, this.framingX * 60, this.framingY * 60, fw, 1000);
    if (this.car) for (const w of this.car.wheels) w.rotation.x = 0;
  }

  dispose() {
    if (this.car) this.car.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.disposables.forEach((d) => d.dispose());
  }
}
