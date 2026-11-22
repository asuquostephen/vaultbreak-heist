// Vaultbreak — tuning constants and the three floor plans.
// The judge-facing shape of the game lives here: one screen per floor, a thief,
// patrolling guards, sweeping cameras, loot, a vault and an alarm meter.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 56; // top band: loot, alarm meter, floor name, tools
export const CELL = 40; // floor grid cell in pixels
export const GRID_X = 20; // floor origin
export const GRID_Y = 64;

export const PLAYER = {
  radius: 11,
  walkSpeed: 142,
  sneakSpeed: 76,
  coinRange: 280,
  coinNoiseRadius: 96,
  interactRange: 34,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 60,
  investigateSpeed: 96,
  chaseSpeed: 150,
  range: 158,
  halfAngle: 0.57, // ~33 degrees
  shadowRangeMul: 0.6, // vision range multiplier while the thief is in shadow
  sneakRateMul: 0.55, // detection rate multiplier while the thief sneaks
  catchRadius: 21,
  turnRate: 3.4, // radians per second a guard can swing its facing
};

export const CAMERA = {
  range: 176,
  halfAngle: 0.43,
  sweepArc: 0.72, // radians either side of its base facing
  sweepSpeed: 0.55, // radians per second of sweep phase
  alarmRate: 17, // alarm points per second while it watches the thief
};

export const ALARM = {
  max: 100,
  decayRate: 7, // points per second once nothing has contributed for a moment
  decayDelay: 1.2, // seconds unseen before decay starts
  alertGuardRate: 22, // per second from a guard at full suspicion
  waryGuardRate: 6, // per second from a guard past half suspicion
  crackRate: 5, // per second while the vault is being cracked
  caseGrabSpike: 7, // instant points for smashing a glass case
  lockdownSeconds: 8,
  lockdownFloor: 55, // alarm value after a survived lockdown
};

export const TOOLS = {
  coinsPerFloor: 3,
  empSeconds: 10,
  empCost: 250, // score paid for one EMP burst
};

