// The thief: moves on foot (walking is fast, sneaking is slow but harder to
// see), holds E to work — grab loot, crack the vault, work a camera panel —
// and throws coins with the mouse to pull a guard's eyes the wrong way.

import { PLAYER, TOOLS } from './config.js';
import { clamp, distance } from './random.js';
import { moveCircle } from './world.js';

export function makePlayer(world) {
  return {
    x: world.playerStart.x,
    y: world.playerStart.y,
    radius: PLAYER.radius,
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    coins: TOOLS.coinsPerFloor,
    empUsed: false,
    empFor: 0,
    lootCarried: 0,
    lootCount: 0,
    cracking: false, // true on frames where the vault is being worked
    target: null, // current interact target, if any
    near: null, // nearest interactable in range (for the on-screen prompt)
    targetProgress: 0, // 0..1 of the current hold-E job
  };
}

function nearestTarget(world, player) {
  let best = null;
  let bestDist = PLAYER.interactRange;
  for (const item of world.loot) {
    if (item.taken) continue;
    const d = distance(player.x, player.y, item.px, item.py);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: 'loot', item, seconds: item.grabSeconds };
    }
  }
  if (!world.vault.cracked) {
    const r = world.vault.rect;
    const nx = clamp(player.x, r.x, r.x + r.w);
    const ny = clamp(player.y, r.y, r.y + r.h);
    const d = distance(player.x, player.y, nx, ny);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: 'vault', seconds: world.vault.crackSeconds };
    }
  }
  for (const panel of world.panels) {
    if (panel.coolFor > 0) continue;
    const d = distance(player.x, player.y, panel.px, panel.py);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: 'panel', panel, seconds: 0.6 };
    }
  }
  return best;
}

export function updatePlayer(world, player, dt, input, events) {
  player.sneaking = input.sneaking;
  const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const mv = input.move;
  player.moving = mv.x !== 0 || mv.y !== 0;
  if (player.moving) {
    const moved = moveCircle(world, player.x, player.y, player.radius, mv.x * speed * dt, mv.y * speed * dt);
    player.x = moved.x;
    player.y = moved.y;
    player.facing = Math.atan2(mv.y, mv.x);
  }

  if (player.empFor > 0) player.empFor = Math.max(0, player.empFor - dt);
  for (const panel of world.panels) {
    if (panel.coolFor > 0) panel.coolFor = Math.max(0, panel.coolFor - dt);
  }

  // Hold-E work. Moving cancels the job; so does letting go of the key.
  player.cracking = false;
  const target = nearestTarget(world, player);
  player.near = target;
  if (!input.interact || player.moving || !target) {
    player.target = null;
    player.targetProgress = 0;
    return;
  }
  if (!player.target || player.target.kind !== target.kind || player.target.item !== target.item || player.target.panel !== target.panel) {
    player.target = target;
    player.targetProgress = target.kind === 'vault' ? world.vault.progress : 0;
  }
  player.targetProgress += dt / target.seconds;
  if (target.kind === 'vault') {
    player.cracking = true;
    world.vault.progress = player.targetProgress;
  }
  if (player.targetProgress < 1) return;

  // The job is done.
  player.target = null;
  player.targetProgress = 0;
  if (target.kind === 'loot') {
    target.item.taken = true;
    player.lootCarried += target.item.value;
    player.lootCount += 1;
    events.push({ type: 'loot', item: target.item });
  } else if (target.kind === 'vault') {
    world.vault.cracked = true;
    player.lootCarried += world.vault.value;
    player.lootCount += 1;
    events.push({ type: 'vaultCracked' });
  } else if (target.kind === 'panel') {
    target.panel.coolFor = 20;
    events.push({ type: 'panelUsed', panel: target.panel });
  }
}

// A coin throw: returns the landing point, or null when the thief is out of
// coins or the click was beyond throwing range (then it lands at range end).
export function throwCoin(player, tx, ty) {
  if (player.coins <= 0) return null;
  const d = distance(player.x, player.y, tx, ty);
  let lx = tx;
  let ly = ty;
  if (d > PLAYER.coinRange) {
    lx = player.x + ((tx - player.x) / d) * PLAYER.coinRange;
    ly = player.y + ((ty - player.y) / d) * PLAYER.coinRange;
  }
  player.coins -= 1;
  return { x: lx, y: ly };
}
