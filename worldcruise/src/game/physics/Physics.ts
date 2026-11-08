import RAPIER from '@dimforge/rapier3d-compat';
import type { ColliderDesc } from '../world/LandmarkContext';

let initPromise: Promise<void> | null = null;

/** Loads the Rapier WASM module once. */
export function initPhysics() {
  if (!initPromise) initPromise = RAPIER.init();
  return initPromise;
}

export { RAPIER };

export const FIXED_DT = 1 / 60;

/** Collision groups: membership in the high 16 bits, filter in the low 16 bits. */
export const GROUP_STATIC = 0x0001;
export const GROUP_PLAYER = 0x0002;
export const GROUP_TRAFFIC = 0x0004;
export const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);

export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly events: RAPIER.EventQueue;
  private staticBody: RAPIER.RigidBody;

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    this.events = new RAPIER.EventQueue(true);
    this.staticBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    // the ground
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(2000, 1, 2000).setTranslation(0, -1, 0).setFriction(1.0)
        .setCollisionGroups(groups(GROUP_STATIC, 0xffff)),
      this.staticBody,
    );
  }

  addStatic(list: ColliderDesc[]) {
    for (const c of list) {
      let d: RAPIER.ColliderDesc;
      if (c.kind === 'box') {
        d = RAPIER.ColliderDesc.cuboid(Math.max(0.05, c.hx), Math.max(0.05, c.hy), Math.max(0.05, c.hz)).setTranslation(c.x, c.y, c.z);
        if (c.ry) {
          const h = c.ry / 2;
          d.setRotation({ x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) });
        }
      } else {
        d = RAPIER.ColliderDesc.cylinder(c.hh, c.r).setTranslation(c.x, c.y, c.z);
      }
      d.setFriction(0.4).setRestitution(0.1).setCollisionGroups(groups(GROUP_STATIC, 0xffff));
      this.world.createCollider(d, this.staticBody);
    }
  }

  step() {
    this.world.step(this.events);
  }

  /** Ray cast against static geometry only. Returns hit distance or null. */
  rayStatic(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number | null {
    const ray = new RAPIER.Ray({ x: ox, y: oy, z: oz }, { x: dx, y: dy, z: dz });
    const hit = this.world.castRay(ray, max, true, undefined, groups(0xffff, GROUP_STATIC));
    return hit ? hit.timeOfImpact : null;
  }

  dispose() {
    this.events.free();
    this.world.free();
  }
}
