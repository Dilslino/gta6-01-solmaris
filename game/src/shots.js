// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed always gives
// the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { angleDiff, clamp } from './random.js';

const IDLE = { ax: 0, ay: 0, interact: false, punch: false, shoot: false, shootAngle: 0, weaponCycle: false, ambient: false };

function driveCtl(world) {
  const car = world.playerCar();
  if (!car) return { ...IDLE };
  // Steer toward due north up the avenue the car started on.
  const steer = clamp(angleDiff(car.angle, -Math.PI / 2) * 1.6, -1, 1);
  return { ...IDLE, ax: steer, ay: -1 };
}

function walkToward(world, tx, ty) {
  const p = world.state.player;
  const dx = tx - p.x, dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { ...IDLE, ax: dx / len, ay: dy / len };
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  world.reset();
  if (name === 'drive' || name === 'chase') {
    // Starter car is parked at (1820, 1720); step into it and drive north up the avenue.
    world.startMission(0);
    world.teleport(1820, 1650);
    world.enterNearestCar();
    if (name === 'chase') world.setWanted(3);
    const seconds = name === 'chase' ? 4 : 3.5;
    for (let i = 0; i < seconds / STEP; i += 1) world.step(STEP, driveCtl(world));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Mission 4, "The Score": walk into the Downtown bank and hold the floor while
    // the vault opens. Stop mid-robbery, guards closing in, so the frame shows the
    // hold-up itself rather than the escape.
    world.startMission(3);
    world.teleport(3920, 1040);
    for (let i = 0; i < 5 / STEP; i += 1) {
      const obj = world.state.objective;
      const ctl = obj ? walkToward(world, obj.x, obj.y) : { ...IDLE };
      world.step(STEP, ctl);
    }
    return { screen: SCREEN_PLAY };
  }
  // Default: title over a live city vista.
  for (let i = 0; i < 6 / STEP; i += 1) world.step(STEP, { ...IDLE, ambient: true });
  return { screen: SCREEN_TITLE };
}
