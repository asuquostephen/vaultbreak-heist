// Everything the player sees: the floor, the cones, the crew and the HUD.
// The one frame the game is judged by is drawn here — a room the thief is
// crossing, guards with vision cones, cameras, a loot target and the alarm
// meter, all readable at a glance. Safe floor is cool, shadow is darker,
// danger is amber or red, loot glows warm. In Blackout Mode the lights die:
// a flickering veil drops over the floor, loot glows harder so the thief can
// still find it, and the HUD says so in plain text.

import { BLACKOUT, CAMERA, CELL, GRID_X, GRID_Y, GUARD, HUD_H, VIEW_W } from './config.js';
import { clamp, flickerNoise, glowPulse } from './random.js';
import { effectiveConeRange, isWallCell, pxToCell, shadowDepth } from './world.js';
import { payoutFor } from './player.js';
import { objectivesDoneCount } from './objectives.js';

const INK = '#e8ecf4';
const DIM = '#9aa5b8';
const GOLD = '#ffd166';
const TEAL = '#2dd4bf';
const FONT = 'system-ui, sans-serif';

// March rays across a cone, stopping each at the first wall, so the drawn
// cone matches what the eye behind it can actually see.
function conePath(ctx, world, ox, oy, facing, halfAngle, range) {
  const rays = 16;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  for (let i = 0; i <= rays; i++) {
    const ang = facing - halfAngle + (2 * halfAngle * i) / rays;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let len = range;
    for (let step = 7; step < range; step += 7) {
      const { cx, cy } = pxToCell(ox + dx * step, oy + dy * step);
      if (isWallCell(world, cx, cy)) {
        len = step;
        break;
      }
    }
    ctx.lineTo(ox + dx * len, oy + dy * len);
  }
  ctx.closePath();
}

// Fill a watcher's cone in one colour: guards and cameras share the shape,
// and the range they draw is the range they see with — blackout included.
function fillCone(ctx, world, ox, oy, facing, halfAngle, baseRange, blackout, fill) {
  const range = effectiveConeRange(baseRange, blackout);
  conePath(ctx, world, ox, oy, facing, halfAngle, range);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawFloor(ctx, state) {
  const { world } = state;
  const blackout = state.blackout;
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, VIEW_W, 720);
  for (let cy = 0; cy < world.height; cy++) {
    for (let cx = 0; cx < world.width; cx++) {
      const x = GRID_X + cx * CELL;
      const y = GRID_Y + cy * CELL;
      if (world.wallCells.has(cx + ',' + cy)) continue;
      const shadow = world.shadowCells.has(cx + ',' + cy);
      ctx.fillStyle = shadow ? '#161b27' : (cx + cy) % 2 === 0 ? '#242b3a' : '#222837';
      ctx.fillRect(x, y, CELL, CELL);
      if (shadow) {
        // Lit shadow keeps its old tint exactly; in the dark it deepens.
        const depth = shadowDepth(world, x + CELL / 2, y + CELL / 2, blackout);
        const tint = blackout ? 0.05 + depth * 0.06 : 0.05;
        ctx.fillStyle = 'rgba(45, 212, 191, ' + tint + ')';
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }
  // The getaway corner.
  const ex = world.exitRect;
  ctx.fillStyle = '#123524';
  ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(ex.x + 3, ex.y + 3, ex.w - 6, ex.h - 6);
  ctx.setLineDash([]);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('GETAWAY', ex.x + ex.w / 2, ex.y + ex.h / 2 - 2);
  ctx.fillText('VAN', ex.x + ex.w / 2, ex.y + ex.h / 2 + 13);
  if (state.alarm.lockdownFor > 0) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('SEALED', ex.x + ex.w / 2, ex.y + ex.h / 2 + 28);
  }
  // Walls, with a lit top edge so rooms read as rooms.
  for (const wall of world.walls) {
    ctx.fillStyle = '#46536e';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = '#5d6d8f';
    ctx.fillRect(wall.x, wall.y, wall.w, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(wall.x, wall.y + wall.h - 4, wall.w, 4);
  }
}

function drawVault(ctx, state) {
  const vault = state.world.vault;
  const r = vault.rect;
  ctx.fillStyle = '#596273';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#8b95a9';
  ctx.lineWidth = 3;
  ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 21, 0, Math.PI * 2);
  ctx.fillStyle = vault.cracked ? GOLD : '#78818f';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = vault.cracked ? '#b45309' : '#4b5563';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#2b303c';
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = 'bold 12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(vault.cracked ? 'VAULT OPEN' : 'THE VAULT', cx, r.y + r.h + 15);
  if (!vault.cracked && vault.progress > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - 34, r.y + r.h + 21, 68, 8);
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - 33, r.y + r.h + 22, 66 * vault.progress, 6);
  }
}

