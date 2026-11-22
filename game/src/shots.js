// Deterministic scenes for the maker's screenshots (?shot=start|play|end).
// The play scene stages the exact frame the brief asks for: the thief mid-
// crossing, two guards with their cones out, a camera watching the middle
// of the floor, the vault in its corner and the alarm meter already warm.

import { cellToPx } from './world.js';

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
  // play: mid-crossing on floor 1.
  state.screen = 'play';
  const playerSpot = cellToPx(14, 7);
  state.player.x = playerSpot.x;
  state.player.y = playerSpot.y;
  state.player.facing = 0.15;
  state.player.lootCarried = 650;
  state.player.lootCount = 1;
  state.world.loot[5].taken = true; // the cash by the middle partition
  state.time = 47;

  const g1 = state.guards[0];
  const g1Spot = cellToPx(5, 5);
  g1.x = g1Spot.x;
  g1.y = g1Spot.y;
  g1.facing = 0.65;

  const g2 = state.guards[1];
  const g2Spot = cellToPx(16, 11);
  g2.x = g2Spot.x;
  g2.y = g2Spot.y;
  g2.facing = -2.25;
  g2.suspicion = 0.52; // wary: orange cone, a ? overhead
  g2.state = 'investigate';

  const g3 = state.guards[2];
  const g3Spot = cellToPx(24, 9);
  g3.x = g3Spot.x;
  g3.y = g3Spot.y;
  g3.facing = 2.7;

  state.cameras[0].facing = Math.PI / 2; // looking straight down the middle
  state.cameras[1].facing = Math.PI; // looking left along the right wall
  state.mouse = { x: playerSpot.x + 150, y: playerSpot.y - 46 }; // a coin aim, mid-throw
  state.alarm.value = 34; // warm, not yet a lockdown
  state.toast = { text: 'The vault is in the top-right corner — stay out of the cones', color: '#ffd166', for: 9999 };
}
