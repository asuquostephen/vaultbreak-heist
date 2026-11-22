// Vaultbreak — boot, the frame loop, and the glue between the thief, the
// guards, the cameras and the alarm. Screens: title, play, busted, results.
// The run: three floors, loot banked floor by floor, one EMP and three
// coins a floor, and a van that seals shut while the alarm is locked down.
// Blackout Mode (B) threads through the whole loop: the toggle lives here,
// the flag rides into every update, and the night bed starts and stops here.

import { ALARM, LEVELS, TOOLS } from './config.js';
import { attachInput, endFrameInput, getMouse, isHeld, moveVector, sneakHeld, wasPressed } from './input.js';
import { buildWorld, cellToPx, exitContains } from './world.js';
import { makeGuard, updateGuard } from './guards.js';
import { makeCamera, PANEL_DISABLE_SECONDS, updateCamera } from './cameras.js';
import { makeAlarm, spikeAlarm, updateAlarm } from './alarm.js';
import { makePlayer, coinNoiseRadius, throwCoin, updatePlayer } from './player.js';
import { clamp } from './random.js';
import { makeAudio } from './audio.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';
import { GHOST_CEILING, makeObjectives, updateObjectives } from './objectives.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const audio = makeAudio();

const BEST_KEY = 'vaultbreak-best-haul';
let savedBest = null;
try {
  const raw = localStorage.getItem(BEST_KEY);
  if (raw !== null) savedBest = parseInt(raw, 10);
} catch {
  savedBest = null;
}

const state = {
  screen: 'title',
  paused: false,
  levelIndex: 0,
  world: null,
  player: null,
  guards: [],
  cameras: [],
  alarm: makeAlarm(),
  time: 0,
  banked: 0,
  haulLines: [],
  coinFx: [],
  toast: null,
  camerasOffFor: 0,
  panelOffFor: 0,
  mouse: { x: 0, y: 0 },
  results: null,
  best: savedBest,
  waryAudioFor: 0,
  crackTickFor: 0,
  lockdownPingFor: 0,
  sealedToastFor: 0,
  blackout: false, // Blackout Mode: the lights are out on this floor
  objectives: [], // the job card for this floor (see objectives.js)
  alarmPeak: 0, // the highest the alarm meter has climbed this floor
  showingHelp: false, // the how-to-play overlay
  runStats: { floorsCleared: 0, alarmsTripped: 0, timeTotal: 0 },
};

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function toast(text, color, seconds = 2.2) {
  state.toast = { text, color, for: seconds };
}

function startFloor(index) {
  if (state.blackout) audio.blackoutOff();
  state.blackout = false;
  state.levelIndex = index;
  state.world = buildWorld(LEVELS[index]);
  state.player = makePlayer(state.world);
  state.guards = state.world.guardSpawns.map((patrol, i) => makeGuard(patrol, i));
  state.cameras = state.world.cameraSpawns.map((spawn) => makeCamera(spawn));
  state.alarm = makeAlarm();
  state.objectives = makeObjectives(LEVELS[index]);
  state.alarmPeak = 0;
  state.showingHelp = false;
  state.time = 0;
  state.haulLines = [];
  state.coinFx = [];
  state.camerasOffFor = 0;
  state.panelOffFor = 0;
  state.paused = false;
  state.results = null;
  announce(state.world.level.name + '. The job starts.');
}

function startRun() {
  state.banked = 0;
  state.runStats = { floorsCleared: 0, alarmsTripped: 0, timeTotal: 0 };
  startFloor(0);
  state.screen = 'play';
  toast('Floor 1 — lift what glitters, crack the vault, reach the van', '#ffd166', 3.4);
}

// Kill the lights, or bring them back. The dark shortens every cone and
// pays 15% more — and hums, until the lights come back on.
function toggleBlackout() {
  state.blackout = !state.blackout;
  if (state.blackout) {
    audio.blackoutOn();
    toast('BLACKOUT — cones are shorter, loot pays 15% more', '#c7d2fe', 2.6);
    announce('Blackout Mode on. Cones are shorter, loot pays 15 percent more.');
  } else {
    audio.blackoutOff();
    toast('Lights back on — back to face value', '#e8ecf4', 1.6);
    announce('Blackout Mode off.');
  }
}