const LOOT_STYLE = {
  painting: { color: '#f4a261', label: 'ART' },
  gems: { color: '#67e8f9', label: 'GEMS' },
  gold: { color: '#ffd166', label: 'GOLD' },
  cash: { color: '#86efac', label: 'CASH' },
};

function drawLoot(ctx, state) {
  const blackout = state.blackout;
  for (const item of state.world.loot) {
    const style = LOOT_STYLE[item.kind];
    if (item.taken) {
      ctx.strokeStyle = 'rgba(154, 165, 184, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(item.px - 13, item.py - 13, 26, 26);
      continue;
    }
    // In the dark the loot glows harder, so the thief can still find it.
    if (blackout) {
      const glowR = 30 * BLACKOUT.lootGlowMul;
      const glow = ctx.createRadialGradient(item.px, item.py, 4, item.px, item.py, glowR);
      glow.addColorStop(0, style.color + '55');
      glow.addColorStop(1, style.color + '00');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(item.px, item.py, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
    const pulseAmp = blackout ? 0.16 : 0.06;
    const pulse = glowPulse(state.time, item.px, pulseAmp);
    ctx.save();
    ctx.translate(item.px, item.py);
    ctx.scale(pulse, pulse);
    if (item.kind === 'painting') {
      ctx.fillStyle = '#7c4a21';
      ctx.fillRect(-14, -11, 28, 22);
      ctx.fillStyle = style.color;
      ctx.fillRect(-10, -7, 20, 14);
      ctx.fillStyle = '#264653';
      ctx.beginPath();
      ctx.moveTo(-10, 7);
      ctx.lineTo(-2, -3);
      ctx.lineTo(3, 3);
      ctx.lineTo(7, -2);
      ctx.lineTo(10, 7);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === 'gems') {
      ctx.fillStyle = style.color;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, -3);
      ctx.lineTo(0, 13);
      ctx.lineTo(-10, -3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(5, -3);
      ctx.lineTo(0, 4);
      ctx.lineTo(-5, -3);
      ctx.closePath();
      ctx.fill();
    } else if (item.kind === 'gold') {
      ctx.fillStyle = style.color;
      ctx.fillRect(-13, 1, 12, 7);
      ctx.fillRect(1, 1, 12, 7);
      ctx.fillRect(-6, -7, 12, 7);
      ctx.fillStyle = 'rgba(120, 72, 0, 0.5)';
      ctx.fillRect(-13, 6, 12, 2);
      ctx.fillRect(1, 6, 12, 2);
      ctx.fillRect(-6, -2, 12, 2);
    } else {
      ctx.fillStyle = style.color;
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = '#166534';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (item.cased) {
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.65)';
      ctx.fillStyle = 'rgba(147, 197, 253, 0.10)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(item.px - 16, item.py - 16, 32, 32);
      ctx.strokeRect(item.px - 16, item.py - 16, 32, 32);
    }
    const shown = payoutFor(item.value, blackout);
    ctx.fillStyle = style.color;
    ctx.font = 'bold 10px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('$' + shown, item.px, item.py + 27);
  }
}

function drawPanels(ctx, state) {
  for (const panel of state.world.panels) {
    const ready = panel.coolFor <= 0;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(panel.px - 11, panel.py - 9, 22, 18);
    ctx.fillStyle = ready ? TEAL : '#4b5563';
    ctx.fillRect(panel.px - 8, panel.py - 6, 16, 9);
    ctx.fillStyle = DIM;
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('CAM PANEL', panel.px, panel.py + 20);
  }
}

function drawCameras(ctx, state) {
  const off = state.camerasOffFor > 0;
  for (const camera of state.cameras) {
    if (!off) {
      const fill = camera.watching ? 'rgba(239, 68, 68, 0.20)' : 'rgba(96, 165, 250, 0.13)';
      fillCone(ctx, state.world, camera.x, camera.y, camera.facing, CAMERA.halfAngle, CAMERA.range, state.blackout, fill);
    }
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#111827';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = off ? '#4b5563' : camera.watching ? '#ef4444' : '#60a5fa';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.facing) * 4, camera.y + Math.sin(camera.facing) * 4, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = off ? '#4b5563' : '#f87171';
    ctx.fill();
  }
}

function drawGuards(ctx, state) {
  for (const guard of state.guards) {
    const chasing = guard.state === 'chase';
    const wary = guard.suspicion >= 0.45;
    const fill = chasing
      ? 'rgba(239, 68, 68, 0.20)'
      : wary
        ? 'rgba(249, 115, 22, 0.17)'
        : 'rgba(251, 191, 36, 0.13)';
    fillCone(ctx, state.world, guard.x, guard.y, guard.facing, GUARD.halfAngle, GUARD.range, state.blackout, fill);
    // Body: uniform, head, cap, facing tick.
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fillStyle = chasing ? '#7f1d1d' : '#1e3a5f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = chasing ? '#ef4444' : '#3b82f6';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e7c39a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 15, guard.y + Math.sin(guard.facing) * 15);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f2440';
    ctx.stroke();
    // Suspicion: a filling arc, then ? or !.
    if (guard.suspicion > 0.04) {
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 21, 7, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = chasing ? '#ef4444' : '#fb923c';
      ctx.stroke();
    }
    if (chasing || guard.suspicion >= 0.45) {
      ctx.font = 'bold 17px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillStyle = chasing ? '#ef4444' : '#fb923c';
      ctx.fillText(chasing ? '!' : '?', guard.x, guard.y - 28);
    }
  }
}

function drawPlayer(ctx, state) {
  const player = state.player;
  // Coin aim: a dotted line to the mouse while coins remain.
  if (state.screen === 'play' && player.coins > 0 && state.mouse) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(state.mouse.x, state.mouse.y);
    ctx.stroke();
    ctx.restore();
  }
  if (player.sneaking) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1522';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = TEAL;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(player.x + Math.cos(player.facing) * 3, player.y + Math.sin(player.facing) * 3, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = TEAL;
  ctx.fill();
  // The bag grows with the haul.
  if (player.lootCount > 0) {
    ctx.beginPath();
    ctx.arc(player.x - Math.cos(player.facing) * 10, player.y - Math.sin(player.facing) * 10, 4 + Math.min(4, player.lootCount), 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
  }
  // Hold-E prompt and progress.
  const target = player.near;
  if (state.screen === 'play' && target) {
    const blackout = state.blackout;
    const label =
      target.kind === 'loot'
        ? 'Hold E — grab the ' + target.item.kind + ' ($' + payoutFor(target.item.value, blackout) + ')'
        : target.kind === 'vault'
          ? 'Hold E — crack the vault ($' + payoutFor(state.world.vault.value, blackout) + ')'
          : 'Hold E — kill the cameras (12s)';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(5, 8, 14, 0.82)';
    ctx.fillRect(player.x - w / 2, player.y - 46, w, 20);
    ctx.fillStyle = INK;
    ctx.fillText(label, player.x, player.y - 32);
    if (player.target && player.targetProgress > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(player.x - 26, player.y + 17, 52, 6);
      ctx.fillStyle = TEAL;
      ctx.fillRect(player.x - 25, player.y + 18, 50 * clamp(player.targetProgress, 0, 1), 4);
    }
  }
}

function drawCoinFx(ctx, state) {
  for (const fx of state.coinFx) {
    if (!fx.landed) {
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
    } else {
      const t = fx.age / 0.9;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 8 + t * 80, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 209, 102, ' + (0.55 * (1 - t)) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
    }
  }
}

// The job card: the floor's four jobs, checked off as the night goes on,
// in the top-left corner of the floor. A done job gets a green tick, a
// failed one a red cross, the rest wait as empty rings.
function drawObjectives(ctx, state) {
  const jobs = state.objectives;
  if (!jobs || jobs.length === 0 || state.screen !== 'play') return;
  const x = 20;
  const y = HUD_H + 8;
  const w = 252;
  const rowH = 19;
  const h = 26 + jobs.length * rowH;
  ctx.fillStyle = 'rgba(5, 8, 14, 0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(154, 165, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 11px ' + FONT;
  ctx.fillText('THE JOB  ·  ' + objectivesDoneCount(jobs) + '/' + jobs.length, x + 10, y + 17);
  ctx.font = '12px ' + FONT;
  jobs.forEach((job, i) => {
    const ry = y + 28 + i * rowH;
    const mark = job.done ? '✓' : job.failed ? '✗' : '○';
    ctx.fillStyle = job.done ? '#4ade80' : job.failed ? '#f87171' : DIM;
    ctx.fillText(mark, x + 10, ry + 12);
    ctx.fillStyle = job.done ? INK : job.failed ? '#fca5a5' : DIM;
    ctx.fillText(job.label, x + 28, ry + 12);
  });
}

// The blackout veil: the lights are out, and what is left of them stutters.
// Drawn over the floor but under the HUD, so the meter stays readable.
function drawBlackoutVeil(ctx, state) {
  const wobble = flickerNoise(state.time) - 0.5;
  const alpha = clamp(BLACKOUT.veilAlpha + wobble * BLACKOUT.flickerAmp * 2, 0.35, 0.7);
  ctx.fillStyle = 'rgba(2, 3, 8, ' + alpha.toFixed(3) + ')';
  ctx.fillRect(0, HUD_H, VIEW_W, 720 - HUD_H);
}

function drawHud(ctx, state) {
  ctx.fillStyle = '#0d1119';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 17px ' + FONT;
  ctx.fillText('VAULTBREAK', 16, 24);
  ctx.fillStyle = DIM;
  ctx.font = '12px ' + FONT;
  ctx.fillText(state.world.level.name, 16, 43);

  // Loot carried. On the results screen the floor's take is already banked,
  // so only count the bag while the floor is live.
  const inBag = state.screen === 'play' ? state.player.lootCarried : 0;
  ctx.fillStyle = INK;
  ctx.font = 'bold 19px ' + FONT;
  ctx.fillText('$' + (state.banked + inBag).toLocaleString('en-US'), 300, 27);
  ctx.fillStyle = DIM;
  ctx.font = '11px ' + FONT;
  ctx.fillText('LOOT (this floor $' + state.player.lootCarried.toLocaleString('en-US') + ')', 300, 44);

  // The alarm meter.
  const ax = 560;
  const aw = 300;
  ctx.fillStyle = DIM;
  ctx.font = 'bold 11px ' + FONT;
  ctx.fillText(state.alarm.lockdownFor > 0 ? 'ALARM — LOCKDOWN!' : 'ALARM', ax, 15);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(ax, 20, aw, 16);
  const v = state.alarm.value / 100;
  const grad = ctx.createLinearGradient(ax, 0, ax + aw, 0);
  grad.addColorStop(0, '#22c55e');
  grad.addColorStop(0.55, '#f59e0b');
  grad.addColorStop(1, '#ef4444');
  ctx.fillStyle = grad;
  if (v > 0) ctx.fillRect(ax, 20, aw * v, 16);
  ctx.strokeStyle = state.alarm.lockdownFor > 0 && Math.sin(state.time * 10) > 0 ? '#ef4444' : '#4b5563';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(ax, 20, aw, 16);
  if (state.blackout) {
    // The HUD indicator: the lights are out, and loot pays the dark rate.
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(ax, 38, 178, 15);
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, 38, 178, 15);
    ctx.fillStyle = '#c7d2fe';
    ctx.font = 'bold 10px ' + FONT;
    ctx.fillText('BLACKOUT — LOOT +15%', ax + 6, 49);
  } else {
    ctx.fillStyle = DIM;
    ctx.font = '11px ' + FONT;
    ctx.fillText(
      state.camerasOffFor > 0 ? 'cameras dark ' + Math.ceil(state.camerasOffFor) + 's' : 'cameras live',
      ax,
      50,
    );
  }

  // Tools and clock.
  ctx.fillStyle = INK;
  ctx.font = 'bold 15px ' + FONT;
  ctx.fillText('●'.repeat(state.player.coins) + '○'.repeat(Math.max(0, 3 - state.player.coins)), 920, 26);
  ctx.fillStyle = DIM;
  ctx.font = '11px ' + FONT;
  ctx.fillText('coins — click to throw', 920, 43);
  ctx.fillStyle = state.player.empUsed ? '#4b5563' : INK;
  ctx.font = 'bold 15px ' + FONT;
  ctx.fillText(state.player.empUsed ? 'EMP spent' : 'EMP ready (Q)', 1064, 26);
  ctx.fillStyle = DIM;
  ctx.font = '11px ' + FONT;
  const mm = Math.floor(state.time / 60);
  const ss = Math.floor(state.time % 60);
  ctx.fillText('time ' + mm + ':' + String(ss).padStart(2, '0') + ' · par ' + Math.round(state.world.level.parSeconds / 60 * 10) / 10 + 'm', 1064, 43);
}

function banner(ctx, state) {
  if (state.alarm.lockdownFor > 0 && state.screen === 'play') {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
    ctx.fillRect(0, HUD_H, VIEW_W, 660);
    ctx.font = 'bold 30px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText('LOCKDOWN — BREAK LINE OF SIGHT!', VIEW_W / 2, 110);
  }
  if (state.toast && state.toast.for > 0) {
    ctx.font = 'bold 19px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(state.toast.text).width + 34;
    ctx.fillStyle = 'rgba(5, 8, 14, 0.85)';
    ctx.fillRect(VIEW_W / 2 - w / 2, 74, w, 34);
    ctx.fillStyle = state.toast.color || INK;
    ctx.fillText(state.toast.text, VIEW_W / 2, 97);
  }
}

function veil(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 11, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, 720);
}

