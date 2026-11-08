import * as THREE from 'three';
import { clamp, damp, wrapAngle } from '../core/rng';
import type { PhysicsWorld } from '../physics/Physics';

export type CameraMode = 'chase' | 'far' | 'hood';
const MODES: CameraMode[] = ['chase', 'far', 'hood'];

export interface CameraTarget {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  heading: number;
  velocity: THREE.Vector3;
  forwardSpeed: number;
  boosting: boolean;
}

/**
 * Third-person chase camera with smoothed yaw that follows the direction of travel, mouse orbit
 * (auto-recentres), scroll zoom, collision avoidance against buildings, speed FOV, a reverse view and
 * impact shake. Also provides a first-person hood/cockpit view and a cinematic orbit for the menu.
 */
export class CameraRig {
  mode: CameraMode = 'chase';
  private yaw = 0;
  private orbitYaw = 0;
  private orbitPitch = 0;
  private idle = 10;
  private zoom = 1;
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private shake = 0;
  private reverseTime = 0;
  private initialized = false;
  sensitivity = 1;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(public camera: THREE.PerspectiveCamera) {}

  cycle() {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
    this.initialized = false;
    return this.mode;
  }

  orbit(dx: number, dy: number) {
    this.orbitYaw = wrapAngle(this.orbitYaw - dx * 0.005 * this.sensitivity);
    this.orbitPitch = clamp(this.orbitPitch + dy * 0.004 * this.sensitivity, -0.25, 0.9);
    this.idle = 0;
  }

  wheel(delta: number) {
    this.zoom = clamp(this.zoom + delta * 0.0012, 0.6, 1.9);
  }

  impact(strength: number) {
    this.shake = Math.min(1.2, this.shake + strength);
  }

  snap() {
    this.initialized = false;
  }

  update(t: CameraTarget, dt: number, phys: PhysicsWorld | null, exclude?: unknown) {
    void exclude;
    const cam = this.camera;
    const speed = Math.hypot(t.velocity.x, t.velocity.z);

    if (this.mode === 'hood') {
      this.tmp.set(0, 1.2, 0.35).applyQuaternion(t.quaternion).add(t.position);
      cam.position.copy(this.tmp);
      this.tmp2.set(0, 1.05, 12).applyQuaternion(t.quaternion).add(t.position);
      this.tmp2.y = damp(cam.position.y, this.tmp2.y, 30, dt);
      cam.lookAt(this.tmp2);
      cam.fov = damp(cam.fov, 72 + Math.min(14, speed * 0.25) + (t.boosting ? 6 : 0), 4, dt);
      cam.updateProjectionMatrix();
      return;
    }

    // travel direction (or reverse view)
    if (t.forwardSpeed < -2.5) this.reverseTime += dt;
    else this.reverseTime = Math.max(0, this.reverseTime - dt * 2);
    const reverse = this.reverseTime > 0.7;
    let target = t.heading;
    if (speed > 4 && t.forwardSpeed > 0) {
      const vy = Math.atan2(t.velocity.x, t.velocity.z);
      // blend toward velocity direction so drifts show the car's angle
      target = t.heading + wrapAngle(vy - t.heading) * 0.55;
    }
    if (reverse) target = t.heading + Math.PI;
    if (!this.initialized) {
      this.yaw = target;
    }
    this.yaw += wrapAngle(target - this.yaw) * (1 - Math.exp(-(reverse ? 3 : 5.5) * dt));

    this.idle += dt;
    if (this.idle > 1.6) {
      this.orbitYaw = damp(this.orbitYaw, 0, 2.5, dt);
      this.orbitPitch = damp(this.orbitPitch, 0, 2.5, dt);
    }

    const far = this.mode === 'far';
    const dist = (far ? 10.5 : 6.6) * this.zoom + Math.min(2.2, speed * 0.04);
    const height = (far ? 4.4 : 2.5) * (0.7 + this.zoom * 0.3) + this.orbitPitch * dist * 0.8;
    const yaw = this.yaw + this.orbitYaw;
    const lookAt = this.tmp2.copy(t.position);
    lookAt.y += 1.25;
    const desired = this.tmp.set(lookAt.x - Math.sin(yaw) * dist, t.position.y + height, lookAt.z - Math.cos(yaw) * dist);

    // collision: pull the camera in front of walls
    if (phys) {
      const dx = desired.x - lookAt.x, dy = desired.y - lookAt.y, dz = desired.z - lookAt.z;
      const len = Math.hypot(dx, dy, dz);
      const hit = phys.rayStatic(lookAt.x, lookAt.y, lookAt.z, dx / len, dy / len, dz / len, len);
      if (hit !== null) {
        const k = Math.max(0.15, (hit - 0.4) / len);
        desired.set(lookAt.x + dx * k, lookAt.y + dy * k, lookAt.z + dz * k);
      }
    }
    if (desired.y < 0.6) desired.y = 0.6;

    if (!this.initialized) {
      this.pos.copy(desired);
      this.look.copy(lookAt);
      this.initialized = true;
    }
    this.pos.x = damp(this.pos.x, desired.x, 12, dt);
    this.pos.z = damp(this.pos.z, desired.z, 12, dt);
    this.pos.y = damp(this.pos.y, desired.y, 6, dt);
    this.look.lerp(lookAt, 1 - Math.exp(-18 * dt));

    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      const s = this.shake * 0.35;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      this.shake = damp(this.shake, 0, 6, dt);
    }
    cam.lookAt(this.look);
    const fov = 62 + Math.min(14, speed * 0.22) + (t.boosting ? 7 : 0);
    cam.fov = damp(cam.fov, fov, 3, dt);
    cam.updateProjectionMatrix();
  }

  /** Slow cinematic orbit / tracking used behind the main menu. */
  cinematic(target: THREE.Vector3, heading: number, time: number, dt: number, phys: PhysicsWorld | null = null) {
    const cam = this.camera;
    const a = heading + Math.PI * 0.75 + Math.sin(time * 0.07) * 0.9;
    let d = 13 + Math.sin(time * 0.11) * 4;
    const h = 3.2 + Math.sin(time * 0.05) * 1.5;
    if (phys) {
      // keep the camera out of walls and kerbs
      const dx = -Math.sin(a), dz = -Math.cos(a), dy = h / d;
      const len = Math.hypot(dx, dy, dz);
      const hit = phys.rayStatic(target.x, target.y + 1.2, target.z, dx / len, dy / len, dz / len, d * len);
      if (hit !== null) d = Math.max(4, (hit / len) - 0.8);
    }
    const desired = this.tmp.set(target.x - Math.sin(a) * d, target.y + h, target.z - Math.cos(a) * d);
    if (!this.initialized) {
      this.pos.copy(desired);
      this.look.copy(target);
      this.initialized = true;
    }
    this.pos.lerp(desired, 1 - Math.exp(-1.5 * dt));
    this.look.lerp(this.tmp2.copy(target).setY(target.y + 1.2), 1 - Math.exp(-4 * dt));
    cam.position.copy(this.pos);
    cam.lookAt(this.look);
    cam.fov = damp(cam.fov, 50, 2, dt);
    cam.updateProjectionMatrix();
  }
}