// A floor plan: rows of the grid ('#' wall, '.' floor, 's' shadow floor),
// plus everything placed on it, in grid cells. The vault is a solid safe
// block drawn from `vaultBlock`; the thief cracks it from the cell below it.
export const LEVELS = [
  {
    name: 'Floor 1 — The Meridian Museum',
    parSeconds: 150,
    rows: [
      '###############################',
      '#.........#.........#....##...#',
      '#..ss.....#....ss...#....##...#',
      '#..ss.....#....ss...#.........#',
      '#.............................#',
      '#.........#.........#.........#',
      '#.........#....###..#.........#',
      '#.............................#',
      '#.........#.........#.........#',
      '#..ss.....#....ss...#....ss...#',
      '#..ss.....#....ss...#....ss...#',
      '#.........#.........#.........#',
      '#.............................#',
      '#.........#.........#.........#',
      '#.........#.........#.........#',
      '###############################',
    ],
    playerStart: { x: 2, y: 12 },
    exit: { x: 1, y: 13, w: 2, h: 2 },
    vault: { x: 25, y: 1, w: 2, value: 2500, crackSeconds: 4 },
    loot: [
      { x: 2, y: 6, kind: 'painting', value: 450, grabSeconds: 1.2 },
      { x: 5, y: 8, kind: 'gems', value: 650, grabSeconds: 1.6, cased: true },
      { x: 18, y: 3, kind: 'painting', value: 500, grabSeconds: 1.2 },
      { x: 12, y: 13, kind: 'cash', value: 300, grabSeconds: 0.8 },
      { x: 25, y: 12, kind: 'gold', value: 850, grabSeconds: 1.8, cased: true },
      { x: 22, y: 6, kind: 'cash', value: 350, grabSeconds: 0.8 },
    ],
    panels: [{ x: 19, y: 14 }],
    guards: [
      { patrol: [{ x: 5, y: 2 }, { x: 5, y: 13 }] },
      { patrol: [{ x: 15, y: 13 }, { x: 15, y: 5 }, { x: 18, y: 5 }] },
      { patrol: [{ x: 22, y: 9 }, { x: 28, y: 9 }, { x: 28, y: 12 }, { x: 22, y: 12 }] },
    ],
    cameras: [
      { x: 15, y: 0, facing: Math.PI / 2, phase: 0 },
      { x: 30, y: 8, facing: Math.PI, phase: 1.7 },
    ],
  },
  {
    name: 'Floor 2 — Halberd Bank',
    parSeconds: 190,
    rows: [
      '###############################',
      '#......#......#......#....##..#',
      '#..ss..#..ss..#..ss..#....##..#',
      '#..ss..#..ss..#..ss..#........#',
      '#.............................#',
      '#......#......#......#........#',
      '#......#......###....#........#',
      '#.............................#',
      '#......#......#......#........#',
      '#..ss..#..ss..#..ss..#...ss...#',
      '#..ss..#..ss..#..ss..#...ss...#',
      '#......#......#......#........#',
      '#.............................#',
      '#......#......#......#........#',
      '#......#......#......#........#',
      '###############################',
    ],
    playerStart: { x: 2, y: 12 },
    exit: { x: 1, y: 13, w: 2, h: 2 },
    vault: { x: 26, y: 1, w: 2, value: 4000, crackSeconds: 5 },
    loot: [
      { x: 3, y: 5, kind: 'cash', value: 400, grabSeconds: 0.8 },
      { x: 9, y: 9, kind: 'gems', value: 800, grabSeconds: 1.6, cased: true },
      { x: 11, y: 2, kind: 'painting', value: 550, grabSeconds: 1.2 },
      { x: 16, y: 13, kind: 'gold', value: 950, grabSeconds: 1.8, cased: true },
      { x: 22, y: 3, kind: 'cash', value: 450, grabSeconds: 0.8 },
      { x: 28, y: 9, kind: 'gems', value: 900, grabSeconds: 1.6, cased: true },
      { x: 24, y: 13, kind: 'painting', value: 600, grabSeconds: 1.2 },
    ],
    panels: [{ x: 8, y: 13 }, { x: 22, y: 5 }],
    guards: [
      { patrol: [{ x: 4, y: 2 }, { x: 4, y: 13 }] },
      { patrol: [{ x: 12, y: 13 }, { x: 12, y: 2 }] },
      { patrol: [{ x: 18, y: 4 }, { x: 20, y: 4 }, { x: 20, y: 11 }, { x: 18, y: 11 }] },
      { patrol: [{ x: 28, y: 12 }, { x: 24, y: 12 }, { x: 24, y: 5 }] },
    ],
    cameras: [
      { x: 10, y: 0, facing: Math.PI / 2, phase: 0.4 },
      { x: 20, y: 15, facing: -Math.PI / 2, phase: 2.1 },
      { x: 30, y: 5, facing: Math.PI, phase: 1.1 },
    ],
  },
  {
    name: 'Floor 3 — The Skyline Penthouse',
    parSeconds: 230,
    rows: [
      '###############################',
      '#..........#.....#......###...#',
      '#..ss......#..s..#..ss..###...#',
      '#..ss......#..s..#..ss........#',
      '#.....##......................#',
      '#.....##....#.....#...........#',
      '#...........#.....#....###....#',
      '#.............................#',
      '#...........#.....#...........#',
      '#..ss....#..#..s..#..ss.......#',
      '#..ss....#..#..s..#..ss....#..#',
      '#........#..#.....#........#..#',
      '#.............................#',
      '#........#.....#......#.......#',
      '#........#.....#......#....#..#',
      '###############################',
    ],
    playerStart: { x: 2, y: 12 },
    exit: { x: 1, y: 13, w: 2, h: 2 },
    vault: { x: 24, y: 1, w: 3, value: 6000, crackSeconds: 6 },
    loot: [
      { x: 5, y: 7, kind: 'gems', value: 1000, grabSeconds: 1.6, cased: true },
      { x: 13, y: 2, kind: 'cash', value: 500, grabSeconds: 0.8 },
      { x: 17, y: 9, kind: 'gold', value: 1200, grabSeconds: 1.8, cased: true },
      { x: 21, y: 4, kind: 'painting', value: 750, grabSeconds: 1.2 },
      { x: 27, y: 9, kind: 'gems', value: 1100, grabSeconds: 1.6, cased: true },
      { x: 12, y: 13, kind: 'cash', value: 550, grabSeconds: 0.8 },
      { x: 24, y: 13, kind: 'painting', value: 800, grabSeconds: 1.2 },
      { x: 28, y: 12, kind: 'gold', value: 1300, grabSeconds: 1.8, cased: true },
    ],
    panels: [{ x: 14, y: 13 }, { x: 27, y: 5 }],
    guards: [
      { patrol: [{ x: 7, y: 2 }, { x: 7, y: 10 }, { x: 4, y: 10 }] },
      { patrol: [{ x: 14, y: 5 }, { x: 14, y: 13 }] },
      { patrol: [{ x: 20, y: 12 }, { x: 20, y: 2 }] },
      { patrol: [{ x: 27, y: 7 }, { x: 23, y: 7 }, { x: 23, y: 12 }] },
      { patrol: [{ x: 10, y: 13 }, { x: 16, y: 13 }, { x: 16, y: 9 }] },
    ],
    cameras: [
      { x: 13, y: 0, facing: Math.PI / 2, phase: 0.9 },
      { x: 18, y: 15, facing: -Math.PI / 2, phase: 0.2 },
      { x: 30, y: 12, facing: Math.PI, phase: 2.6 },
      { x: 0, y: 4, facing: 0, phase: 1.4 },
    ],
  },
];
