// Guards: patrol their waypoints, grow suspicious when the thief crosses
// their vision cone, investigate what they half-saw, and chase — and catch —
// what they fully see. A guard's suspicion is its own; the alarm module
// reads the loudest guard each frame. In Blackout Mode their cones shorten
// and suspicion builds slower, because the dark hides the thief — but a
// guard that does spot the thief in the dark is just as dangerous.

import { BLACKOUT, GUARD, PLAYER } from './config.js';
import { angleDelta, clamp, distance } from './random.js';
import { coneSees, effectiveConeRange, inShadow, moveCircle } from './world.js';

export function makeGuard(waypoints, index) {
  const start = waypoints[0];
  const next = waypoints[1] || waypoints[0];
  return {
    x: start.x,
    y: start.y,
    waypoints,
    wpIndex: 1 % waypoints.length,
    facing: Math.atan2(next.y - start.y, next.x - start.x),
    suspicion: 0,
    state: 'patrol', // patrol | investigate | chase | return
    lastSeen: null,
    memory: 0, // seconds of chase memory left after losing sight
    unseenFor: 0, // seconds since this guard last saw the thief
    waitAt: 0, // pause timer at a waypoint or investigation point
    stuckFor: 0,
    lastX: start.x,
    lastY: start.y,
    phase: index * 1.37, // per-guard offset so patrols drift apart
  };
}

// Swing the guard's facing toward an angle, capped by its turn rate.
// Returns true once it is looking straight at the target.
function turnToward(guard, targetAngle, dt) {
  const delta = angleDelta(guard.facing, targetAngle);
  const maxTurn = GUARD.turnRate * dt;
  guard.facing += clamp(delta, -maxTurn, maxTurn);
  return Math.abs(delta) < 0.05;
}

// Walk toward a point at a speed, sliding along walls. Returns true when
// the guard arrives (close enough to stop).
function walkToward(world, guard, tx, ty, speed, dt) {
  const d = distance(guard.x, guard.y, tx, ty);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  const moved = moveCircle(
    world,
    guard.x,
    guard.y,
    GUARD.radius,
    ((tx - guard.x) / d) * step,
    ((ty - guard.y) / d) * step,
  );
  guard.x = moved.x;
  guard.y = moved.y;
  return d - step < 6;
}

// How strongly this guard sees the thief right now (0 = not at all).
// blackout shortens the cone; shadow shortens it further; sneaking blunts
// whatever strength is left.
export function guardSees(world, guard, player, blackout = false) {
  let range = effectiveConeRange(GUARD.range, blackout);
  if (inShadow(world, player.x, player.y)) range *= GUARD.shadowRangeMul;
  let strength = coneSees(
    world,
    guard.x,
    guard.y,
    guard.facing,
    GUARD.halfAngle,
    range,
    player.x,
    player.y,
  );
  if (strength > 0 && player.sneaking) strength *= GUARD.sneakRateMul;
  return strength;
}

// How fast suspicion grows from a sighting this frame. The dark slows it:
// the guard is less sure of what it half-saw.
function suspicionGain(strength, blackout, dt) {
  const mul = blackout ? BLACKOUT.suspicionGainMul : 1;
  return strength * 1.35 * mul * dt;
}

// How long a guard keeps chasing after losing sight. In the dark the trail
// goes cold sooner: the guard cannot see where the thief went.
function chaseMemorySeconds(blackout) {
  return blackout ? 4.5 * BLACKOUT.chaseMemoryMul : 4.5;
}

