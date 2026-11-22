// The floor: builds a level's walls, shadow patches, loot, cameras, guards,
// control panels, vault and exit from the plans in config.js, and answers
// the geometry questions every other module asks — can I stand here, and
// can that eye see this point.

import { CELL, GRID_X, GRID_Y } from './config.js';

export function cellToPx(cx, cy) {
  return { x: GRID_X + cx * CELL + CELL / 2, y: GRID_Y + cy * CELL + CELL / 2 };
}

export function pxToCell(x, y) {
  return { cx: Math.floor((x - GRID_X) / CELL), cy: Math.floor((y - GRID_Y) / CELL) };
}

export function buildWorld(level) {
  const rows = level.rows;
  const height = rows.length;
  const width = rows[0].length;
  const walls = []; // pixel rects, merged across each row for cheap collision
  const wallCells = new Set();
  const shadowCells = new Set();
  for (let cy = 0; cy < height; cy++) {
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

export function inShadow(world, x, y) {
  const { cx, cy } = pxToCell(x, y);
  return world.shadowCells.has(cx + ',' + cy);
}

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
  let diff = Math.abs(((ang - facing) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  if (diff > halfAngle) return 0;
  if (!lineOfSight(world, ox, oy, tx, ty)) return 0;
  const centre = 1 - diff / halfAngle; // 1 dead ahead, 0 at the cone edge
  const near = 1 - dist / range; // 1 point blank
  return 0.25 + 0.75 * Math.max(centre, near) * (0.4 + 0.6 * near);
}
