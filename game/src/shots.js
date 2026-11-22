// Deterministic scenes for the maker's screenshots (?shot=start|play|end).
// The play scene stages the exact frame the brief asks for: the thief mid-
// crossing, two guards with their cones out, a camera watching the middle
// of the floor, the vault in its corner and the alarm meter already warm.
// The blackout scene stages the same crossing with the lights killed, so
// the fourth screenshot can show Blackout Mode itself.

import { cellToPx } from './world.js';

// Put a guard on a cell, facing a direction, optionally already wary.
function placeGuard(guard, cx, cy, facing, suspicion = 0, state = null) {
  const spot = cellToPx(cx, cy);
  guard.x = spot.x;
  guard.y = spot.y;
  guard.facing = facing;
  guard.suspicion = suspicion;
  if (state) guard.state = state;
}

// The mid-crossing frame the play shot and the blackout shot share: the
// thief halfway across floor 1, two guards with their cones out, a camera
// watching the middle of the floor, the vault in its corner, the alarm warm.
function stageCrossing(state) {
  state.screen = 'play';
  const playerSpot = cellToPx(14, 7);
  state.player.x = playerSpot.x;
  state.player.y = playerSpot.y;
  state.player.facing = 0.15;
  state.player.lootCarried = 650;
  state.player.lootCount = 1;
  state.world.loot[5].taken = true; // the cash by the middle partition
  state.time = 47;

  placeGuard(state.guards[0], 5, 5, 0.65);
  placeGuard(state.guards[1], 16, 11, -2.25, 0.52, 'investigate'); // wary: orange cone, a ? overhead
  placeGuard(state.guards[2], 24, 9, 2.7);

  state.cameras[0].facing = Math.PI / 2; // looking straight down the middle
  state.cameras[1].facing = Math.PI; // looking left along the right wall
  state.mouse = { x: playerSpot.x + 150, y: playerSpot.y - 46 }; // a coin aim, mid-throw
  state.alarm.value = 34; // warm, not yet a lockdown
  state.toast = { text: 'The vault is in the top-right corner — stay out of the cones', color: '#ffd166', for: 9999 };
}

export function stageShot(state, helpers, which, seed) {
  void seed;
  if (which === 'start') {
    helpers.startFloor(0);
    state.screen = 'title';
    return;
  }
  helpers.startFloor(0);
  if (which === 'end') {
    // A finished first floor: vault cracked, two lifts, a time bonus.
    state.player.lootCarried = 3600;
    state.haulLines = [
      { label: 'The vault, cracked', value: 2500 },
      { label: 'Lifted: gems', value: 650 },
      { label: 'Lifted: painting', value: 450 },
    ];
    state.time = 96;
    helpers.finishFloor();
    return;
  }
  if (which === 'blackout') {
    // The same crossing, lights out: shorter cones, glowing loot, the HUD
    // pill, and the veil over the floor. The coin aim sits further out, to
    // show the aim line crossing the dark.
    stageCrossing(state);
    state.blackout = true;
    state.mouse = { x: state.player.x + 190, y: state.player.y - 20 };
    state.toast = { text: 'BLACKOUT — cones are shorter, loot pays 15% more', color: '#c7d2fe', for: 9999 };
    return;
  }
  // play: mid-crossing on floor 1.
  stageCrossing(state);
}