export function updateGuard(world, guard, player, dt, events, blackout = false) {
  const strength = guardSees(world, guard, player, blackout);
  const sees = strength > 0;
  if (sees) {
    guard.unseenFor = 0;
    guard.lastSeen = { x: player.x, y: player.y };
    guard.suspicion = clamp(guard.suspicion + suspicionGain(strength, blackout, dt), 0, 1);
  } else {
    guard.unseenFor += dt;
    if (guard.unseenFor > 0.7 && guard.state !== 'chase') {
      guard.suspicion = clamp(guard.suspicion - 0.28 * dt, 0, 1);
    }
  }

  // State transitions.
  if (guard.suspicion >= 1) {
    if (guard.state !== 'chase') events.push({ type: 'alert', guard });
    guard.state = 'chase';
    guard.memory = chaseMemorySeconds(blackout);
  } else if (guard.state === 'chase') {
    if (sees) guard.memory = chaseMemorySeconds(blackout);
    else guard.memory -= dt;
    if (guard.memory <= 0) {
      guard.state = 'investigate';
      guard.suspicion = 0.55;
    }
  } else if (guard.suspicion >= 0.45 && guard.lastSeen) {
    if (guard.state === 'patrol' || guard.state === 'return') {
      events.push({ type: 'wary', guard });
    }
    guard.state = 'investigate';
  } else if (guard.state === 'investigate' && guard.suspicion <= 0.05) {
    guard.state = 'return';
  }

  // Movement by state.
  if (guard.state === 'patrol') {
    const wp = guard.waypoints[guard.wpIndex];
    turnToward(guard, Math.atan2(wp.y - guard.y, wp.x - guard.x), dt);
    if (walkToward(world, guard, wp.x, wp.y, GUARD.patrolSpeed, dt)) {
      guard.waitAt += dt;
      if (guard.waitAt > 0.9) {
        guard.waitAt = 0;
        guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      }
    }
  } else if (guard.state === 'investigate' && guard.lastSeen) {
    const target = guard.lastSeen;
    turnToward(guard, Math.atan2(target.y - guard.y, target.x - guard.x), dt);
    if (walkToward(world, guard, target.x, target.y, GUARD.investigateSpeed, dt)) {
      guard.waitAt += dt;
      guard.suspicion = clamp(guard.suspicion - 0.35 * dt, 0, 1);
      if (guard.waitAt > 1.6) {
        guard.waitAt = 0;
        guard.lastSeen = null;
        guard.state = 'return';
      }
    }
  } else if (guard.state === 'chase' && guard.lastSeen) {
    const target = guard.lastSeen;
    turnToward(guard, Math.atan2(target.y - guard.y, target.x - guard.x), dt);
    walkToward(world, guard, target.x, target.y, GUARD.chaseSpeed, dt);
  } else if (guard.state === 'return') {
    // Head back to the nearest waypoint, then resume the patrol.
    let best = 0;
    let bestDist = Infinity;
    guard.waypoints.forEach((wp, i) => {
      const d = distance(guard.x, guard.y, wp.x, wp.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    const wp = guard.waypoints[best];
    turnToward(guard, Math.atan2(wp.y - guard.y, wp.x - guard.x), dt);
    if (walkToward(world, guard, wp.x, wp.y, GUARD.investigateSpeed, dt)) {
      guard.wpIndex = (best + 1) % guard.waypoints.length;
      guard.state = 'patrol';
    }
  }

  // Stuck against a wall? Skip to the next waypoint rather than grinding.
  const movedDist = distance(guard.x, guard.y, guard.lastX, guard.lastY);
  const crawl = GUARD.patrolSpeed * dt * 0.25;
  if (movedDist < crawl && guard.state === 'patrol') guard.stuckFor += dt;
  else guard.stuckFor = 0;
  if (guard.stuckFor > 1.4) {
    guard.stuckFor = 0;
    guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
  }
  guard.lastX = guard.x;
  guard.lastY = guard.y;

  // The catch: a chasing guard that reaches the thief ends the night.
  const catchRange = GUARD.catchRadius + PLAYER.radius - 6;
  if (guard.state === 'chase' && distance(guard.x, guard.y, player.x, player.y) < catchRange) {
    events.push({ type: 'caught', guard });
  }
}
