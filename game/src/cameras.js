// Security cameras: bolted to the walls, sweeping their cones back and
// forth. A camera that watches the thief feeds the alarm meter until the
// thief breaks its line of sight — or kills the feed from a control panel
// or with the EMP.

import { CAMERA } from './config.js';
import { coneSees } from './world.js';

export function makeCamera(spawn) {
  // The mount sits in a wall cell; nudge the eye out along its facing so it
  // perches on the wall face, inside the room — otherwise its own wall
  // would block every ray it casts.
  const nudge = 34;
  return {
    x: spawn.px + Math.cos(spawn.facing) * nudge,
    y: spawn.py + Math.sin(spawn.facing) * nudge,
    baseFacing: spawn.facing,
    phase: spawn.phase,
    facing: spawn.facing,
    watching: false, // seeing the thief this frame
    disabledFor: 0, // seconds of dead feed left (panel or EMP)
  };
}

export function updateCamera(world, camera, player, dt, empFor) {
  if (camera.disabledFor > 0) camera.disabledFor = Math.max(0, camera.disabledFor - dt);
  const off = camera.disabledFor > 0 || empFor > 0;
  const sweep = Math.sin(performance.now() / 1000 * CAMERA.sweepSpeed + camera.phase) * CAMERA.sweepArc;
  camera.facing = camera.baseFacing + sweep;
  if (off) {
    camera.watching = false;
    return 0;
  }
  const strength = coneSees(world, camera.x, camera.y, camera.facing, CAMERA.halfAngle, CAMERA.range, player.x, player.y);
  camera.watching = strength > 0;
  return strength;
}

// Seconds of camera downtime a control panel buys.
export const PANEL_DISABLE_SECONDS = 12;
