// The floor: builds a level's walls, shadow patches, loot, cameras, guards,
// control panels, vault and exit from the plans in config.js, and answers
// the geometry questions every other module asks — can I stand here, can
// that eye see this point, and how far does its cone reach now the lights
// are out.

import { BLACKOUT, CELL, GRID_X, GRID_Y } from './config.js';

// Grid cell centre, in pixels.
export function cellToPx(cx, cy) {
  return {
    x: GRID_X + (cx + 0.5) * CELL,
    y: GRID_Y + (cy + 0.5) * CELL,
  };
}

// Pixel point back to its grid cell.
export function pxToCell(x, y) {
  return {
    cx: Math.floor((x - GRID_X) / CELL),
    cy: Math.floor((y - GRID_Y) / CELL),
  };
}

// How far a cone reaches right now: full range with the lights on, shorter
// while Blackout Mode holds. Guards, cameras and the renderer all ask here
// so the drawn cone and the seeing cone never disagree.
export function effectiveConeRange(baseRange, blackout) {
  return blackout ? baseRange * BLACKOUT.coneRangeMul : baseRange;
}

// How deep the dark is at a point: 0 in the open, 1 in a shadow patch,
// deeper still while the blackout holds — the thief hides best in the dark.
export function shadowDepth(world, x, y, blackout) {
  if (!inShadow(world, x, y)) return 0;
  return blackout ? 1 : 0.6;
}

// Scan one row of the plan, collecting wall runs and shadow cells.
function scanRow(rows, cy, width, wallCells, shadowCells, walls) {
  let runStart = -1;
  for (let cx = 0; cx <= width; cx++) {
    const ch = cx < width ? rows[cy][cx] : '.';
    if (ch === '#') {
      wallCells.add(cx + ',' + cy);
      if (runStart < 0) runStart = cx;
    } else {
      if (ch === 's') shadowCells.add(cx + ',' + cy);
      if (runStart >= 0) {
        walls.push({
          x: GRID_X + runStart * CELL,
          y: GRID_Y + cy * CELL,
          w: (cx - runStart) * CELL,
          h: CELL,
        });
        runStart = -1;
      }
    }
  }
}

export function buildWorld(level) {
  const rows = level.rows;
  const height = rows.length;
  const width = rows[0].length;
  const walls = []; // pixel rects, merged across each row for cheap collision
  const wallCells = new Set();
  const shadowCells = new Set();
  for (let cy = 0; cy < height; cy++) {
    scanRow(rows, cy, width, wallCells, shadowCells, walls);
  }
  const start = cellToPx(level.playerStart.x, level.playerStart.y);
  return {
    level,
    width,
    height,
    walls,
    wallCells,
    shadowCells,
    playerStart: start,
    exitRect: {
      x: GRID_X + level.exit.x * CELL,
      y: GRID_Y + level.exit.y * CELL,
      w: level.exit.w * CELL,
      h: level.exit.h * CELL,
    },
    vault: {
      ...level.vault,
      rect: {
        x: GRID_X + level.vault.x * CELL,
        y: GRID_Y + level.vault.y * CELL,
        w: level.vault.w * CELL,
        h: 2 * CELL,
      },
      cracked: false,
      progress: 0,
    },
    loot: level.loot.map((item) => {
      const p = cellToPx(item.x, item.y);
      return { ...item, px: p.x, py: p.y, taken: false, progress: 0 };
    }),
    panels: level.panels.map((panel) => {
      const p = cellToPx(panel.x, panel.y);
      return { ...panel, px: p.x, py: p.y };
    }),
    guardSpawns: level.guards.map((g) => g.patrol.map((wp) => cellToPx(wp.x, wp.y))),
    cameraSpawns: level.cameras.map((c) => {
      const p = cellToPx(c.x, c.y);
      return { ...c, px: p.x, py: p.y };
    }),
  };
}

export function isWallCell(world, cx, cy) {
  return world.wallCells.has(cx + ',' + cy);
}

// Is a point inside the getaway van's corner? The van is the way out —
// unless a lockdown has sealed it.
export function exitContains(world, x, y) {
  const ex = world.exitRect;
  return x > ex.x && x < ex.x + ex.w && y > ex.y && y < ex.y + ex.h;
}

export function inShadow(world, x, y) {
  const { cx, cy } = pxToCell(x, y);
  return world.shadowCells.has(cx + ',' + cy);
}

// Does a circle of radius r at (x, y) touch a wall rect?
function circleHitsRect(x, y, r, rect) {
  const nx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(y, rect.y + rect.h));
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < r * r;
}

// Move a circle by (dx, dy), sliding along walls; returns the new position.
export function moveCircle(world, x, y, r, dx, dy) {
  let nx = x + dx;
  for (const wall of world.walls) {
    if (circleHitsRect(nx, y, r, wall)) {
      nx = dx > 0 ? wall.x - r - 0.01 : wall.x + wall.w + r + 0.01;
    }
  }
  let ny = y + dy;
  for (const wall of world.walls) {
    if (circleHitsRect(nx, ny, r, wall)) {
      ny = dy > 0 ? wall.y - r - 0.01 : wall.y + wall.h + r + 0.01;
    }
  }
  return { x: nx, y: ny };
}

// Line of sight between two points: sampled walk, blocked by any wall cell.
export function lineOfSight(world, x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 7));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    const { cx, cy } = pxToCell(x, y);
    if (isWallCell(world, cx, cy)) return false;
  }
  return true;
}

// Is a point inside a view cone (origin, facing, half-angle, range) with a
// clear line of sight? Returns 0 when unseen, else a 0..1 strength where 1
// is point blank at the centre of the cone.
export function coneSees(world, ox, oy, facing, halfAngle, range, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range || dist < 1) return 0;
  const ang = Math.atan2(dy, dx);
  const TAU = Math.PI * 2;
  const diff = Math.abs((((ang - facing) % TAU) + Math.PI * 3) % TAU - Math.PI);
  if (diff > halfAngle) return 0;
  if (!lineOfSight(world, ox, oy, tx, ty)) return 0;
  const centre = 1 - diff / halfAngle; // 1 dead ahead, 0 at the cone edge
  const near = 1 - dist / range; // 1 point blank
  return 0.25 + 0.75 * Math.max(centre, near) * (0.4 + 0.6 * near);
}