// The pause menu: the game is frozen, and the thief can read the controls
// without the floor moving under them — plus where the job card stands.
function drawPaused(ctx, state) {
  veil(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = 'bold 40px ' + FONT;
  ctx.fillText('PAUSED', VIEW_W / 2, 220);
  ctx.fillStyle = DIM;
  ctx.font = '16px ' + FONT;
  const lines = [
    'WASD / arrows — move        SHIFT — sneak        Hold E — grab / crack / panel',
    'Click — throw a coin        Q — EMP        B — Blackout Mode        R — restart floor',
    'M — sound on / off',
    '',
    'H — how to play        P or Esc — keep creeping',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 268 + i * 26));
  if (state.objectives && state.objectives.length > 0) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(
      'The job: ' + objectivesDoneCount(state.objectives) + '/' + state.objectives.length + ' done',
      VIEW_W / 2,
      268 + lines.length * 26 + 18,
    );
  }
}

function drawTitle(ctx, state) {
  veil(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 64px ' + FONT;
  ctx.fillText('VAULTBREAK', VIEW_W / 2, 190);
  ctx.fillStyle = INK;
  ctx.font = '21px ' + FONT;
  ctx.fillText('The Meridian Job — three floors, one van, no witnesses.', VIEW_W / 2, 228);
  ctx.fillStyle = DIM;
  ctx.font = '16px ' + FONT;
  const lines = [
    'Cross each floor, lift what glitters, crack the vault, reach the van.',
    'Guards and cameras feed the ALARM meter — a full meter locks the floor down.',
    '',
    'WASD / arrows — move        SHIFT — sneak (slower, harder to see)',
    'Hold E — grab loot, crack the vault, work a camera panel',
    'Click — throw a coin to pull a guard away        Q — EMP: cameras dark 10s (−$250)',
    'B — Blackout Mode: kill the lights, shorten every cone, loot pays 15% more',
    'H — how to play        R — restart the floor        M — sound on / off',
    'Dark floor patches are shadow: vision cones reach half as far there.',
    '',
    'Press ENTER or click to start the job',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 286 + i * 27));
  if (state.best !== null && state.best !== undefined) {
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText('Best haul so far: $' + state.best.toLocaleString('en-US'), VIEW_W / 2, 286 + lines.length * 27 + 14);
  }
}

