import * as THREE from 'three';
import { RAPIER, GROUP_PLAYER, GROUP_STATIC, GROUP_TRAFFIC, groups, type PhysicsWorld } from '../physics/Physics';
import { buildCarParts } from './carModels';
import type { VehicleSpec } from '../../data/vehicles';
import { clamp, damp } from '../core/rng';
import { glowTexture } from '../world/textures';

export interface DriveInput {
  throttle: number;
  brake: number;
  /** -1 = left, +1 = right */
  steer: number;
  handbrake: boolean;
  boost: boolean;
}

export const emptyInput = (): DriveInput => ({ throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false });

export interface VehicleTelemetry {
  speedKmh: number;
  /** Signed forward speed (m/s). */
  forward: number;
  gear: string;
  rpm: number;
  boost: number;
  boosting: boolean;
  drifting: boolean;
  /** 0..1 tyre slip intensity (audio, smoke, skids). */
  slip: number;
  braking: boolean;
  grounded: boolean;
  throttle: number;
}

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();

/**
 * The player's car: a Rapier ray-cast vehicle (real suspension, tyre friction and collisions) with arcade
 * assists layered on top — speed-sensitive steering, handbrake drifting with yaw assist, downforce,
 * a top-speed governor, simulated gearbox and boost.
 */
export class PlayerVehicle {
  readonly root = new THREE.Group();
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  private ctrl: RAPIER.DynamicRayCastVehicleController;
  private model = new THREE.Group();
  private wheels: THREE.Object3D[] = [];
  private wheelBase: [number, number, number][];
  private connY: number;
  private steerAngle = 0;
  private rearGrip: number;
  private paintMat: THREE.MeshStandardMaterial;
  private tailMat: THREE.MeshStandardMaterial;
  private headMat: THREE.MeshBasicMaterial;
  private revMat: THREE.MeshBasicMaterial;
  private beams: THREE.Mesh[] = [];
  private spots: THREE.SpotLight[] = [];
  private pitch = 0;
  private roll = 0;
  private lastVel = new THREE.Vector3();
  private gearIdx = 1;
  private shiftTimer = 0;
  private rpm = 900;
  private flippedTime = 0;
  /** Previous / current transforms for render interpolation. */
  private prevPos = new THREE.Vector3();
  private curPos = new THREE.Vector3();
  private prevRot = new THREE.Quaternion();
  private curRot = new THREE.Quaternion();
  headlights = false;
  boost = 1;
  readonly telemetry: VehicleTelemetry = {
    speedKmh: 0, forward: 0, gear: 'N', rpm: 900, boost: 1, boosting: false, drifting: false, slip: 0, braking: false, grounded: true, throttle: 0,
  };

