// First-time hints: the thief is new to the job, so the game teaches as
// the night goes on — one short toast the first time each situation comes
// up, then never again for the rest of the run. Nothing here changes the
// rules; it only says them out loud at the moment they matter.

import { distance } from './random.js';
import { inShadow } from './world.js';

export function makeHints() {
  return {
    shown: {}, // hint id -> true once it has been said
  };
}

// Every hint: when it fires, what it says, and how long it stays up.
const HINTS = [
  {
    id: 'move',
    text: 'Move with WASD or the arrow keys — the glowing loot is the job',
    seconds: 3.5,
    when: (state) => state.levelIndex === 0 && state.time < 4 && state.screen === 'play',
  },
  {
    id: 'loot',
    text: 'Hold E to grab the loot — let go and the grab starts over',
    seconds: 3.5,
    when: (state) => {
      if (!state.player.near) return false;
      return state.player.near.kind === 'loot';
    },
  },
  {
    id: 'vault',
    text: 'Hold E to crack the vault — it takes a while, and cracking is loud',
    seconds: 3.5,
    when: (state) => {
      if (!state.player.near) return false;
      return state.player.near.kind === 'vault';
    },
  },
  {
    id: 'panel',
    text: 'Hold E to work the camera panel — every camera goes dark for 12 seconds',
    seconds: 3.5,
    when: (state) => {
      if (!state.player.near) return false;
      return state.player.near.kind === 'panel';
    },
  },
  {
    id: 'guard',
    text: 'That guard is getting suspicious — break line of sight and it cools off',
    seconds: 3.5,
    when: (state) => state.guards.some((g) => g.suspicion >= 0.2),
  },
  {
    id: 'camera',
    text: 'A camera has you — break its line of sight, or kill the feed at a panel',
    seconds: 3.5,
    when: (state) => state.cameras.some((c) => c.watching),
  },
  {
    id: 'blackout',
    text: 'Press B for Blackout Mode — shorter cones, richer loot, darker floor',
    seconds: 3.5,
    when: (state) => state.time > 60 && !state.blackout && state.screen === 'play',
  },
  {
    id: 'van',
    text: "The vault is open — get to the getaway van, bottom-left, and get out",
    seconds: 3.5,
    when: (state) => state.world.vault.cracked && state.screen === 'play',
  },
  {
    id: 'shadow',
    text: 'Dark floor patches are shadow — step into one and the cones reach half as far',
    seconds: 3.5,
    when: (state) => {
      // The thief is standing in shadow for the first time.
      if (!state.world || !state.player) return false;
      return inShadow(state.world, state.player.x, state.player.y);
    },
  },
  {
    id: 'coin',
    text: 'Click to throw a coin — the clink pulls a patrolling guard over to look',
    seconds: 3.5,
    when: (state) => {
      const guard = state.guards.find((g) => g.suspicion >= 0.45);
      if (!guard) return false;
      return distance(guard.x, guard.y, state.player.x, state.player.y) < 220;
    },
  },
  {
    id: 'sneak',
    text: 'Sneaking is slower, but the cones see you later — use it near guards',
    seconds: 3.5,
    when: (state) => state.player.sneaking && state.screen === 'play',
  },
  {
    id: 'emp',
    text: 'The alarm is climbing — Q fires the EMP and darkens every camera for 10 seconds',
    seconds: 3.5,
    when: (state) => !!state.alarm && state.alarm.value >= 60 && !state.player.empUsed,
  },
  {
    id: 'lockdown',
    text: 'LOCKDOWN — the van is sealed. Break line of sight until the meter drains',
    seconds: 3.5,
    when: (state) => !!state.alarm && state.alarm.lockdownFor > 0,
  },
  {
    id: 'chase',
    text: 'A guard is chasing you — run, break line of sight, and do not get cornered',
    seconds: 3.5,
    when: (state) => state.guards.some((g) => g.state === 'chase'),
  },
];

// The next hint this frame, or null. Only one hint speaks at a time, and
// a hint that has been said is never said again this run.
export function nextHint(hints, state) {
  for (const hint of HINTS) {
    if (hints.shown[hint.id]) continue;
    if (!hint.when(state)) continue;
    hints.shown[hint.id] = true;
    return hint;
  }
  return null;
}