// The help overlay: the full control list on one screen, over a veil, for
// the thief who forgot a key mid-floor. H opens it, H closes it.
function drawHelp(ctx, state) {
  veil(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 40px ' + FONT;
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 150);
  ctx.fillStyle = INK;
  ctx.font = '19px ' + FONT;
  ctx.fillText('Three floors. Lift what glitters, crack the vault, reach the van.', VIEW_W / 2, 186);
  ctx.fillStyle = DIM;
  ctx.font = '16px ' + FONT;
  const lines = [
    '',
    'WASD / arrow keys — move the thief',
    'SHIFT (hold) — sneak: slower, but guards and cameras see you later',
    'E (hold) — grab loot, crack the vault, work a camera panel',
    'Click — throw a coin: the clink pulls a patrolling guard over to look',
    'Q — EMP: every camera goes dark for 10 seconds (−$250, once a floor)',
    'B — Blackout Mode: the lights die, every cone shortens, loot pays 15% more',
    'R — restart this floor (the loot you banked stays banked)',
    'M — sound on / off',
    'P or Esc — pause',
    '',
    'The job card in the corner lists the floor: half the loose loot, the vault,',
    'keeping the alarm under 25, and the van. Keep the alarm under 25 and the',
    'floor pays a $200 ghost bonus on top of the haul.',
    'Dark floor patches are shadow: vision cones reach barely half as far there.',
    'A full alarm meter locks the floor down — the van seals for 8 seconds,',
    'and every guard hunts where the building last saw you.',
    '',
    'Press H to get back to the job',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 224 + i * 26));
  void state;
}