function gradeFor(ratio) {
  if (ratio >= 0.95) return 'S';
  if (ratio >= 0.75) return 'A';
  if (ratio >= 0.5) return 'B';
  if (ratio >= 0.25) return 'C';
  return 'D';
}

// The ghost bonus: $200 for a floor the alarm never woke up on — the
// meter stayed under the ceiling the whole way to the van.
const GHOST_BONUS = 200;

function finishFloor() {
  const level = state.world.level;
  const lootTotal = state.player.lootCarried;
  const maxLoot = level.loot.reduce((sum, item) => sum + item.value, 0) + level.vault.value;
  const timeBonus = Math.max(0, Math.round((level.parSeconds - state.time) * 10));
  const empCost = state.player.empUsed ? TOOLS.empCost : 0;
  const ghostBonus = state.alarmPeak < GHOST_CEILING ? GHOST_BONUS : 0;
  const floorTotal = Math.max(0, lootTotal + timeBonus - empCost + ghostBonus);
  state.banked += floorTotal;
  const lines = state.haulLines.slice();
  lines.push({ label: 'Time bonus (' + Math.max(0, Math.round(level.parSeconds - state.time)) + 's under par)', value: timeBonus });
  if (ghostBonus > 0) lines.push({ label: 'Ghost — the floor never woke up', value: ghostBonus });
  if (empCost > 0) lines.push({ label: 'EMP burst', value: -empCost });
  const isLast = state.levelIndex >= LEVELS.length - 1;
  state.runStats.floorsCleared += 1;
  state.runStats.timeTotal += state.time;
  state.results = {
    floorName: level.name,
    lines,
    grandTotal: state.banked,
    grade: gradeFor(lootTotal / maxLoot),
    isLast,
    stats: { ...state.runStats },
  };
  if (isLast) {
    if (state.best === null || state.banked > state.best) {
      state.best = state.banked;
      try {
        localStorage.setItem(BEST_KEY, String(state.best));
      } catch {
        /* private mode: the best haul just lives for this session */
      }
    }
  }
  state.screen = 'results';
  audio.escape();
  announce('Clean getaway. Total haul $' + state.banked + ', grade ' + state.results.grade + '.');
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'loot') {
      audio.pickup();
      const paid = event.paid !== undefined ? event.paid : event.item.value;
      state.haulLines.push({ label: 'Lifted: ' + event.item.kind, value: paid });
      if (event.item.cased) {
        spikeAlarm(state.alarm, ALARM.caseGrabSpike);
        toast('Glass case smashed — the alarm jumped!', '#fb923c');
      } else {
        toast('+$' + paid + ' — ' + event.item.kind, '#86efac', 1.4);
      }
    } else if (event.type === 'vaultCracked') {
      audio.pickup();
      const paid = event.paid !== undefined ? event.paid : state.world.vault.value;
      state.haulLines.push({ label: 'The vault, cracked', value: paid });
      toast('VAULT CRACKED — +$' + paid + '. Now get to the van!', '#ffd166', 3);
    } else if (event.type === 'panelUsed') {
      state.panelOffFor = PANEL_DISABLE_SECONDS;
      audio.panel();
      toast('Camera feed cut — 12 seconds dark', '#2dd4bf');
    } else if (event.type === 'wary') {
      if (state.waryAudioFor <= 0) {
        audio.wary();
        state.waryAudioFor = 1.6;
      }
    } else if (event.type === 'alert') {
      audio.alert();
      toast('SPOTTED!', '#f87171', 1.6);
    } else if (event.type === 'lockdown') {
      audio.lockdown();
      state.runStats.alarmsTripped += 1;
      toast('LOCKDOWN — the van is sealed!', '#f87171', 3);
    } else if (event.type === 'lockdownOver') {
      toast('Lockdown over — the van is open again', '#86efac');
    } else if (event.type === 'caught') {
      state.screen = 'busted';
      audio.caught();
      announce('Busted on ' + state.world.level.name + '.');
    }
  }
}

