import * as CANNON from 'cannon-es';

let world: CANNON.World | null = null;
const bodies: Map<string, CANNON.Body> = new Map();

const FIXED_TIMESTEP = 1 / 60;
const MAX_SUB_STEPS = 3;

export function initPhysics(): CANNON.World {
  world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
  });

  world.broadphase = new CANNON.SAPBroadphase(world);
  (world.solver as CANNON.GSSolver).iterations = 5;
  world.allowSleep = true;

  return world;
}

export function getWorld(): CANNON.World {
  if (!world) return initPhysics();
  return world;
}

export function stepPhysics(dt: number) {
  if (!world) return;
  world.step(FIXED_TIMESTEP, dt, MAX_SUB_STEPS);
}

export function addBody(id: string, body: CANNON.Body) {
  if (!world) return;
  world.addBody(body);
  bodies.set(id, body);
}

export function removeBody(id: string) {
  if (!world) return;
  const body = bodies.get(id);
  if (body) {
    world.removeBody(body);
    bodies.delete(id);
  }
}

export function getBody(id: string): CANNON.Body | undefined {
  return bodies.get(id);
}

export function createPlatformBody(
  position: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number }
): CANNON.Body {
  const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
  const body = new CANNON.Body({
    mass: 0,
    shape,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    material: new CANNON.Material({ friction: 0.5, restitution: 0.3 }),
  });
  return body;
}

export function createPlayerBody(position: { x: number; y: number; z: number }): CANNON.Body {
  const shape = new CANNON.Sphere(0.5);
  const body = new CANNON.Body({
    mass: 5,
    shape,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    material: new CANNON.Material({ friction: 0.8, restitution: 0.2 }),
    linearDamping: 0.5,
    angularDamping: 0.99,
  });
  body.allowSleep = false;
  return body;
}

export function createProjectileBody(
  position: { x: number; y: number; z: number },
  velocity: { x: number; y: number; z: number },
  mass: number
): CANNON.Body {
  const shape = new CANNON.Sphere(0.3);
  const body = new CANNON.Body({
    mass,
    shape,
    position: new CANNON.Vec3(position.x, position.y, position.z),
    velocity: new CANNON.Vec3(velocity.x, velocity.y, velocity.z),
    material: new CANNON.Material({ friction: 0.4, restitution: 0.6 }),
    linearDamping: 0.01,
  });
  return body;
}

export function resetPhysics() {
  if (world) {
    for (const [id] of bodies) {
      removeBody(id);
    }
    bodies.clear();
  }
  world = null;
}