function drawBusted(ctx, state) {
  veil(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 58px ' + FONT;
  ctx.fillText('BUSTED', VIEW_W / 2, 250);
  ctx.fillStyle = INK;
  ctx.font = '19px ' + FONT;
  ctx.fillText('The floor keeps its secrets. The loot you carried is gone.', VIEW_W / 2, 300);
  ctx.fillStyle = DIM;
  ctx.font = '16px ' + FONT;
  ctx.fillText('Press ENTER to try ' + state.world.level.name + ' again', VIEW_W / 2, 350);
}

function drawResults(ctx, state) {
  veil(ctx);
  const r = state.results;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 46px ' + FONT;
  ctx.fillText(r.isLast ? 'THE JOB IS DONE' : 'CLEAN GETAWAY', VIEW_W / 2, 140);
  ctx.fillStyle = DIM;
  ctx.font = '16px ' + FONT;
  ctx.fillText(r.floorName, VIEW_W / 2, 168);
  ctx.font = '17px ' + FONT;
  let y = 214;
  for (const line of r.lines) {
    ctx.fillStyle = DIM;
    ctx.textAlign = 'right';
    ctx.fillText(line.label, VIEW_W / 2 - 14, y);
    ctx.fillStyle = line.value < 0 ? '#f87171' : INK;
    ctx.textAlign = 'left';
    ctx.fillText((line.value < 0 ? '−$' : '$') + Math.abs(line.value).toLocaleString('en-US'), VIEW_W / 2 + 14, y);
    y += 27;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(VIEW_W / 2 - 190, y - 18, 380, 2);
  ctx.textAlign = 'right';
  ctx.fillStyle = DIM;
  ctx.font = 'bold 19px ' + FONT;
  ctx.fillText('TOTAL HAUL', VIEW_W / 2 - 14, y + 16);
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'left';
  ctx.fillText('$' + r.grandTotal.toLocaleString('en-US'), VIEW_W / 2 + 14, y + 16);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 84px ' + FONT;
  ctx.fillText(r.grade, VIEW_W / 2, y + 108);
  ctx.fillStyle = DIM;
  ctx.font = '15px ' + FONT;
  ctx.fillText('grade', VIEW_W / 2, y + 132);
  // The whole job, when it is done: floors cleared, alarms tripped, time.
  if (r.isLast && r.stats) {
    const s = r.stats;
    const mm = Math.floor(s.timeTotal / 60);
    const ss = Math.floor(s.timeTotal % 60);
    ctx.fillStyle = DIM;
    ctx.font = '15px ' + FONT;
    ctx.fillText(
      'The job: ' + s.floorsCleared + ' floors  ·  ' + s.alarmsTripped + ' lockdown' + (s.alarmsTripped === 1 ? '' : 's') +
      '  ·  ' + mm + ':' + String(ss).padStart(2, '0'),
      VIEW_W / 2,
      y + 158,
    );
  }
  ctx.fillStyle = INK;
  ctx.font = '17px ' + FONT;
  ctx.fillText(r.isLast ? 'Press ENTER to run it again' : 'Press ENTER for the next floor', VIEW_W / 2, y + 186);
}

export function drawGame(ctx, state) {
  drawFloor(ctx, state);
  drawVault(ctx, state);
  drawLoot(ctx, state);
  drawPanels(ctx, state);
  drawCameras(ctx, state);
  drawGuards(ctx, state);
  drawPlayer(ctx, state);
  drawCoinFx(ctx, state);
  if (state.blackout) drawBlackoutVeil(ctx, state);
  drawObjectives(ctx, state);
  drawHud(ctx, state);
  banner(ctx, state);
  if (state.showingHelp) drawHelp(ctx, state);
  else if (state.screen === 'title') drawTitle(ctx, state);
  else if (state.screen === 'busted') drawBusted(ctx, state);
  else if (state.screen === 'results' || state.screen === 'complete') drawResults(ctx, state);
  else if (state.paused) drawPaused(ctx, state);
}
