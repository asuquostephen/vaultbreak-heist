// Security cameras: bolted to the walls, sweeping their cones back and
// forth. A camera that watches the thief feeds the alarm meter until the
// thief breaks its line of sight — or kills the feed from a control panel
// or with the EMP. Kill the lights and a camera's cone shortens like a
// guard's, because its sensor is only as good as the light it gets.

import { BLACKOUT, CAMERA } from './config.js';
import { coneSees, effectiveConeRange } from './world.js';

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

// Seconds of camera downtime a control panel buys.
export const PANEL_DISABLE_SECONDS = 12;

// Sweep phase right now: a sine that swings the facing either side of the
// mount's base direction. The real clock drives it so every camera keeps
// its own rhythm even when the frame rate wobbles — and in the dark the
// sweep drags, because the mount's motor runs on the same dying circuit.
function sweepOffset(camera, blackout) {
  const seconds = performance.now() / 1000;
  const speed = blackout ? CAMERA.sweepSpeed * BLACKOUT.sweepMul : CAMERA.sweepSpeed;
  return Math.sin(seconds * speed + camera.phase) * CAMERA.sweepArc;
}

// One frame of camera: sweep, then test the thief against the (possibly
// blackout-shortened) cone. Returns the watching strength, 0 when blind.
export function updateCamera(world, camera, player, dt, empFor, blackout = false) {
  if (camera.disabledFor > 0) {
    camera.disabledFor = Math.max(0, camera.disabledFor - dt);
  }
  const off = camera.disabledFor > 0 || empFor > 0;
  camera.facing = camera.baseFacing + sweepOffset(camera, blackout);
  if (off) {
    camera.watching = false;
    return 0;
  }
  const range = effectiveConeRange(CAMERA.range, blackout);
  const strength = coneSees(
    world,
    camera.x,
    camera.y,
    camera.facing,
    CAMERA.halfAngle,
    range,
    player.x,
    player.y,
  );
  camera.watching = strength > 0;
  return strength;
}