// Fly the thrown coins: slide each one to its landing spot, then ring the
// noise out and pull nearby patrol guards over to look at it.
function updateCoinFx(dt) {
  const next = [];
  for (const fx of state.coinFx) {
    if (!fx.landed) {
      fx.t += dt;
      const k = Math.min(1, fx.t / 0.32);
      fx.x = fx.sx + (fx.tx - fx.sx) * k;
      fx.y = fx.sy + (fx.ty - fx.sy) * k;
      if (k >= 1) {
        fx.landed = true;
        fx.age = 0;
        // The clink lands: nearby guards turn to look at it. In the dark
        // the ring carries further, so it pulls guards from further away.
        const ring = coinNoiseRadius(state.blackout);
        for (const guard of state.guards) {
          const d = Math.hypot(guard.x - fx.x, guard.y - fx.y);
          if (d < ring && (guard.state === 'patrol' || guard.state === 'return')) {
            guard.lastSeen = { x: fx.x, y: fx.y };
            guard.suspicion = Math.max(guard.suspicion, 0.55);
            guard.state = 'investigate';
          }
        }
      }
      next.push(fx);
    } else {
      fx.age += dt;
      if (fx.age < 0.9) next.push(fx);
    }
  }
  state.coinFx = next;
}

// Count the frame's timers down: wary sting, lockdown pings, sealed-van
// nagging, camera downtime. Returns nothing; the state is the point.
function tickTimers(dt) {
  state.time += dt;
  if (state.waryAudioFor > 0) state.waryAudioFor -= dt;
  if (state.sealedToastFor > 0) state.sealedToastFor -= dt;
  if (state.panelOffFor > 0) state.panelOffFor = Math.max(0, state.panelOffFor - dt);
  state.camerasOffFor = Math.max(state.player.empFor, state.panelOffFor);
}

// EMP: one burst a floor, at a price. The Q key spends it.
function handleEmp() {
  if (wasPressed('KeyQ') && !state.player.empUsed) {
    state.player.empUsed = true;
    state.player.empFor = TOOLS.empSeconds;
    audio.emp();
    toast('EMP — cameras dark for 10s (−$' + TOOLS.empCost + ')', '#2dd4bf');
  }
}

// Cracking carries: the safe's mechanism talks to anyone close enough.
function crackNoise(dt) {
  if (!state.player.cracking) return;
  state.crackTickFor -= dt;
  if (state.crackTickFor <= 0) {
    audio.crackTick();
    state.crackTickFor = 0.13;
  }
  for (const guard of state.guards) {
    const d = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
    if (d < 165) guard.suspicion = clamp(guard.suspicion + 0.22 * dt, 0, 1);
  }
}

// A thrown coin: click, pay one of the floor's three, and fly it out.
function handleCoinThrow() {
  const mouse = getMouse();
  state.mouse = mouse;
  if (mouse.clicked && state.player.coins > 0) {
    const land = throwCoin(state.player, mouse.x, mouse.y);
    if (land) {
      state.coinFx.push({
        sx: state.player.x,
        sy: state.player.y,
        tx: land.x,
        ty: land.y,
        x: state.player.x,
        y: state.player.y,
        t: 0,
        landed: false,
        age: 0,
      });
      audio.coin();
    }
  }
}

// Lockdown pressure: the building keeps reporting where the thief was.
function lockdownPings(dt) {
  if (state.alarm.lockdownFor <= 0) return;
  state.lockdownPingFor -= dt;
  if (state.lockdownPingFor > 0) return;
  state.lockdownPingFor = 0.8;
  for (const guard of state.guards) {
    guard.lastSeen = { x: state.player.x, y: state.player.y };
    if (guard.state === 'patrol' || guard.state === 'return') {
      guard.state = 'investigate';
      guard.suspicion = Math.max(guard.suspicion, 0.55);
    }
  }
}

