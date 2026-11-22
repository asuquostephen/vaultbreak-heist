// The job card: what this floor asks of the thief, checked off as the
// night goes on. Every floor has the same four jobs — lift half the floor's
// loose loot, crack the vault, keep the alarm under 25, and reach the van.
// The card is drawn in the corner of the floor, and the run's results
// screen pays the ghost bonus when the alarm job survives the floor.

// How much of the floor's loose loot the lift job asks for: half of it.
export const LOOT_SHARE = 0.5;

// The alarm ceiling the ghost job defends: the meter must never reach it.
export const GHOST_CEILING = 25;

export function makeObjectives(level) {
  const lootSum = level.loot.reduce((sum, item) => sum + item.value, 0);
  const lootTarget = Math.max(1, Math.round(lootSum * LOOT_SHARE));
  return [
    {
      id: 'loot',
      label: 'Lift $' + lootTarget.toLocaleString('en-US') + ' of loot',
      target: lootTarget,
      done: false,
      failed: false,
    },
    {
      id: 'vault',
      label: 'Crack the vault ($' + level.vault.value.toLocaleString('en-US') + ')',
      done: false,
      failed: false,
    },
    {
      id: 'ghost',
      label: 'Keep the alarm under ' + GHOST_CEILING,
      done: false,
      failed: false,
    },
    {
      id: 'van',
      label: 'Reach the getaway van',
      done: false,
      failed: false,
    },
  ];
}

// How many jobs on the card are done: the "2/4" the corner shows.
export function objectivesDoneCount(objectives) {
  let done = 0;
  for (const obj of objectives) {
    if (obj.done) done += 1;
  }
  return done;
}

// Did the thief keep the floor quiet — the ghost job intact at the end?
export function ghostSurvived(objectives) {
  const ghost = objectives.find((obj) => obj.id === 'ghost');
  return ghost ? ghost.done : false;
}

// The card as one line for the results screen: "3 of 4 jobs done".
export function objectivesSummary(objectives) {
  const done = objectivesDoneCount(objectives);
  return done + ' of ' + objectives.length + ' jobs done';
}

// Check the card against the live state. Returns the ids completed on this
// very frame, so the game can chime for them. A job that fails (the alarm
// climbing past the ceiling) is marked failed and never completes.
export function updateObjectives(objectives, state, alarmPeak) {
  const newly = [];
  const finished = state.screen === 'results' || state.screen === 'complete';
  for (const obj of objectives) {
    if (obj.done || obj.failed) continue;
    if (obj.id === 'loot' && state.player.lootCarried >= obj.target) {
      obj.done = true;
      newly.push(obj.id);
    } else if (obj.id === 'vault' && state.world.vault.cracked) {
      obj.done = true;
      newly.push(obj.id);
    } else if (obj.id === 'ghost') {
      if (alarmPeak >= GHOST_CEILING) {
        obj.failed = true;
      } else if (finished) {
        obj.done = true;
        newly.push(obj.id);
      }
    } else if (obj.id === 'van' && finished) {
      obj.done = true;
      newly.push(obj.id);
    }
  }
  return newly;
}
