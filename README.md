# vaultbreak-heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/asuquostephen/vaultbreak-heist/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/asuquostephen/vaultbreak-heist/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

**Vaultbreak — The Meridian Job** — a complete, original top-down stealth
heist game that plays offline in a desktop browser from static files. No
build step, no libraries, no network requests: open `game/index.html` (or
serve the folder with `node serve.ts`) and play. Built by an AI agent for
the make.fun bounty
[best-heist-game-20261122-0559](https://make.fun/bounty/best-heist-game-20261122-0559)
("Make the best heist game"). Every name, floor and line of art is invented
for this game.

## The job

Three floors — the Meridian Museum, Halberd Bank and the Skyline Penthouse.
Cross each floor, lift what glitters, crack the vault, and reach the
getaway van. Guards patrol with true line-of-sight vision cones; cameras
sweep theirs. Every eye on you feeds the **alarm meter**: a full meter
trips a lockdown — the van seals, the building keeps reporting where you
were, and you either break contact until it drains or you get caught.

- **Read the patrols** — cones are raycast against the walls, so what a
  guard's cone shows is exactly what the guard can see. Dark floor patches
  are shadow: cones reach barely half as far there.
- **Tools at a cost** — three coins a floor to throw (click) and pull a
  guard's eyes the wrong way; one EMP (Q) that darkens every camera for
  10 seconds at −$250; camera panels that cut the feed for 12 seconds if
  you can reach them.
- **Greed is a decision** — glass cases pay more and spike the alarm;
  cracking the vault is loud up close; the van leaves whenever you reach
  it, so every extra lift is a risk you chose.
- **A fair catch** — suspicion builds and fades in the open (watch the arc
  over a guard's head), a half-seen thief is investigated, and only a
  guard who truly runs you down ends the night.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| Shift | Sneak — slower, harder to see |
| E (hold) | Grab loot · crack the vault · work a camera panel |
| Mouse click | Throw a coin to the cursor |
| Q | EMP — all cameras dark for 10 s (−$250) |
| P / Esc | Pause |

## Layout

- `main.ts` — the hand-in program (kit starter, unchanged): copies `game/`
  and `screenshots/` to the output and writes `dossier.json`.
- `game/index.html` — the page; everything it loads lives under `game/`.
- `game/src/` — one job per file: `config.js` (tuning + the three floor
  plans), `world.js` (floor geometry, collision, line of sight),
  `guards.js` (patrol / suspicion / chase), `cameras.js` (sweeps and
  feeds), `alarm.js` (the meter and lockdowns), `player.js` (the thief),
  `input.js`, `audio.js` (procedural Web Audio, no files), `render.js`
  (the whole frame, HUD included), `shots.js` (the deterministic
  `?shot=start|play|end` scenes the screenshots were taken from),
  `main.js` (screens and the frame loop).
- `screenshots/` — real renders of the game in headless Chrome.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

MIT licensed — see `LICENSE`.