  constructor(private physics: PhysicsWorld, readonly spec: VehicleSpec, paint: string, x: number, z: number, heading: number) {
    const parts = buildCarParts(spec.body);
    const ph = spec.physics;
    this.rearGrip = ph.grip;

    // ---- visuals
    this.paintMat = new THREE.MeshStandardMaterial({ color: paint, metalness: 0.45, roughness: 0.32, vertexColors: true });
    const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.5 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2533, metalness: 0.8, roughness: 0.08, vertexColors: true });
    this.headMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc, toneMapped: false });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x8a0d10, emissive: 0xff1a1a, emissiveIntensity: 0.2 });
    this.revMat = new THREE.MeshBasicMaterial({ color: 0x777777, toneMapped: false });
    const add = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = shadow;
      this.model.add(mesh);
      return mesh;
    };
    add(parts.paint, this.paintMat);
    add(parts.trim, trimMat);
    add(parts.glass, glassMat);
    add(parts.head, this.headMat, false);
    add(parts.tail, this.tailMat, false);
    add(parts.reverse, this.revMat, false);
    const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.6 });
    for (const w of parts.wheels) {
      const pivot = new THREE.Object3D();
      pivot.rotation.order = 'YXZ';
      const m = new THREE.Mesh(parts.wheel, wheelMat);
      m.castShadow = true;
      if (w[0] < 0) m.rotation.y = Math.PI;
      pivot.add(m);
      this.root.add(pivot);
      this.wheels.push(pivot);
    }
    this.wheelBase = parts.wheels;
    this.root.add(this.model);

    // blob shadow / contact AO
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(parts.width * 1.5, parts.length * 1.25).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    blob.position.y = 0.04;
    blob.renderOrder = 1;
    this.root.add(blob);

    // headlight beams + spot lights
    for (const hp of parts.headPos) {
      const spot = new THREE.SpotLight(0xfff1d0, 0, 60, 0.5, 0.55, 1.2);
      spot.position.set(hp[0], hp[1], hp[2]);
      spot.target.position.set(hp[0] * 1.5, 0, hp[2] + 18);
      this.model.add(spot, spot.target);
      this.spots.push(spot);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 14, 14, 1, true).translate(0, -7, 0).rotateX(-Math.PI / 2 - 0.08),
        new THREE.MeshBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      cone.position.set(hp[0], hp[1], hp[2]);
      this.model.add(cone);
      this.beams.push(cone);
    }

    // ---- physics
    const W = parts.width, L = parts.length;
    const h = 0.45;
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, 0.6, z)
      .setRotation(this.headingQuat(heading))
      .setLinearDamping(0.05)
      .setAngularDamping(0.6)
      .setCanSleep(false)
      .setCcdEnabled(true);
    this.body = physics.world.createRigidBody(desc);
    const cy = spec.rideHeight + h;
    const m = ph.mass;
    const ix = (m / 12) * ((2 * h) ** 2 + L ** 2) * 1.4;
    const iy = (m / 12) * (W ** 2 + L ** 2);
    const iz = (m / 12) * (W ** 2 + (2 * h) ** 2) * 1.6;
    const cdesc = RAPIER.ColliderDesc.cuboid(W * 0.47, h, L * 0.47)
      .setTranslation(0, cy, 0)
      .setMassProperties(m, { x: 0, y: spec.rideHeight + 0.15, z: 0 }, { x: ix, y: iy, z: iz }, { x: 0, y: 0, z: 0, w: 1 })
      .setFriction(0.35)
      .setRestitution(0.15)
      .setCollisionGroups(groups(GROUP_PLAYER, GROUP_STATIC | GROUP_TRAFFIC))
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(m * 6);
    this.collider = physics.world.createCollider(cdesc, this.body);

    this.ctrl = physics.world.createVehicleController(this.body);
    this.ctrl.setIndexForwardAxis = 2;
    const rest = 0.36;
    this.connY = spec.wheelRadius + rest - 9.81 / (4 * ph.suspensionStiffness);
    parts.wheels.forEach(([wx, , wz], i) => {
      this.ctrl.addWheel({ x: wx, y: this.connY, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, rest, spec.wheelRadius);
      this.ctrl.setWheelSuspensionStiffness(i, ph.suspensionStiffness);
      this.ctrl.setWheelSuspensionCompression(i, ph.suspensionDamping);
      this.ctrl.setWheelSuspensionRelaxation(i, ph.suspensionDamping * 0.9);
      this.ctrl.setWheelMaxSuspensionTravel(i, ph.suspensionTravel);
      this.ctrl.setWheelMaxSuspensionForce(i, m * 60);
      this.ctrl.setWheelFrictionSlip(i, ph.grip);
      this.ctrl.setWheelSideFrictionStiffness(i, 1.0);
    });
    this.snapshot();
    this.snapshot();
  }

  private headingQuat(heading: number) {
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading);
    return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
  }

  setPaint(c: string) {
    this.paintMat.color.set(c);
  }

  get position() {
    return this.curPos;
  }

  /** Heading (rotation about Y) of the chassis. */
  get heading() {
    _f.set(0, 0, 1).applyQuaternion(this.curRot);
    return Math.atan2(_f.x, _f.z);
  }

  get quaternion() {
    return this.curRot;
  }

  velocity(out = new THREE.Vector3()) {
    const v = this.body.linvel();
    return out.set(v.x, v.y, v.z);
  }

  reset(x: number, z: number, heading: number) {
    this.body.setTranslation({ x, y: 0.8, z }, true);
    this.body.setRotation(this.headingQuat(heading), true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.steerAngle = 0;
    this.flippedTime = 0;
    this.snapshot();
    this.snapshot();
  }

  private snapshot() {
    this.prevPos.copy(this.curPos);
    this.prevRot.copy(this.curRot);
    const t = this.body.translation(), r = this.body.rotation();
    this.curPos.set(t.x, t.y, t.z);
    this.curRot.set(r.x, r.y, r.z, r.w);
  }

  /** Fixed-step physics update. Returns true if the car flipped and needs a reset. */
  fixedUpdate(inp: DriveInput, dt: number): boolean {
    const ph = this.spec.physics;
    const c = this.ctrl;
    const rot = this.body.rotation();
    _q.set(rot.x, rot.y, rot.z, rot.w);
    _f.set(0, 0, 1).applyQuaternion(_q);
    _r.set(-1, 0, 0).applyQuaternion(_q);
    _u.set(0, 1, 0).applyQuaternion(_q);
    const lv = this.body.linvel();
    _v.set(lv.x, lv.y, lv.z);
    const fwd = _v.dot(_f);
    const lat = _v.dot(_r);
    const speed = Math.hypot(lv.x, lv.z);

    let grounded = 0;
    for (let i = 0; i < 4; i++) if (c.wheelIsInContact(i)) grounded++;

    // ---- boost
    const wantBoost = inp.boost && inp.throttle > 0.1 && this.boost > 0.02;
    if (wantBoost) this.boost = Math.max(0, this.boost - dt / 3.2);
    else this.boost = Math.min(1, this.boost + dt * (this.telemetry.drifting ? 0.16 : 0.07));
    const maxV = (wantBoost ? ph.boostSpeedKmh : ph.maxSpeedKmh) / 3.6;

    // ---- steering (speed sensitive, eased)
    const sf = 1 / (1 + Math.abs(fwd) / 17);
    const counter = inp.handbrake || Math.abs(lat) > 3 ? 1.45 : 1;
    // auto counter-steer: front wheels follow the slide so drifts are catchable
    const slipA = speed > 4 ? Math.atan2(lat, Math.max(1, Math.abs(fwd))) : 0;
    const assist = Math.abs(slipA) > 0.08 ? clamp(-slipA * 0.85, -ph.steerMax, ph.steerMax) : 0;
    const target = clamp(-inp.steer * ph.steerMax * Math.max(sf, 0.2) * counter + assist, -ph.steerMax * 1.3, ph.steerMax * 1.3);
    const rate = Math.sign(target - this.steerAngle) !== Math.sign(this.steerAngle) ? 7 : 4.2;
    this.steerAngle += clamp(target - this.steerAngle, -rate * dt, rate * dt);
    c.setWheelSteering(0, this.steerAngle);
    c.setWheelSteering(1, this.steerAngle);

    // ---- drive / brake
    let engine = 0;
    let brake = 0;
    let braking = false;
    const reversing = fwd < -0.5;
    if (inp.throttle > 0) {
      if (fwd < -1.0) {
        brake = ph.brakeForce * 0.8;
        braking = true;
      } else {
        const ratio = clamp(fwd / maxV, 0, 1.2);
        const curve = clamp(1 - Math.pow(ratio, 2.6), 0, 1) * (0.75 + 0.25 * clamp(1 - ratio * 1.4, 0, 1));
        const launch = fwd < 6 ? 1.2 : 1;
        engine = ph.engineForce * inp.throttle * curve * launch * (wantBoost ? 1.5 : 1);
        if (this.shiftTimer > 0) engine *= 0.35;
      }
    }
    if (inp.brake > 0) {
      if (fwd > 1.0) {
        brake = ph.brakeForce * inp.brake;
        braking = true;
      } else if (fwd > -ph.reverseKmh / 3.6) {
        engine = -ph.engineForce * 0.55 * inp.brake;
      }
    }
    if (inp.throttle === 0 && inp.brake === 0) brake = speed < 0.5 ? 6 : 1.4;

    const split = ph.drive === 'rwd' ? [0, 0, 0.5, 0.5] : ph.drive === 'fwd' ? [0.5, 0.5, 0, 0] : [0.2, 0.2, 0.3, 0.3];
    for (let i = 0; i < 4; i++) {
      c.setWheelEngineForce(i, engine * split[i]);
      c.setWheelBrake(i, brake * (i < 2 ? 0.6 : 0.4));
    }
    // handbrake: lock the rear and reduce rear grip for drifting
    const targetGrip = inp.handbrake ? ph.driftGrip : ph.grip * (Math.abs(lat) > 4 && inp.throttle > 0.5 ? 0.82 : 1);
    this.rearGrip = damp(this.rearGrip, targetGrip, inp.handbrake ? 14 : 2.2, dt);
    for (let i = 2; i < 4; i++) {
      c.setWheelFrictionSlip(i, this.rearGrip);
      if (inp.handbrake) c.setWheelBrake(i, ph.brakeForce * 0.28);
    }
    c.setWheelFrictionSlip(0, ph.grip * 1.05);
    c.setWheelFrictionSlip(1, ph.grip * 1.05);

    c.updateVehicle(dt, undefined, groups(0xffff, GROUP_STATIC));

    // ---- arcade assists
    const av = this.body.angvel();
    if (grounded >= 2) {
      // downforce
      const df = this.spec.physics.mass * 0.0042 * speed * speed;
      this.body.applyImpulse({ x: -_u.x * df * dt, y: -_u.y * df * dt, z: -_u.z * df * dt }, true);
      const nv = this.body.linvel();
      const nfwd = nv.x * _f.x + nv.z * _f.z;
      const nlat = nv.x * _r.x + nv.z * _r.z;
      const nspeed = Math.hypot(nv.x, nv.z);
      const slipAngle = nspeed > 4 ? Math.atan2(nlat, Math.max(1, Math.abs(nfwd))) : 0;
      const sliding = inp.handbrake || Math.abs(slipAngle) > 0.18;
      let yaw = av.y;
      if (sliding && nspeed > 5) {
        // drift: steering sets the rotation rate directly, so slides are smooth and catchable
        const targetYaw = -inp.steer * 1.35 * clamp(nspeed / 12, 0.4, 1) + (inp.handbrake ? -inp.steer * 0.3 : 0);
        yaw += (targetYaw - yaw) * (1 - Math.exp(-6 * dt));
      } else if (!inp.handbrake && Math.abs(inp.steer) < 0.1) {
        // gentle stabilisation when the driver isn't asking for rotation
        yaw *= 1 - clamp(1.6 * dt, 0, 1);
      }
      yaw = clamp(yaw, -2.2, 2.2);
      // roll/pitch damping
      const kx = 1 - clamp(3.5 * dt, 0, 1);
      this.body.setAngvel({ x: av.x * kx, y: yaw, z: av.z * kx }, true);

      let vx = nv.x, vz = nv.z;
      if (nspeed > 3) {
        // grip return: swing the velocity toward the heading (keeps speed, limits slip)
        const sign = nfwd >= 0 ? 1 : -1;
        const tx = _f.x * sign, tz = _f.z * sign;
        const excess = Math.max(0, Math.abs(slipAngle) - 0.75);
        const k = clamp((inp.handbrake ? 0.6 : sliding ? 1.6 : 4.0) * dt + excess * 2.5 * dt, 0, 1);
        const dx = vx / nspeed + (tx - vx / nspeed) * k, dz = vz / nspeed + (tz - vz / nspeed) * k;
        const dl = Math.hypot(dx, dz) || 1;
        // slight speed bleed while sliding, none when gripping
        let sp = sliding ? nspeed * (1 - (inp.throttle > 0.2 ? 0 : 0.25) * dt) : nspeed;
        // drift thrust: sliding on the throttle keeps momentum instead of scrubbing it all off
        if (sliding && inp.throttle > 0.2 && !inp.handbrake) sp = Math.min(maxV, sp + 7.5 * inp.throttle * dt * clamp(Math.abs(slipAngle) / 0.3, 0, 1));
        vx = (dx / dl) * sp;
        vz = (dz / dl) * sp;
      }
      // governor
      if (nfwd > maxV) {
        const k = clamp((nfwd - maxV) * 0.5 * dt, 0, 1);
        vx *= 1 - k;
        vz *= 1 - k;
      }
      this.body.setLinvel({ x: vx, y: nv.y, z: vz }, true);
    } else {
      // air: slowly level the car so jumps land wheels-down
      this.body.setAngvel({ x: av.x * 0.98, y: av.y, z: av.z * 0.98 }, true);
    }

    // ---- flip detection
    if (_u.y < 0.35 && speed < 4) this.flippedTime += dt;
    else this.flippedTime = 0;

    // ---- gearbox (purely simulated for sound / HUD)
    const n = ph.gears;
    const top = ph.maxSpeedKmh / 3.6;
    const shift = (k: number) => top * Math.pow(k / n, 0.85);
    const af = Math.abs(fwd);
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    if (!reversing) {
      if (this.gearIdx < n && af > shift(this.gearIdx) * 1.02) {
        this.gearIdx++;
        this.shiftTimer = 0.18;
      } else if (this.gearIdx > 1 && af < shift(this.gearIdx - 1) * 0.85) this.gearIdx--;
    } else this.gearIdx = 1;
    const lo = this.gearIdx === 1 ? 0 : shift(this.gearIdx - 1), hi = shift(this.gearIdx);
    let rpmT = 900 + clamp((af - lo) / Math.max(1, hi - lo), 0, 1.1) * 6300;
    if (this.gearIdx === 1 && af < 3) rpmT = 900 + inp.throttle * 3500 + af * 500;
    if (Math.abs(lat) > 4 && inp.throttle > 0.4) rpmT += 900;
    if (grounded === 0) rpmT = 900 + inp.throttle * 6000;
    this.rpm = damp(this.rpm, rpmT, 10, dt);

    // ---- telemetry
    const slipLat = clamp((Math.abs(lat) - 1.8) / 6, 0, 1);
    const slipBrake = braking && af > 6 && brake > ph.brakeForce * 0.7 ? 0.45 : 0;
    const slipHand = inp.handbrake && af > 4 ? 0.7 : 0;
    const t = this.telemetry;
    t.forward = fwd;
    t.speedKmh = af * 3.6;
    t.gear = reversing && inp.brake > 0 ? 'R' : af < 0.6 && inp.throttle === 0 ? 'N' : String(this.gearIdx);
    t.rpm = this.rpm;
    t.boost = this.boost;
    t.boosting = wantBoost;
    t.drifting = Math.abs(lat) > 3.2 && af > 6 && grounded >= 2;
    t.slip = grounded >= 2 ? Math.max(slipLat, slipBrake, slipHand) : 0;
    t.braking = braking || inp.handbrake;
    t.grounded = grounded >= 2;
    t.throttle = inp.throttle;

    // visual weight transfer
    const acc = _v.clone().sub(this.lastVel).multiplyScalar(1 / dt);
    this.lastVel.copy(_v);
    this.pitch = damp(this.pitch, clamp(acc.dot(_f) * 0.006, -0.05, 0.05), 6, dt);
    this.roll = damp(this.roll, clamp(acc.dot(_r) * -0.006, -0.06, 0.06), 6, dt);

    this.revMat.color.setScalar(t.gear === 'R' ? 2.2 : 0.35);
    this.tailMat.emissiveIntensity = t.braking ? 3.2 : this.headlights ? 0.9 : 0.15;
    return this.flippedTime > 2.2;
  }

  /** Called after each physics step. */
  postStep() {
    this.snapshot();
  }

  /** Interpolated visual update. alpha is the fraction between the last two physics steps. */
  render(alpha: number, night: number) {
    this.root.position.lerpVectors(this.prevPos, this.curPos, alpha);
    this.root.quaternion.slerpQuaternions(this.prevRot, this.curRot, alpha);
    this.model.rotation.set(this.pitch, 0, this.roll);
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      const base = this.wheelBase[i];
      const susp = this.ctrl.wheelSuspensionLength(i) ?? 0.3;
      w.position.set(base[0], this.connY - susp, base[2]);
      w.rotation.y = this.ctrl.wheelSteering(i) ?? 0;
      w.rotation.x = this.ctrl.wheelRotation(i) ?? 0;
    }
    this.headlights = night > 0.22;
    const hl = this.headlights ? 1 : 0;
    this.headMat.color.setScalar(this.headlights ? 2.4 : 1.0);
    for (const s of this.spots) s.intensity = hl * 55;
    for (const b of this.beams) (b.material as THREE.MeshBasicMaterial).opacity = hl * 0.025;
  }

  dispose() {
    this.root.removeFromParent();
    this.physics.world.removeVehicleController(this.ctrl);
    this.physics.world.removeRigidBody(this.body);
    this.paintMat.dispose();
  }
}