function updatePlay(dt) {
  const events = [];
  tickTimers(dt);
  if (wasPressed('KeyB')) toggleBlackout();
  // R restarts the floor: the banked loot stays banked, the floor resets.
  if (wasPressed('KeyR')) {
    startFloor(state.levelIndex);
    toast(state.world.level.name + ' — fresh start', '#e8ecf4', 1.6);
    return;
  }
  handleEmp();

  updatePlayer(
    state.world,
    state.player,
    dt,
    { move: moveVector(), sneaking: sneakHeld(), interact: isHeld('KeyE') },
    events,
    state.blackout,
  );

  crackNoise(dt);
  handleCoinThrow();
  updateCoinFx(dt);

  for (const guard of state.guards) {
    updateGuard(state.world, guard, state.player, dt, events, state.blackout);
  }

  let cameraStrength = 0;
  for (const camera of state.cameras) {
    const strength = updateCamera(state.world, camera, state.player, dt, state.camerasOffFor, state.blackout);
    cameraStrength = Math.max(cameraStrength, strength);
  }

  lockdownPings(dt);

  const loudest = state.guards.reduce((max, g) => Math.max(max, g.suspicion), 0);
  updateAlarm(
    state.alarm,
    { cameraStrength, loudestGuardSuspicion: loudest, cracking: state.player.cracking },
    dt,
    events,
    state.blackout,
  );
  // The meter's peak this floor is what the ghost job is judged on.
  state.alarmPeak = Math.max(state.alarmPeak, state.alarm.value);
  handleEvents(events);
  // Check the job card: a job finished this frame gets a chime.
  const completed = updateObjectives(state.objectives, state, state.alarmPeak);
  if (completed.length > 0) audio.objective();
  if (state.screen !== 'play') return;

  // The van.
  const p = state.player;
  if (exitContains(state.world, p.x, p.y)) {
    if (state.alarm.lockdownFor > 0) {
      if (state.sealedToastFor <= 0) {
        toast('The van is sealed while the lockdown lasts!', '#f87171', 1.6);
        state.sealedToastFor = 2.5;
      }
    } else {
      finishFloor();
    }
  }
}

function update(dt) {
  if (state.toast && state.toast.for > 0) state.toast.for -= dt;
  // H opens the how-to-play overlay anywhere it can be read; H closes it.
  if (wasPressed('KeyH') && (state.screen === 'play' || state.screen === 'title')) {
    state.showingHelp = !state.showingHelp;
    audio.click();
    return;
  }
  if (state.showingHelp) return;
  if (state.screen === 'title') {
    if (wasPressed('Enter') || getMouse().clicked) {
      audio.unlock();
      audio.click();
      startRun();
    }
    return;
  }
  if (state.screen === 'busted') {
    if (wasPressed('Enter')) {
      audio.click();
      startFloor(state.levelIndex);
      state.screen = 'play';
    }
    return;
  }
  if (state.screen === 'results') {
    if (wasPressed('Enter')) {
      audio.click();
      if (state.results.isLast) {
        state.screen = 'title';
      } else {
        startFloor(state.levelIndex + 1);
        state.screen = 'play';
        toast(state.world.level.name, '#ffd166', 2.6);
      }
    }
    return;
  }
  // play
  if (wasPressed('KeyP', 'Escape')) {
    state.paused = !state.paused;
    return;
  }
  if (!state.paused) updatePlay(dt);
}

// Screenshot mode: ?shot=start|play|end&seed=N stages a frozen scene.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
attachInput(canvas);
window.addEventListener('keydown', () => audio.unlock());
canvas.addEventListener('mousedown', () => audio.unlock());
if (shot) {
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  stageShot(state, { startFloor, startRun, finishFloor }, shot, seed);
} else {
  startFloor(0);
  state.screen = 'title';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (!shot) update(dt);
  drawGame(ctx, state);
  endFrameInput();
  if (shot && !window.__shotReady) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
