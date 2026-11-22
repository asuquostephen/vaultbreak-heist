// The alarm meter: every eye on the thief feeds it, quiet feeds nothing,
// and a full meter trips a lockdown — the exit seals, every guard hunts,
// and the thief either breaks contact until it drains or gets caught.
// Blackout Mode helps the thief here too: once the floor goes quiet in the
// dark, the meter drains faster, because nobody can see what set it off.

import { ALARM, BLACKOUT, CAMERA } from './config.js';
import { clamp } from './random.js';

export function makeAlarm() {
  return {
    value: 0, // 0..100
    quietFor: 0, // seconds since anything last fed the meter
    lockdownFor: 0, // seconds of lockdown left; 0 = no lockdown
    tripped: false, // a lockdown has fired on this floor
  };
}

// Points per second feeding the meter this frame, from every source at once.
function feedRate(feed) {
  let rate = 0;
  if (feed.cameraStrength > 0) rate += feed.cameraStrength * CAMERA.alarmRate;
  if (feed.loudestGuardSuspicion >= 1) rate += ALARM.alertGuardRate;
  else if (feed.loudestGuardSuspicion >= 0.5) rate += ALARM.waryGuardRate;
  if (feed.cracking) rate += ALARM.crackRate;
  return rate;
}

// Points per second draining the meter while the floor is quiet. The dark
// drains it faster: the building cannot see what it is alarmed about.
function drainRate(blackout) {
  return blackout ? ALARM.decayRate * BLACKOUT.alarmDecayMul : ALARM.decayRate;
}

// feed: { cameraStrength, loudestGuardSuspicion, cracking } for this frame.
export function updateAlarm(alarm, feed, dt, events, blackout = false) {
  const fed = feedRate(feed);

  if (alarm.lockdownFor > 0) {
    alarm.lockdownFor = Math.max(0, alarm.lockdownFor - dt);
    alarm.value = Math.max(ALARM.lockdownFloor, alarm.value - ALARM.lockdownDrain * dt);
    if (alarm.lockdownFor <= 0) events.push({ type: 'lockdownOver' });
    return;
  }

  if (fed > 0) {
    alarm.quietFor = 0;
    alarm.value = clamp(alarm.value + fed * dt, 0, ALARM.max);
  } else {
    alarm.quietFor += dt;
    if (alarm.quietFor > ALARM.decayDelay) {
      alarm.value = clamp(alarm.value - drainRate(blackout) * dt, 0, ALARM.max);
    }
  }

  if (alarm.value >= ALARM.max) {
    alarm.lockdownFor = ALARM.lockdownSeconds;
    alarm.tripped = true;
    events.push({ type: 'lockdown' });
  }
}

// Instant feeds (a smashed glass case) bypass the per-second rates.
export function spikeAlarm(alarm, points) {
  alarm.value = clamp(alarm.value + points, 0, ALARM.max);
}
